import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  customer_id: z.string().uuid(),
  horse_id: z.string().uuid(),
  units: z.coerce.number().positive().max(99),
  unit_amount: z.coerce.number().int().positive().optional(),
});

export async function POST(req: Request) {
  const session = await requireAdmin();
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "入力が不正です" },
      { status: 400 },
    );
  }
  const { customer_id, horse_id, units, unit_amount } = parsed.data;
  const admin = createSupabaseAdminClient();

  const { data: customer } = await admin
    .from("customers")
    .select("id")
    .eq("id", customer_id)
    .maybeSingle();
  if (!customer) {
    return NextResponse.json({ error: "顧客が見つかりません" }, { status: 404 });
  }

  const { data: horse } = await admin
    .from("horses")
    .select("id, is_supportable")
    .eq("id", horse_id)
    .maybeSingle();
  if (!horse) return NextResponse.json({ error: "馬が見つかりません" }, { status: 404 });
  if (!horse.is_supportable) {
    return NextResponse.json({ error: "この馬は支援対象外です" }, { status: 400 });
  }

  const { data: existingContract } = await admin
    .from("contracts")
    .select("id, plan_id")
    .eq("customer_id", customer_id)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let contractId = existingContract?.id as string | undefined;
  if (!contractId) {
    const { data: supportPlan } = await admin
      .from("membership_plans")
      .select("id")
      .eq("code", "SUPPORT")
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    const { data: created, error: cErr } = await admin
      .from("contracts")
      .insert({
        customer_id,
        plan_id: supportPlan?.id ?? null,
        status: "active",
      })
      .select("id")
      .single();
    if (cErr || !created) {
      return NextResponse.json({ error: "契約作成に失敗しました" }, { status: 500 });
    }
    contractId = created.id;
  }

  const effectiveUnitAmount = unit_amount ?? 12000;
  const monthlyAmount = Math.round(effectiveUnitAmount * units);

  const { data: inserted, error: insErr } = await admin
    .from("support_subscriptions")
    .insert({
      contract_id: contractId,
      customer_id,
      horse_id,
      units,
      monthly_amount: monthlyAmount,
      status: "active",
    })
    .select("id")
    .single();
  if (insErr || !inserted) {
    return NextResponse.json({ error: insErr?.message ?? "登録に失敗しました" }, { status: 500 });
  }

  await admin.from("audit_logs").insert({
    actor_id: session.userId,
    action: "support.create",
    target_table: "support_subscriptions",
    target_id: inserted.id,
    meta: { customer_id, horse_id, units, monthly_amount: monthlyAmount },
  });

  return NextResponse.json({ ok: true, id: inserted.id });
}
