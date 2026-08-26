import type Stripe from "stripe";
import { getStripe } from "./stripe";
import { createSupabaseAdminClient } from "./supabase/admin";
import { SUPPORT_STRIPE_QUANTUM } from "./constraints";

/**
 * Stripe sync for per-horse support subscriptions.
 *
 * Model:
 *   - One Stripe Subscription per contract (contracts.stripe_subscription_id).
 *   - One Stripe Subscription Item per support_subscription
 *     (support_subscriptions.stripe_subscription_item_id).
 *   - Quantity on each item is derived from the support row's
 *     `monthly_amount` divided by the HALF-口 quantum (¥6,000) so that
 *     half/full/multi-unit support all map to the same price id with
 *     different quantities. See SUPPORT_STRIPE_QUANTUM in constraints.ts
 *     for why the quantum is the half-口 amount and not the full ¥12,000.
 *
 * Stripe is OPTIONAL: when Stripe or the base price id is not configured,
 * helpers degrade to a no-op while returning `{ synced: false }` so the
 * DB side of the operation still succeeds for local/dev environments.
 */

export type SupportSyncResult = {
  synced: boolean;
  reason?: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_subscription_item_id?: string | null;
  checkout_url?: string | null;
  requires_payment?: boolean;
};

type CustomerRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  stripe_customer_id: string | null;
};

type ContractRow = {
  id: string;
  stripe_subscription_id: string | null;
  status: string;
};

/**
 * Ensure there is a Stripe price whose `unit_amount` equals the half-口
 * quantum (¥6,000). Support items are billed as `quantity × this price`,
 * so the quantum MUST be the half-口 amount for 半口 to charge correctly.
 *
 * Resolution order (zero-config, no manual Stripe dashboard steps):
 *   1. Reuse a SUPPORT plan that already carries a stripe_price_id created
 *      at the quantum amount (e.g. the 半口支援 plan, ¥6,000).
 *   2. Otherwise create a ¥6,000 recurring price and persist it onto a
 *      SUPPORT plan whose unit_amount matches the quantum, if one exists.
 */
async function ensureSupportBasePrice(): Promise<{
  unit_amount: number;
  stripe_price_id: string;
} | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  const quantum = SUPPORT_STRIPE_QUANTUM;
  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from("membership_plans")
    .select("id, stripe_price_id")
    .eq("code", "SUPPORT")
    .eq("unit_amount", quantum)
    .not("stripe_price_id", "is", null)
    .limit(1)
    .maybeSingle();
  if ((existing as any)?.stripe_price_id) {
    // Verify the actual Stripe price amount matches the quantum.
    // A stale DB record pointing to a ¥12,000 price (created before the
    // quantum was halved) would otherwise charge 半口 supporters ¥12,000.
    try {
      const sp = await stripe.prices.retrieve((existing as any).stripe_price_id);
      if (sp.unit_amount === quantum) {
        return { unit_amount: quantum, stripe_price_id: sp.id };
      }
      // Amount mismatch — fall through to create a correctly-priced price.
    } catch {
      // Price deleted from Stripe — fall through to create a fresh one.
    }
  }

  const price = await stripe.prices.create({
    currency: "jpy",
    unit_amount: quantum,
    recurring: { interval: "month" },
    product_data: { name: "Retouchメンバーズ 支援（半口単位）" },
  });
  const { data: target } = await admin
    .from("membership_plans")
    .select("id")
    .eq("code", "SUPPORT")
    .eq("unit_amount", quantum)
    .limit(1)
    .maybeSingle();
  if ((target as any)?.id) {
    await admin
      .from("membership_plans")
      .update({ stripe_price_id: price.id })
      .eq("id", (target as any).id);
  }
  return { unit_amount: quantum, stripe_price_id: price.id };
}

export async function ensureStripeCustomer(customer: CustomerRow): Promise<string | null> {
  if (customer.stripe_customer_id) return customer.stripe_customer_id;
  const stripe = getStripe();
  if (!stripe) return null;
  const created = await stripe.customers.create({
    email: customer.email ?? undefined,
    name: customer.full_name ?? undefined,
    metadata: { customer_id: customer.id },
  });
  const admin = createSupabaseAdminClient();
  await admin
    .from("customers")
    .update({ stripe_customer_id: created.id })
    .eq("id", customer.id);
  return created.id;
}

/**
 * Ensure the contract has an associated Stripe subscription. If the
 * subscription does not yet exist, a new one is created with a single
 * initial item for this support row.
 */
