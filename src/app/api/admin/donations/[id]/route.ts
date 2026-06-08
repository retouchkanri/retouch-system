import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCapability } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const patchSchema = z.object({
  amount: z.coerce.number().int().positive().optional(),
  message: z.string().max(1000).optional().nullable(),
  status: z
    .enum(["succeeded", "failed", "pending", "refunded", "canceled"])
    .optional(),
  donor_name: z.string().max(120).optional().nullable(),
  donor_email: z.string().email().optional().nullable(),
  payment_method: z.enum(["card", "bank_transfer"]).optional(),
  confirmed_at: z.string().optional().nullable(),
  donated_at: z.string().optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await requireCapability("donations.manage");
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  }
  const admin = createSupabaseAdminClient();

  // 既存レコードを取得し、部分更新後の最終状態で銀行振込の整合性を確定する。
  const { data: existing } = await admin
    .from("donations")
    .select("customer_id, amount, status, payment_method, confirmed_at, donated_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "寄付が見つかりません" }, { status: 404 });

  const patch: Record<string, unknown> = { ...parsed.data };
  if (patch.confirmed_at === "") patch.confirmed_at = null;
  // 日時（寄付日）: 日付(YYYY-MM-DD)を受け取り、JST正午のタイムスタンプとして保存。
  // donated_at は NOT NULL なので、空のときは更新対象から外す。
  if (typeof patch.donated_at === "string" && patch.donated_at.trim() !== "") {
    const d = patch.donated_at.trim();
    patch.donated_at = /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00+09:00` : d;
  } else {
    delete patch.donated_at;
  }

  // 部分更新をマージした最終状態。
  const method = (patch.payment_method ?? (existing as any).payment_method) as string;
  const confirmedAt = ("confirmed_at" in patch ? patch.confirmed_at : (existing as any).confirmed_at) as
    | string
    | null;
  let status = (patch.status ?? (existing as any).status) as string;
  // 銀行振込は入金確認の有無で状態を確定（成功⇔保留のみ。失敗・返金・取消は尊重）。
  if (method === "bank_transfer") {
    if (!confirmedAt && status === "succeeded") status = "pending";
    else if (confirmedAt && status === "pending") status = "succeeded";
  }
  patch.status = status;

  const { error } = await admin.from("donations").update(patch).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 収益(payments)との整合：成功になったら寄付の決済行を1件だけ用意し、
  // 成功でなくなったらその寄付の決済行を取り除く（二重計上・計上漏れ防止）。
  if (status === "succeeded") {
    const { data: existingPay } = await admin
      .from("payments")
      .select("id")
      .eq("donation_id", params.id)
      .limit(1)
      .maybeSingle();
    if (!existingPay) {
      const amount = (patch.amount ?? (existing as any).amount) as number;
      const occurredAt = (patch.donated_at ?? (existing as any).donated_at ?? new Date().toISOString()) as string;
      await admin.from("payments").insert({
        customer_id: (existing as any).customer_id ?? null,
        donation_id: params.id,
        kind: "donation",
        amount,
        status: "succeeded",
        occurred_at: occurredAt,
      });
    }
  } else {
    await admin.from("payments").delete().eq("donation_id", params.id);
  }

  await admin.from("audit_logs").insert({
    actor_id: session.userId,
    action: "donation.update",
    target_table: "donations",
    target_id: params.id,
    meta: { ...parsed.data, status },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await requireCapability("donations.manage");
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("donations").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("audit_logs").insert({
    actor_id: session.userId,
    action: "donation.delete",
    target_table: "donations",
    target_id: params.id,
  });

  return NextResponse.json({ ok: true });
}
