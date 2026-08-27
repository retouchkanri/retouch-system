import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { memberMutationGuard } from "@/lib/memberGuard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncSupportCreate, syncSupportUpdate } from "@/lib/stripeSupport";
import { SUPPORT_UNIT_PRICE } from "@/lib/constraints";
import { notify, staffRecipients, supportChangedTemplate } from "@/lib/notify";

const schema = z.object({
  plan_id: z.string().uuid(),
  units: z
    .number()
    .positive()
    .max(100)
    .refine((v) => Number.isInteger(v * 2), "口数は0.5口刻みで指定してください"),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.customerId) {
    return NextResponse.json({ error: "認証されていません" }, { status: 401 });
  }
  const forbidden = memberMutationGuard(session);
  if (forbidden) return forbidden;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }
  const { plan_id, units } = parsed.data;

  const supabase = createSupabaseServerClient();
  const { data: plan } = await supabase.from("membership_plans").select("*").eq("id", plan_id).maybeSingle();
  if (!plan || plan.code !== "SUPPORT") {
    return NextResponse.json({ error: "支援プランが正しくありません" }, { status: 400 });
  }
  // Authoritative per-口 price (半口 = units 0.5 → ¥6,000).
  const monthly = Math.round(SUPPORT_UNIT_PRICE * Number(units));

  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from("support_subscriptions")
    .select(
      "id, customer_id, contract_id, horse_id, units, monthly_amount, stripe_subscription_item_id, horse:horses(name)",
    )
    .eq("id", params.id)
    .maybeSingle();
  if (!existing || (existing as any).customer_id !== session.customerId) {
    return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
  }
  const prevUnits = Number((existing as any).units);
  const prevMonthly = Number((existing as any).monthly_amount);
  const horseName = (existing as any).horse?.name ?? null;

  const stripeEnabled = Boolean(process.env.STRIPE_SECRET_KEY);

  // Legacy/orphaned support row with no Stripe item linked yet (e.g.
  // imported before Stripe billing was connected for this contract), OR a
  // row whose linked item/subscription has since died — self-heal by
  // creating a fresh item/subscription instead of failing outright.
  async function selfHeal() {
    const [{ data: customer }, { data: contract }] = await Promise.all([
      admin
        .from("customers")
        .select("id, email, full_name, stripe_customer_id")
        .eq("id", (existing as any).customer_id)
        .maybeSingle(),
      admin
        .from("contracts")
        .select("id, stripe_subscription_id, status")
        .eq("id", (existing as any).contract_id)
        .maybeSingle(),
    ]);
    if (!customer || !contract) {
      throw new Error("会員情報または契約情報が見つかりません");
    }
    return syncSupportCreate({
      customer: customer as any,
      contract: contract as any,
      support: {
        id: params.id,
        horse_id: (existing as any).horse_id,
        horse_name: horseName,
        monthly_amount: monthly,
      },
      existing_item_id: null,
    });
  }

  let sync;
  let syncError: string | null = null;
  try {
    const existingItemId = (existing as any).stripe_subscription_item_id ?? null;
    if (existingItemId) {
      try {
        sync = await syncSupportUpdate({
          support_id: params.id,
          stripe_subscription_item_id: existingItemId,
          monthly_amount: monthly,
          horse_name: horseName,
        });
      } catch (e: any) {
        // The item's subscription can die between signup and this edit
        // (canceled, or auto-expired from `incomplete` after the customer
        // never completed a 3DS/Link confirmation) without our DB knowing —
        // reported 2026-08: this surfaced as a raw "No such subscription" /
        // "cannot update ... incomplete_expired" error on every future edit.
        // Detect that class of failure and self-heal instead of failing.
        const msg = String(e?.message ?? "");
        const isDeadSubscription =
          e?.code === "resource_missing" ||
          /incomplete_expired/i.test(msg) ||
          /no such subscription/i.test(msg);
        if (!isDeadSubscription) throw e;
        sync = await selfHeal();
      }
    } else {
      sync = await selfHeal();
    }
  } catch (e: any) {
    sync = { synced: false, reason: e?.message ?? "stripe_error" };
    syncError = e?.message ?? "Stripeとの同期に失敗しました";
  }

  const requiresStripePayment = Boolean(stripeEnabled && (sync as any)?.requires_payment);
  const canCommit = (sync?.synced && !requiresStripePayment) || !stripeEnabled;

  if (requiresStripePayment) {
    await admin.from("audit_logs").insert({
      actor_id: session.userId,
      action: "support.update.requires_payment",
      target_table: "support_subscriptions",
      target_id: params.id,
      meta: {
        plan_id,
        horse_name: horseName,
        prev_units: prevUnits,
        prev_monthly: prevMonthly,
        units,
        monthly,
        stripe: sync,
      },
    });
    return NextResponse.json({
      ok: true,
      support_id: params.id,
      checkout_url: (sync as any)?.checkout_url ?? null,
      requires_payment: true,
      stripe: sync,
    });
  }

  if (!canCommit) {
    await admin.from("audit_logs").insert({
      actor_id: session.userId,
      action: "support.update.sync_failed",
      target_table: "support_subscriptions",
      target_id: params.id,
      meta: {
        plan_id,
        horse_name: horseName,
        prev_units: prevUnits,
        prev_monthly: prevMonthly,
        units,
        monthly,
        stripe: sync,
      },
    });
    return NextResponse.json(
      {
        error:
          syncError ??
          "決済の同期に失敗したため、変更を確定できませんでした。時間をおいて再度お試しください。",
      },
      { status: 502 },
    );
  }

  const { error } = await admin
    .from("support_subscriptions")
    .update({ units, monthly_amount: monthly })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("audit_logs").insert({
    actor_id: session.userId,
    action: "support.update",
    target_table: "support_subscriptions",
    target_id: params.id,
    meta: {
      plan_id,
      horse_name: horseName,
      prev_units: prevUnits,
      prev_monthly: prevMonthly,
      units,
      monthly,
      stripe: sync,
    },
  });

  const { data: cust } = await admin
    .from("customers")
    .select("full_name, email")
    .eq("id", session.customerId)
    .maybeSingle();
  const tpl = supportChangedTemplate({
    name: (cust as any)?.full_name ?? null,
    horseName: horseName ?? "ご支援馬",
    prevUnits,
    prevMonthly,
    newUnits: Number(units),
    newMonthly: monthly,
  });
  await notify({
    kind: "support_changed",
    to: (cust as any)?.email ?? session.email,
    to_name: (cust as any)?.full_name ?? null,
    subject: tpl.subject,
    body_text: tpl.body_text,
    meta: { support_id: params.id, prev_units: prevUnits, new_units: units },
  });

  // スタッフへの支援変更通知
  {
    const fmt = (n: number) => (Number.isInteger(n) ? `${n}口` : `${n.toFixed(1)}口`);
    const custName = (cust as any)?.full_name ?? "（不明）";
    const custEmail = (cust as any)?.email ?? session.email;
    await notify({
      kind: "staff_notify",
      to: staffRecipients(),
      subject: `【一口支援 変更】${custName} — ${horseName ?? "（不明）"}`,
      body_text:
        `一口支援内容の変更がありました。\n\n` +
        `・会員名: ${custName}\n` +
        `・メール: ${custEmail}\n` +
        `・対象馬: ${horseName ?? "（不明）"}\n` +
        `・変更前: ${fmt(prevUnits)} / 月額 ¥${Math.round(prevMonthly).toLocaleString("ja-JP")}\n` +
        `・変更後: ${fmt(Number(units))} / 月額 ¥${Math.round(monthly).toLocaleString("ja-JP")}`,
      reply_to: custEmail,
      meta: { support_id: params.id, prev_units: prevUnits, new_units: units, source: "support_update" },
    });
  }

  return NextResponse.json({ ok: true, stripe: sync });
}
