import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCapability } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  customer_id: z.string().uuid().optional().nullable(),
  donor_name: z.string().max(120).optional().nullable(),
  donor_email: z.string().email().optional().nullable(),
  amount: z.coerce.number().int().positive(),
  message: z.string().max(1000).optional().nullable(),
  status: z
    .enum(["succeeded", "failed", "pending", "refunded", "canceled"])
    .default("succeeded"),
  payment_method: z.enum(["card", "bank_transfer"]).default("card"),
  confirmed_at: z.string().optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
  donated_at: z.string().datetime().optional(),
});

export async function POST(req: Request) {
  const session = await requireCapability("donations.manage");
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "入力が不正です" },
      { status: 400 },
    );
  }
  const admin = createSupabaseAdminClient();

  let donor_name = parsed.data.donor_name;
  let donor_email = parsed.data.donor_email;
  if (parsed.data.customer_id) {
    const { data: customer } = await admin
      .from("customers")
      .select("full_name, email")
      .eq("id", parsed.data.customer_id)
      .maybeSingle();
    if (customer) {
      donor_name = donor_name ?? (customer.full_name as string);
      donor_email = donor_email ?? (customer.email as string | null);
    }
  }

  const confirmedAt = parsed.data.confirmed_at || null;
  // 銀行振込は入金確認の有無で状態を確定する。
  //   入金確認日なし → 保留 / 入金確認日あり → 成功。
  // （カード・失敗・返金・取消はそのまま尊重する。）
  let status = parsed.data.status;
  if (parsed.data.payment_method === "bank_transfer") {
    if (!confirmedAt && status === "succeeded") status = "pending";
    else if (confirmedAt && status === "pending") status = "succeeded";
  }

  const { data: inserted, error } = await admin
    .from("donations")
    .insert({
      customer_id: parsed.data.customer_id ?? null,
      donor_name: donor_name ?? null,
      donor_email: donor_email ?? null,
      amount: parsed.data.amount,
      message: parsed.data.message ?? null,
      status,
      payment_method: parsed.data.payment_method,
      confirmed_at: confirmedAt,
      note: parsed.data.note ?? null,
      donated_at: parsed.data.donated_at ?? new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !inserted) {
    return NextResponse.json({ error: error?.message ?? "登録に失敗しました" }, { status: 500 });
  }

  if (status === "succeeded") {
    await admin.from("payments").insert({
      customer_id: parsed.data.customer_id ?? null,
      donation_id: inserted.id,
      kind: "donation",
      amount: parsed.data.amount,
      status: "succeeded",
      occurred_at: parsed.data.donated_at ?? new Date().toISOString(),
    });
  }

  await admin.from("audit_logs").insert({
    actor_id: session.userId,
    action: "donation.create",
    target_table: "donations",
    target_id: inserted.id,
    meta: { amount: parsed.data.amount, status },
  });

  return NextResponse.json({ ok: true, id: inserted.id });
}
