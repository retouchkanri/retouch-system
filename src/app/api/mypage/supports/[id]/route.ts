import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncSupportUpdate } from "@/lib/stripeSupport";
import { notify, supportChangedTemplate } from "@/lib/notify";

const schema = z.object({
  plan_id: z.string().uuid(),
  units: z.number().positive().max(100),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.customerId) {
    return NextResponse.json({ error: "認証されていません" }, { status: 401 });
  }
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
  const monthly = Math.round((plan.unit_amount ?? plan.monthly_amount) * Number(units));

  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from("support_subscriptions")
    .select(
      "id, customer_id, units, monthly_amount, stripe_subscription_item_id, horse:horses(name)",
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

  let sync;
  let syncError: string | null = null;
  try {
    sync = await syncSupportUpdate({
      support_id: params.id,
      stripe_subscription_item_id: (existing as any).stripe_subscription_item_id ?? null,
      monthly_amount: monthly,
      horse_name: horseName,
    });
  } catch (e: any) {
    sync = { synced: false, reason: e?.message ?? "stripe_error" };
    syncError = e?.message ?? "Stripeとの同期に失敗しました";
  }

  const canCommit = sync?.synced || !stripeEnabled;

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

  return NextResponse.json({ ok: true, stripe: sync });
}