async function ensureContractSubscription(
  contract: ContractRow,
  stripeCustomerId: string,
  basePriceId: string,
  initialQuantity: number,
  metadata: Stripe.MetadataParam,
): Promise<{
  subscriptionId: string;
  initialItemId: string | null;
  checkoutUrl: string | null;
  requiresPayment: boolean;
}> {
  const stripe = getStripe();
  if (!stripe) throw new Error("stripe not configured");
  if (contract.stripe_subscription_id) {
    return {
      subscriptionId: contract.stripe_subscription_id,
      initialItemId: null,
      checkoutUrl: null,
      requiresPayment: false,
    };
  }
  const sub = await stripe.subscriptions.create({
    customer: stripeCustomerId,
    items: [{ price: basePriceId, quantity: initialQuantity, metadata }],
    collection_method: "charge_automatically",
    payment_behavior: "default_incomplete",
    proration_behavior: "create_prorations",
    metadata: { contract_id: contract.id },
    expand: ["latest_invoice"],
  });
  const admin = createSupabaseAdminClient();
  await admin
    .from("contracts")
    .update({
      stripe_subscription_id: sub.id,
      status:
        sub.status === "active" ? "active" :
        sub.status === "past_due" ? "past_due" :
        sub.status === "canceled" ? "canceled" :
        sub.status === "incomplete" || sub.status === "incomplete_expired" ? "incomplete" :
        "active",
      current_period_end: sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null,
    })
    .eq("id", contract.id);
  const invoice = typeof sub.latest_invoice === "string" ? null : sub.latest_invoice;
  const statusNeedsPayment = ["incomplete", "past_due", "unpaid"].includes(sub.status);
  const checkoutUrl = invoice?.hosted_invoice_url ?? null;
  const itemId = sub.items.data[0]?.id ?? null;
  return {
    subscriptionId: sub.id,
    initialItemId: itemId,
    checkoutUrl,
    requiresPayment: statusNeedsPayment || Boolean(checkoutUrl),
  };
}

function toQuantity(monthlyAmount: number, baseUnitAmount: number): number {
  if (baseUnitAmount <= 0) return 0;
  return Math.max(1, Math.round(monthlyAmount / baseUnitAmount));
}

/**
 * Stripe rejects `subscriptionItems.create` with "A new item with Price ...
 * can't be added to this Subscription because an existing Subscription Item
 * ... is already using that Price" whenever a SECOND item on the SAME
 * subscription would reuse an already-used Price id. Since every support
 * item shares one global quantum price (see SUPPORT_STRIPE_QUANTUM), this
 * fires reliably the moment a supporter who already supports one horse adds
 * support for a second horse — the existing item on their subscription is
 * already using that price. (Reproduced from the 2026-08 report: repeated
 * "support.create.sync_failed" for a supporter's 2nd horse.)
 *
 * Fix: only reuse the shared base price when it is NOT already attached to
 * an item on this subscription; otherwise mint a same-amount price scoped to
 * this one new item. Future quantity changes are made via the item's own id
 * (see syncSupportUpdate), so this ad-hoc price never needs to be looked up
 * again — it's fine for each additional horse to end up with its own price.
 */
async function resolvePriceForNewItem(
  stripe: Stripe,
  subscriptionId: string,
  base: { unit_amount: number; stripe_price_id: string },
): Promise<string> {
  const items = await stripe.subscriptionItems.list({ subscription: subscriptionId, limit: 100 });
  const inUse = items.data.some((it) => {
    const priceId = typeof it.price === "string" ? it.price : it.price?.id;
    return priceId === base.stripe_price_id;
  });
  if (!inUse) return base.stripe_price_id;

  const price = await stripe.prices.create({
    currency: "jpy",
    unit_amount: base.unit_amount,
    recurring: { interval: "month" },
    product_data: { name: "Retouchメンバーズ 支援（半口単位）" },
  });
  return price.id;
}

/**
 * Create or update the Stripe subscription item for a given support row.
 * Safe to call with or without Stripe configured; returns synced=false
 * when Stripe is disabled so the caller can continue DB-only work.
 */
