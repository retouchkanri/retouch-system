import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const patchSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  full_name: z.string().max(120).optional(),
  full_name_kana: z.string().max(120).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  role: z.enum(["member", "staff", "admin"]).optional(),
  status: z.enum(["active", "suspended", "withdrawn"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  }
  const admin = createSupabaseAdminClient();
  const { email, password, full_name, full_name_kana, phone, role, status } = parsed.data;

  const authUpdate: Record<string, any> = {};
  if (email) authUpdate.email = email;
  if (password) authUpdate.password = password;
  if (Object.keys(authUpdate).length > 0) {
    const { error } = await admin.auth.admin.updateUserById(params.id, authUpdate);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (role) {
    await admin.from("profiles").upsert({ id: params.id, role });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("customer_id")
    .eq("id", params.id)
    .maybeSingle();
  const customerId = (profile?.customer_id as string | null) ?? null;

  const custPatch: Record<string, any> = {};
  if (full_name !== undefined) custPatch.full_name = full_name;
  if (full_name_kana !== undefined) custPatch.full_name_kana = full_name_kana;
  if (phone !== undefined) custPatch.phone = phone;
  if (status !== undefined) custPatch.status = status;
  if (email) custPatch.email = email;

  if (customerId && Object.keys(custPatch).length > 0) {
    const { error } = await admin.from("customers").update(custPatch).eq("id", customerId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await admin.from("audit_logs").insert({
    actor_id: session.userId,
    action: "user.update",
    target_table: "auth.users",
    target_id: params.id,
    meta: { role, status, emailChanged: !!email, passwordChanged: !!password },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (session.userId === params.id) {
    return NextResponse.json({ error: "自分自身は削除できません" }, { status: 400 });
  }
  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.deleteUser(params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await admin.from("audit_logs").insert({
    actor_id: session.userId,
    action: "user.delete",
    target_table: "auth.users",
    target_id: params.id,
  });
  return NextResponse.json({ ok: true });
}
