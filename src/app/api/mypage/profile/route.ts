import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  full_name: z.string().trim().min(1).max(120),
  full_name_kana: z.string().max(120).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  postal_code: z.string().max(20).optional().nullable(),
  address1: z.string().max(200).optional().nullable(),
  address2: z.string().max(200).optional().nullable(),
  birthday: z.union([z.string(), z.literal("")]).optional().nullable(),
  gender: z.enum(["male", "female", "other", "unspecified"]).optional().nullable(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.customerId) {
    return NextResponse.json({ error: "認証されていません" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const patch = { ...parsed.data };
  if (patch.birthday === "") patch.birthday = null;

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("customers").update(patch).eq("id", session.customerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