export async function syncSupportCreate(params: {
  customer: CustomerRow;
  contract: ContractRow;
  support: {
    id: string;
    horse_id: string;
    horse_name?: string | null;
    monthly_amount: number;
  };
  existing_item_id?: string | null;
}): Promise<SupportSyncResult> {
  const stripe = getStripe();
  if (!stripe) return { synced: false, reason: "stripe_disabled" };
  const base = await ensureSupportBasePrice();
  if (!base) return { synced: false, reason: "base_price_missing" };

  const stripeCustomerId = await ensureStripeCustomer(params.customer);
  if (!stripeCustomerId) return { synced: false, reason: "customer_creation_failed" };

  const qty = toQuantity(params.support.monthly_amount, base.unit_amount);
  const metadata: Stripe.MetadataParam = {
    support_id: params.support.id,
    horse_id: params.support.horse_id,
    horse_name: params.support.horse_name ?? "",
  };

  // Reuse existing item if provided
  if (params.existing_item_id) {
    const item = await stripe.subscriptionItems.update(params.existing_item_id, {
      quantity: qty,
      metadata,
      proration_behavior: "create_prorations",
    });
    const admin = createSupabaseAdminClient();
    await admin
      .from("support_subscriptions")
      .update({ stripe_subscription_item_id: item.id })
      .eq("id", params.support.id);
    return {
      synced: true,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: params.contract.stripe_subscription_id,
      stripe_subscription_item_id: item.id,
    };
  }

  // No subscription yet: create it with this item.
  if (!params.contract.stripe_subscription_id) {
    const ensured = await ensureContractSubscription(
      params.contract,
      stripeCustomerId,
      base.stripe_price_id,
      qty,
      metadata,
    );
    const admin = createSupabaseAdminClient();
    if (ensured.initialItemId) {
      await admin
        .from("support_subscriptions")
        .update({ stripe_subscription_item_id: ensured.initialItemId })
        .eq("id", params.support.id);
    }
    return {
      synced: true,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: ensured.subscriptionId,
      stripe_subscription_item_id: ensured.initialItemId,
      checkout_url: ensured.checkoutUrl,
      requires_payment: ensured.requiresPayment,
    };
  }

  // Subscription exists but no item yet: add a new item.
  const priceForNewItem = await resolvePriceForNewItem(
    stripe,
    params.contract.stripe_subscription_id,
    base,
  );
  const item = await stripe.subscriptionItems.create({
    subscription: params.contract.stripe_subscription_id,
    price: priceForNewItem,
    quantity: qty,
    metadata,
    proration_behavior: "create_prorations",
  });
  const admin = createSupabaseAdminClient();
  await admin
    .from("support_subscriptions")
    .update({ stripe_subscription_item_id: item.id })
    .eq("id", params.support.id);
  return {
    synced: true,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: params.contract.stripe_subscription_id,
    stripe_subscription_item_id: item.id,
  };
}

export async function syncSupportUpdate(params: {
  support_id: string;
  stripe_subscription_item_id: string | null;
  monthly_amount: number;
  horse_name?: string | null;
}): Promise<SupportSyncResult> {
  const stripe = getStripe();
  if (!stripe) return { synced: false, reason: "stripe_disabled" };
  if (!params.stripe_subscription_item_id) return { synced: false, reason: "item_missing" };

  // Items are priced at the half-口 quantum (¥6,000); quantity scales the amount.
  const qty = toQuantity(params.monthly_amount, SUPPORT_STRIPE_QUANTUM);
  const item = await stripe.subscriptionItems.update(params.stripe_subscription_item_id, {
    quantity: qty,
    metadata: { support_id: params.support_id, horse_name: params.horse_name ?? "" },
    proration_behavior: "create_prorations",
  });
  return { synced: true, stripe_subscription_item_id: item.id };
}

/**
 * 支援停止同期。
 *
 * 仕様:
 *   - デフォルトは「次回更新日で停止」(cancel_at_period_end = true)。
 *     誤操作リスクを下げるため、即時解約はしない。
 *   - 最後の1アイテムの場合はサブスクリプション全体を period_end 解約。
 *   - 複数アイテム残る場合は即時アイテム削除（Stripe仕様上、部分の
 *     予約解約が標準では行えないため。必要になった段階で
 *     Subscription Schedule への置き換えを検討する）。
 *   - `immediate=true` を指定した場合のみ、即時解約を行う（管理者用）。
 *
 * 戻り値に `scheduled_cancel_at`（ISO文字列）が含まれる場合、呼び出し
 * 元は DB 側の `canceled_at` にその値を保存し、status は `active` の
 * ままにする（停止予定のUI表示用）。実際に status=`canceled` に落と
 * すのは Webhook（customer.subscription.deleted）の責務。
 */
export async function syncSupportCancel(params: {
  stripe_subscription_item_id: string | null;
  stripe_subscription_id: string | null;
  immediate?: boolean;
}): Promise<SupportSyncResult & { scheduled_cancel_at?: string | null }> {
  const stripe = getStripe();
  if (!stripe) return { synced: false, reason: "stripe_disabled" };
  if (!params.stripe_subscription_item_id) return { synced: false, reason: "item_missing" };

  if (params.stripe_subscription_id) {
    const sub = await stripe.subscriptions.retrieve(params.stripe_subscription_id);
    const isLastItem = sub.items.data.length <= 1;

    if (isLastItem) {
      if (params.immediate) {
        await stripe.subscriptions.cancel(params.stripe_subscription_id, {
          invoice_now: false,
          prorate: true,
        });
        return { synced: true, stripe_subscription_id: sub.id, scheduled_cancel_at: null };
      }
      const updated = await stripe.subscriptions.update(params.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
      const scheduled = updated.current_period_end
        ? new Date(updated.current_period_end * 1000).toISOString()
        : null;
      return {
        synced: true,
        stripe_subscription_id: sub.id,
        scheduled_cancel_at: scheduled,
      };
    }
  }

  await stripe.subscriptionItems.del(params.stripe_subscription_item_id, {
    proration_behavior: "create_prorations",
  });
  return { synced: true, scheduled_cancel_at: null };
}
