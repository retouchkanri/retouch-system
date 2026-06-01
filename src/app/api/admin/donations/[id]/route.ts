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
  note: z.string().max(1000).optional().nullable(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await requireCapability("donations.manage");
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  }
  const admin = createSupabaseAdminClient();
  const patch: Record<string, unknown> = { ...parsed.data };
  if (patch.confirmed_at === "") patch.confirmed_at = null;
  const { error } = await admin.from("donations").update(patch).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("audit_logs").insert({
    actor_id: session.userId,
    action: "donation.update",
    target_table: "donations",
    target_id: params.id,
    meta: parsed.data,
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
