import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const patchSchema = z.object({
  full_name: z.string().max(120).optional(),
  full_name_kana: z.string().max(120).optional().nullable(),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional().nullable(),
  postal_code: z.string().max(20).optional().nullable(),
  address1: z.string().max(200).optional().nullable(),
  address2: z.string().max(200).optional().nullable(),
  birthday: z.string().optional().nullable(),
  gender: z.enum(["male", "female", "other", "unspecified"]).optional().nullable(),
  status: z.enum(["active", "suspended", "withdrawn"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "入力が不正です" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("customers").update(parsed.data).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await admin.from("audit_logs").insert({
    actor_id: session.userId,
    action: "customer.update",
    target_table: "customers",
    target_id: params.id,
    meta: parsed.data,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("customers").update({ status: "withdrawn" }).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await admin.from("audit_logs").insert({
    actor_id: session.userId,
    action: "customer.withdraw",
    target_table: "customers",
    target_id: params.id,
  });
  return NextResponse.json({ ok: true });
}
