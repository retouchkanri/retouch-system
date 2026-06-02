import type Stripe from "stripe";
import { getStripe } from "./stripe";
import { createSupabaseAdminClient } from "./supabase/admin";

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
  const { data: existing } = await admin
    .from("payments")
    .select("stripe_charge_id, stripe_payment_intent_id, occurred_at")
    .order("occurred_at", { ascending: false })
    .limit(100000);
  const haveCharge = new Set<string>();
  const havePI = new Set<string>();
  let latestOccurredMs = 0;
  for (const r of (existing ?? []) as any[]) {
    if (r.stripe_charge_id) haveCharge.add(r.stripe_charge_id);
    if (r.stripe_payment_intent_id) havePI.add(r.stripe_payment_intent_id);
    if (r.occurred_at) latestOccurredMs = Math.max(latestOccurredMs, new Date(r.occurred_at).getTime());
  }

  const params: Stripe.ChargeListParams = { limit: 100 };
  if (!opts.full && latestOccurredMs > 0) {
    // 1h overlap so we never miss a charge straddling the boundary.
    params.created = { gte: Math.floor(latestOccurredMs / 1000) - 60 * 60 };
  }

  // Cache: stripe_customer_id → local customers.id
  const custCache = new Map<string, string | null>();
  async function resolveCustomer(stripeCustomerId: string | null): Promise<string | null> {
    if (!stripeCustomerId) return null;
    if (custCache.has(stripeCustomerId)) return custCache.get(stripeCustomerId) ?? null;
    const { data } = await admin
      .from("customers")
      .select("id")
      .eq("stripe_customer_id", stripeCustomerId)
      .maybeSingle();
    const id = (data as any)?.id ?? null;
    custCache.set(stripeCustomerId, id);
    return id;
  }

  let synced = 0;
  let skipped = 0;

  // Stripe SDK auto-paginates with `for await`.
  for await (const charge of stripe.charges.list(params)) {
    const pi = idOf(charge.payment_intent as any);
    // A row for this exact charge → refresh it. Otherwise, if the webhook
    // already logged this payment_intent, skip to avoid a duplicate.
    if (!haveCharge.has(charge.id) && pi && havePI.has(pi)) {
      skipped += 1;
      continue;
    }

    const invoiceId = idOf(charge.invoice as any);
    const customerId = await resolveCustomer(idOf(charge.customer as any));

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
      },
      { onConflict: "stripe_charge_id" },
    );
    if (!error) {
      synced += 1;
      haveCharge.add(charge.id);
      if (pi) havePI.add(pi);
    }
  }

  return { synced, skipped };
}
