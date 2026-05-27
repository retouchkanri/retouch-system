import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
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
  donated_at: z.string().datetime().optional(),
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

  const { data: inserted, error } = await admin
    .from("donations")
    .insert({
      customer_id: parsed.data.customer_id ?? null,
      donor_name: donor_name ?? null,
      donor_email: donor_email ?? null,
      amount: parsed.data.amount,
      message: parsed.data.message ?? null,
      status: parsed.data.status,
      donated_at: parsed.data.donated_at ?? new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !inserted) {
    return NextResponse.json({ error: error?.message ?? "登録に失敗しました" }, { status: 500 });
  }

  if (parsed.data.status === "succeeded") {
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
    meta: { amount: parsed.data.amount, status: parsed.data.status },
  });

  return NextResponse.json({ ok: true, id: inserted.id });
}
