import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCapability } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isBasicMemberPlanCode } from "@/lib/constraints";

const schema = z.object({
  // 顧客ID（UUID）またはメールアドレスのどちらでも受け付ける。
  customer_id: z.string().trim().min(1),
  horse_id: z.string().uuid(),
  units: z.coerce.number().positive().max(99),
  unit_amount: z.coerce.number().int().positive().optional(),
});

export async function POST(req: Request) {
  const session = await requireCapability("supports.manage");
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "入力が不正です" },
      { status: 400 },
    );
  }
  const { horse_id, units, unit_amount } = parsed.data;
  const admin = createSupabaseAdminClient();

  // 入力された識別子から顧客を特定する。
  //   - UUID形式 → 顧客ID（customers.id）で照合
  //   - "@" を含む → メールアドレスで大文字小文字を無視して照合
  //   - それ以外 → 入力不正
  const identifier = parsed.data.customer_id.trim();
  let resolvedId: string | null = null;
  if (z.string().uuid().safeParse(identifier).success) {
    const { data } = await admin
      .from("customers")
      .select("id")
      .eq("id", identifier)
      .maybeSingle();
    resolvedId = data?.id ?? null;
  } else if (identifier.includes("@")) {
    // ilike のワイルドカード(%/_)とエスケープ文字(\)をリテラル化し、完全一致で照合する。
    const escaped = identifier.replace(/([\\%_])/g, "\\$1");
    const { data } = await admin
      .from("customers")
      .select("id")
      .ilike("email", escaped)
      .limit(2);
    if (data && data.length > 1) {
      return NextResponse.json(
        { error: "同じメールアドレスの顧客が複数登録されています。顧客IDで指定してください。" },
        { status: 409 },
      );
    }
    resolvedId = data?.[0]?.id ?? null;
  } else {
    return NextResponse.json(
      { error: "顧客IDまたはメールアドレスを入力してください" },
      { status: 400 },
    );
  }
  if (!resolvedId) {
    return NextResponse.json({ error: "顧客が見つかりません" }, { status: 404 });
  }
  const customer_id = resolvedId;

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
    .select("id, plan_id, plan:membership_plans(code)")
    .eq("customer_id", customer_id)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const existingPlanCode = (existingContract as any)?.plan?.code as string | undefined;
  if (existingPlanCode && isBasicMemberPlanCode(existingPlanCode)) {
    return NextResponse.json(
      { error: "基本会員区分の契約が有効です。先に契約を停止してから支援を追加してください。" },
      { status: 409 },
    );
  }

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
