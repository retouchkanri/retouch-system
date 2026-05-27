import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const admin = createSupabaseAdminClient();
  const payload: any = {};
  for (const key of ["name","name_kana","sex","birth_year","profile","is_supportable","sort_order","image_url"]) {
    if (key in body) payload[key] = body[key];
  }
  const { error } = await admin.from("horses").update(payload).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("horses").update({ is_supportable: false }).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
