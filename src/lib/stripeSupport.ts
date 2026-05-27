import type Stripe from "stripe";
import { getStripe } from "./stripe";
import { createSupabaseAdminClient } from "./supabase/admin";

/**
 * Stripe sync for per-horse support subscriptions.
 *
 * Model:
 *   - One Stripe Subscription per contract (contracts.stripe_subscription_id).
 *   - One Stripe Subscription Item per support_subscription
 *     (support_subscriptions.stripe_subscription_item_id).
 *   - Quantity on each item is derived from the support base plan's
 *     `unit_amount` (yen) so half/full/multi-unit support all map to
 *     the same price id with different quantities.
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

async function loadSupportBasePlan() {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("membership_plans")
    .select("id, unit_amount, monthly_amount, stripe_price_id, name")
    .eq("code", "SUPPORT")
    .eq("is_active", true)
    .order("unit_amount", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  return data as {
    id: string;
    name: string;
    unit_amount: number | null;
    monthly_amount: number;
    stripe_price_id: string | null;
  } | null;
}

/**
 * Ensure the SUPPORT base plan has a Stripe price. If not, create one
 * dynamically using the plan's `unit_amount` (yen per 1口) and persist
 * the price id back to the DB. This lets us keep zero-config setup —
 * no manual Stripe dashboard steps required.
 */
async function ensureSupportBasePrice(): Promise<{
  id: string;
  unit_amount: number;
  stripe_price_id: string;
} | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  const base = await loadSupportBasePlan();
  if (!base?.unit_amount) return null;
  if (base.stripe_price_id) {
    return {
      id: base.id,
      unit_amount: base.unit_amount,
      stripe_price_id: base.stripe_price_id,
    };
  }
  const price = await stripe.prices.create({
    currency: "jpy",
    unit_amount: base.unit_amount,
    recurring: { interval: "month" },
    product_data: { name: `Retouchメンバーズ ${base.name}` },
  });
  const admin = createSupabaseAdminClient();
  await admin.from("membership_plans").update({ stripe_price_id: price.id }).eq("id", base.id);
  return { id: base.id, unit_amount: base.unit_amount, stripe_price_id: price.id };
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
  const item = await stripe.subscriptionItems.create({
    subscription: params.contract.stripe_subscription_id,
    price: base.stripe_price_id,
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
  const base = await loadSupportBasePlan();
  if (!base?.unit_amount) return { synced: false, reason: "base_price_missing" };

  const qty = toQuantity(params.monthly_amount, base.unit_amount);
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
