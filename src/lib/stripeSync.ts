import type Stripe from "stripe";
import { getStripe } from "./stripe";
import { createSupabaseAdminClient } from "./supabase/admin";
import { composeFullName } from "./registration";

/**
 * Pull payments from Stripe (the source of truth for money movement) into the
 * local `payments` table so the admin dashboard / CSV reflect real Stripe data.
 *
 * - `full: true`  → walk the entire charge history (backfill / reconcile).
 * - `full: false` (default) → incremental: only charges created since the most
 *   recent payment we already have (with a 1h overlap), for fast page-load sync.
 *
 * Idempotent: upserts on `stripe_charge_id`. Skips charges whose payment_intent
 * is already recorded (e.g. by the Stripe webhook) to avoid duplicate rows.
 */
export type StripeSyncResult = {
  synced: number;
  skipped: number;
  reason?: "stripe_disabled";
};

function mapStatus(charge: Stripe.Charge): "succeeded" | "failed" | "refunded" | "pending" {
  if (charge.refunded || (charge.amount_refunded ?? 0) > 0) return "refunded";
  if (charge.status === "succeeded") return "succeeded";
  if (charge.status === "failed") return "failed";
  return "pending";
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

export async function syncStripePayments(
  opts: { full?: boolean } = {},
): Promise<StripeSyncResult> {
  const stripe = getStripe();
  if (!stripe) return { synced: 0, skipped: 0, reason: "stripe_disabled" };
  const admin = createSupabaseAdminClient();

  // Existing dedup keys (charge ids + payment-intent ids already recorded).
  // Incremental runs only fetch recent charges, so a recent window is enough
  // for dedup and avoids loading the whole (10k+) table on every page load.
  const { data: existing } = await admin
    .from("payments")
    .select("stripe_charge_id, stripe_payment_intent_id, occurred_at")
    .order("occurred_at", { ascending: false })
    .limit(opts.full ? 100000 : 1000);
  const haveCharge = new Set<string>();
  // PIs recorded on a row that has NO charge id — i.e. a donation logged by the
  // webhook, which stores payment_intent but not charge. We skip a charge whose
  // PI matches one of these to avoid duplicating that webhook row.
  //
  // We deliberately do NOT dedup on PIs that already have a charge id: one
  // subscription PaymentIntent can produce several charges (a failed attempt and
  // its successful retry share a single PI but have distinct charge ids), and
  // each of those charges is a real transaction that must get its own row.
  const havePINoCharge = new Set<string>();
  let latestOccurredMs = 0;
  for (const r of (existing ?? []) as any[]) {
    if (r.stripe_charge_id) haveCharge.add(r.stripe_charge_id);
    else if (r.stripe_payment_intent_id) havePINoCharge.add(r.stripe_payment_intent_id);
    if (r.occurred_at) latestOccurredMs = Math.max(latestOccurredMs, new Date(r.occurred_at).getTime());
  }

  // Expand the customer so we can read its email/name (subscription charges
  // often have empty billing_details; the Customer object is the reliable source).
  // Expand refunds too: recent API versions don't return refund details
  // inline on the charge, so `refunds.data[0].created` (the 返金日) is only
  // available when expanded.
  const params: Stripe.ChargeListParams = {
    limit: 100,
    expand: ["data.customer", "data.refunds"],
  };
  if (!opts.full && latestOccurredMs > 0) {
    // 1h overlap so we never miss a charge straddling the boundary.
    params.created = { gte: Math.floor(latestOccurredMs / 1000) - 60 * 60 };
  }

  // Resolve the local customer: first by stripe_customer_id, then (fallback)
  // by billing email — many imported customers have no stripe_customer_id but
  // do match on email (customers.email is citext, so case-insensitive).
  const byStripeId = new Map<string, string | null>();
  const byEmail = new Map<string, string | null>();
  async function resolveCustomer(
    stripeCustomerId: string | null,
    email: string | null,
  ): Promise<string | null> {
    if (stripeCustomerId) {
      if (!byStripeId.has(stripeCustomerId)) {
        const { data } = await admin
          .from("customers")
          .select("id")
          .eq("stripe_customer_id", stripeCustomerId)
          .maybeSingle();
        byStripeId.set(stripeCustomerId, (data as any)?.id ?? null);
      }
      const id = byStripeId.get(stripeCustomerId);
      if (id) return id;
    }
    if (email) {
      const key = email.toLowerCase();
      if (!byEmail.has(key)) {
        const { data } = await admin
          .from("customers")
          .select("id")
          .eq("email", email)
          .maybeSingle();
        byEmail.set(key, (data as any)?.id ?? null);
      }
      const id = byEmail.get(key);
      if (id) return id;
    }
    return null;
  }

  let synced = 0;
  let skipped = 0;

  // Stripe SDK auto-paginates with `for await`.
  for await (const charge of stripe.charges.list(params)) {
    const pi = idOf(charge.payment_intent as any);
    // A row for this exact charge → refresh it. Otherwise, if the webhook
    // already logged this payment_intent as a chargeless row (donation), skip
    // to avoid a duplicate. Charges sharing a PI with an existing *charge* row
    // (subscription retries) are intentionally NOT skipped — see havePINoCharge.
    if (!haveCharge.has(charge.id) && pi && havePINoCharge.has(pi)) {
      skipped += 1;
      continue;
    }

    const invoiceId = idOf(charge.invoice as any);
    // Prefer the (expanded) Stripe Customer's email/name; fall back to the
    // charge billing details / receipt email. So the row always shows the payer.
    const cust =
      charge.customer && typeof charge.customer !== "string" && !(charge.customer as any).deleted
        ? (charge.customer as Stripe.Customer)
        : null;
    const email = (cust?.email || charge.billing_details?.email || charge.receipt_email || null) as
      | string
      | null;
    let name = (cust?.name || charge.billing_details?.name || null) as string | null;
    const customerId = await resolveCustomer(idOf(charge.customer as any), email);

    // Stripe often omits billing_details.name for subscription charges.
    // Fill in from the local customer record so the admin table shows a name.
    // full_name は2段階登録で姓名から合成する項目のため空のことがある。空なら
    // 姓+名から組み立てて、必ず氏名が入るようにする。
    if (!name && customerId) {
      const { data: cdata } = await admin
        .from("customers")
        .select("full_name, last_name, first_name")
        .eq("id", customerId)
        .maybeSingle();
      const full = ((cdata as any)?.full_name as string | null)?.trim();
      name =
        full ||
        composeFullName((cdata as any)?.last_name, (cdata as any)?.first_name) ||
        null;
    }

    // Display details to mirror the Stripe Transactions table.
    const card = (charge.payment_method_details as any)?.card;
    const refundedAtUnix = (charge.refunds as any)?.data?.[0]?.created as number | undefined;

    const { error } = await admin.from("payments").upsert(
      {
        customer_id: customerId,
        kind: invoiceId ? "subscription" : "one_time",
        amount: charge.amount,
        currency: charge.currency,
        status: mapStatus(charge),
        stripe_charge_id: charge.id,
        stripe_invoice_id: invoiceId,
        stripe_payment_intent_id: pi,
        failure_reason: charge.failure_message ?? null,
        occurred_at: new Date(charge.created * 1000).toISOString(),
        raw: {
          stripe_email: email,
          stripe_name: name,
          brand: card?.brand ?? (charge.payment_method_details as any)?.type ?? null,
          last4: card?.last4 ?? null,
          description: charge.description ?? null,
          refunded_at: refundedAtUnix ? new Date(refundedAtUnix * 1000).toISOString() : null,
        },
      },
      { onConflict: "stripe_charge_id" },
    );
    if (!error) {
      synced += 1;
      haveCharge.add(charge.id);
    }
  }

  return { synced, skipped };
}
