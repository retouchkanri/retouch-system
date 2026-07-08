import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCapability } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SUPPORT_UNIT_PRICE } from "@/lib/constraints";

const patchSchema = z.object({
  units: z.coerce.number().positive().max(99).optional(),
  horse_id: z.string().uuid().optional(),
  status: z.enum(["active", "past_due", "canceled", "paused", "incomplete"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await requireCapability("supports.manage");
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  }
  const admin = createSupabaseAdminClient();

  const { data: current } = await admin
    .from("support_subscriptions")
    .select("id, units, monthly_amount, status")
    .eq("id", params.id)
    .maybeSingle();
  if (!current) return NextResponse.json({ error: "支援が見つかりません" }, { status: 404 });

  const patch: Record<string, any> = {};
  if (parsed.data.horse_id !== undefined) {
    patch.horse_id = parsed.data.horse_id;
  }
  if (parsed.data.units !== undefined) {
    patch.units = parsed.data.units;
    // 単価は常に SUPPORT_UNIT_PRICE（1口=12,000円）を正とする（route.ts の POST と同じ理由）。
    patch.monthly_amount = Math.round(SUPPORT_UNIT_PRICE * parsed.data.units);
  }
  if (parsed.data.status !== undefined) {
    patch.status = parsed.data.status;
    if (parsed.data.status === "canceled") patch.canceled_at = new Date().toISOString();
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "変更項目がありません" }, { status: 400 });
  }

  const { error } = await admin.from("support_subscriptions").update(patch).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("audit_logs").insert({
    actor_id: session.userId,
    action: "support.update",
    target_table: "support_subscriptions",
    target_id: params.id,
    meta: {
      prev_units: current.units,
      prev_monthly: current.monthly_amount,
      units: patch.units ?? current.units,
      monthly: patch.monthly_amount ?? current.monthly_amount,
      horse_id: patch.horse_id,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await requireCapability("supports.manage");
  const admin = createSupabaseAdminClient();
  const url = new URL(req.url);
  const hard = url.searchParams.get("hard") === "1";

  if (hard) {
    const { error } = await admin.from("support_subscriptions").delete().eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await admin.from("audit_logs").insert({
      actor_id: session.userId,
      action: "support.delete",
      target_table: "support_subscriptions",
      target_id: params.id,
    });
    return NextResponse.json({ ok: true, hard: true });
  }

  const { error } = await admin
    .from("support_subscriptions")
    .update({ status: "canceled", canceled_at: new Date().toISOString() })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("audit_logs").insert({
    actor_id: session.userId,
    action: "support.cancel",
    target_table: "support_subscriptions",
    target_id: params.id,
  });

  return NextResponse.json({ ok: true });
}
