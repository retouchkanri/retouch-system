import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  donationThanksTemplate,
  notify,
  paymentFailedTemplate,
} from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (e: any) {
    return NextResponse.json({ error: `Webhook signature error: ${e.message}` }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const donationId = (session.metadata?.donation_id ?? session.client_reference_id) as string | undefined;
        if (session.mode === "payment" && donationId) {
          await admin
            .from("donations")
            .update({
              status: "succeeded",
              stripe_payment_intent_id: (session.payment_intent as string) ?? null,
              donated_at: new Date(session.created * 1000).toISOString(),
            })
            .eq("id", donationId);
          const { data: donation } = await admin.from("donations").select("*").eq("id", donationId).maybeSingle();
          if (donation) {
            await admin.from("payments").insert({
              customer_id: (donation as any).customer_id,
              donation_id: (donation as any).id,
              kind: "donation",
              amount: (donation as any).amount,
              currency: "jpy",
              status: "succeeded",
              stripe_event_id: event.id,
              stripe_payment_intent_id: (session.payment_intent as string) ?? null,
              occurred_at: new Date(session.created * 1000).toISOString(),
              raw: session as any,
            });

            // Send thank-you email
            const donorEmail = (donation as any).donor_email
              || session.customer_details?.email
              || session.customer_email
              || null;
            let donorName = (donation as any).donor_name as string | null;
            if (!donorName && (donation as any).customer_id) {
              const { data: cust } = await admin
                .from("customers")
                .select("full_name")
                .eq("id", (donation as any).customer_id)
                .maybeSingle();
              donorName = (cust as any)?.full_name ?? null;
            }
            const tpl = donationThanksTemplate({
              name: donorName,
              amount: (donation as any).amount,
            });
            await notify({
              kind: "donation_thanks",
              to: donorEmail,
              to_name: donorName,
              subject: tpl.subject,
              body_text: tpl.body_text,
              meta: { donation_id: (donation as any).id, session_id: session.id },
            });
          }
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const stripeCustomerId = sub.customer as string;
        const { data: customer } = await admin
          .from("customers")
          .select("id")
          .eq("stripe_customer_id", stripeCustomerId)
          .maybeSingle();
        if (customer) {
          const mappedStatus =
            sub.status === "active" ? "active" :
            sub.status === "past_due" ? "past_due" :
            sub.status === "canceled" ? "canceled" :
            sub.status === "paused" ? "paused" : "incomplete";
          const currentPeriodEndIso = sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null;
          await admin.from("contracts").upsert(
            {
              customer_id: (customer as any).id,
              stripe_subscription_id: sub.id,
              status: mappedStatus,
              current_period_end: currentPeriodEndIso,
            },
            { onConflict: "stripe_subscription_id" },
          );

          // 紐づく contract の支援行にも同じステータスを反映。
          //  - active   : 会員画面で「正常」表示
          //  - past_due : 「決済失敗」表示
          //  - incomplete: 「手続き中」表示
          // 停止予定（cancel_at_period_end=true）は
          //   status=active + canceled_at=current_period_end として保持。
          const { data: contract } = await admin
            .from("contracts")
            .select("id")
            .eq("stripe_subscription_id", sub.id)
            .maybeSingle();
          if (contract) {
            const supportStatus =
              mappedStatus === "canceled" ? "canceled" :
              mappedStatus === "past_due" ? "past_due" :
              mappedStatus === "incomplete" ? "incomplete" : "active";
            await admin
              .from("support_subscriptions")
              .update({
                status: supportStatus,
                canceled_at: sub.cancel_at_period_end ? currentPeriodEndIso : null,
              })
              .eq("contract_id", (contract as any).id)
              .in("status", ["active", "past_due", "incomplete"]);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const nowIso = new Date().toISOString();
        await admin
          .from("contracts")
          .update({ status: "canceled", canceled_at: nowIso })
          .eq("stripe_subscription_id", sub.id);

        const { data: contract } = await admin
          .from("contracts")
          .select("id")
          .eq("stripe_subscription_id", sub.id)
          .maybeSingle();
        if (contract) {
          await admin
            .from("support_subscriptions")
            .update({
              status: "canceled",
              canceled_at: nowIso,
              stripe_subscription_item_id: null,
            })
            .eq("contract_id", (contract as any).id)
            .in("status", ["active", "past_due", "incomplete"]);
        }
        break;
      }

      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeCustomerId = invoice.customer as string;
        const { data: customer } = await admin
          .from("customers")
          .select("id")
          .eq("stripe_customer_id", stripeCustomerId)
          .maybeSingle();
        const { data: contract } = invoice.subscription
          ? await admin
              .from("contracts")
              .select("id, status")
              .eq("stripe_subscription_id", invoice.subscription as string)
              .maybeSingle()
          : { data: null } as any;

        await admin.from("payments").insert({
          customer_id: (customer as any)?.id ?? null,
          contract_id: (contract as any)?.id ?? null,
          kind: "subscription",
          amount: invoice.amount_paid || invoice.amount_due || 0,
          currency: invoice.currency,
          status: event.type === "invoice.payment_succeeded" ? "succeeded" : "failed",
          stripe_event_id: event.id,
          stripe_invoice_id: invoice.id,
          failure_reason: event.type === "invoice.payment_failed" ? (invoice.last_finalization_error?.message ?? null) : null,
          occurred_at: new Date((invoice.status_transitions.paid_at ?? invoice.created) * 1000).toISOString(),
          raw: invoice as any,
        });

        // --- 決済失敗 → past_due 化 + メール通知 ---
        if (event.type === "invoice.payment_failed" && contract) {
          await admin.from("contracts").update({ status: "past_due" }).eq("id", (contract as any).id);
          await admin
            .from("support_subscriptions")
            .update({ status: "past_due" })
            .eq("contract_id", (contract as any).id)
            .in("status", ["active", "incomplete"]);

          const { data: fullCust } = await admin
            .from("customers")
            .select("full_name, email")
            .eq("id", (customer as any)?.id)
            .maybeSingle();
          const tpl = paymentFailedTemplate({
            name: (fullCust as any)?.full_name ?? null,
            contractId: (contract as any).id,
          });
          await notify({
            kind: "payment_failed",
            to: (fullCust as any)?.email ?? null,
            to_name: (fullCust as any)?.full_name ?? null,
            subject: tpl.subject,
            body_text: tpl.body_text,
            meta: {
              contract_id: (contract as any).id,
              invoice_id: invoice.id,
            },
          });
        }

        // --- 決済成功 → past_due から復帰 + next_period_end 更新 ---
        if (event.type === "invoice.payment_succeeded" && contract) {
          const nextPeriodEnd = invoice.lines?.data?.[0]?.period?.end;
          await admin
            .from("contracts")
            .update({
              status: "active",
              current_period_end: nextPeriodEnd
                ? new Date(nextPeriodEnd * 1000).toISOString()
                : undefined,
            })
            .eq("id", (contract as any).id);
          await admin
            .from("support_subscriptions")
            .update({ status: "active" })
            .eq("contract_id", (contract as any).id)
            .in("status", ["past_due", "incomplete"]);
        }
        break;
      }
      default:
        break;
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
