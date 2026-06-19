import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { memberMutationGuard } from "@/lib/memberGuard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notify, profileUpdatedTemplate, staffRecipients } from "@/lib/notify";

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
  const forbidden = memberMutationGuard(session);
  if (forbidden) return forbidden;
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

  // 変更後の会員情報を取得し、会員本人・運営の双方へ通知する。
  // メール送信に失敗しても登録情報の変更自体は成功として扱う。
  const { data: customer } = await supabase
    .from("customers")
    .select("full_name, email")
    .eq("id", session.customerId)
    .maybeSingle();
  const memberEmail = (customer as any)?.email as string | null | undefined;
  const memberName = ((customer as any)?.full_name as string | null) ?? patch.full_name ?? null;

  if (memberEmail) {
    const memberTpl = profileUpdatedTemplate({ name: memberName });
    await notify({
      kind: "profile_updated",
      to: memberEmail,
      to_name: memberName,
      subject: memberTpl.subject,
      body_text: memberTpl.body_text,
      meta: { customer_id: session.customerId, source: "mypage_profile" },
    });
  }

  await notify({
    kind: "staff_notify",
    to: staffRecipients(),
    subject: `【登録情報の変更】${memberName ?? "会員"}`,
    body_text:
      `会員ご本人により登録情報が変更されました。\n\n` +
      `・お名前: ${memberName ?? "—"}\n` +
      `・メール: ${memberEmail ?? "—"}\n` +
      `・変更項目: ${Object.keys(patch).join(", ")}`,
    reply_to: memberEmail ?? undefined,
    meta: { customer_id: session.customerId, source: "mypage_profile" },
  });

  return NextResponse.json({ ok: true });
}
