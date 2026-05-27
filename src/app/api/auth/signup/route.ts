import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  fullName: z.string().trim().min(1, "お名前を入力してください").max(120),
  email: z.string().trim().email("メールアドレスの形式が正しくありません"),
  password: z.string().min(8, "パスワードは8文字以上で設定してください"),
});

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  let payload: { fullName?: string; email?: string; password?: string };
  let avatarFile: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const fd = await req.formData();
    payload = {
      fullName: String(fd.get("fullName") ?? ""),
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
    };
    const candidate = fd.get("avatar");
    if (candidate instanceof File && candidate.size > 0) avatarFile = candidate;
  } else {
    payload = await req.json().catch(() => ({}));
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "入力に誤りがあります" },
      { status: 400 },
    );
  }
  const { fullName, email, password } = parsed.data;

  if (avatarFile) {
    if (avatarFile.size > MAX_AVATAR_BYTES) {
      return NextResponse.json(
        { error: "画像は5MB以内でアップロードしてください" },
        { status: 400 },
      );
    }
    if (!ALLOWED_AVATAR_TYPES.has(avatarFile.type)) {
      return NextResponse.json(
        { error: "画像はJPEG/PNG/WEBP/GIFのいずれかをご利用ください" },
        { status: 400 },
      );
    }
  }

  const admin = createSupabaseAdminClient();

  const { data: userData, error: userErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (userErr || !userData.user) {
    return NextResponse.json(
      {
        error: userErr?.message.includes("already registered")
          ? "このメールは登録済みです"
          : "会員登録に失敗しました",
      },
      { status: 400 },
    );
  }

  let avatarUrl: string | null = null;
  if (avatarFile) {
    const ext = avatarFile.name.includes(".")
      ? avatarFile.name.slice(avatarFile.name.lastIndexOf(".") + 1).toLowerCase()
      : avatarFile.type.split("/")[1] ?? "jpg";
    const path = `${userData.user.id}/${Date.now()}.${ext}`;
    const buffer = Buffer.from(await avatarFile.arrayBuffer());
    const { error: upErr } = await admin.storage
      .from("avatars")
      .upload(path, buffer, { contentType: avatarFile.type, upsert: true });
    if (!upErr) {
      const { data: pub } = admin.storage.from("avatars").getPublicUrl(path);
      avatarUrl = pub.publicUrl;
    }
  }

  const { data: existing } = await admin
    .from("customers")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  let customerId: string;
  if (existing?.id) {
    customerId = existing.id;
    await admin
      .from("customers")
      .update({
        auth_user_id: userData.user.id,
        full_name: fullName,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      })
      .eq("id", existing.id);
  } else {
    const { data: created, error: cErr } = await admin
      .from("customers")
      .insert({
        full_name: fullName,
        email,
        auth_user_id: userData.user.id,
        avatar_url: avatarUrl,
        status: "active",
      })
      .select("id")
      .single();
    if (cErr || !created) {
      return NextResponse.json({ error: "会員データ作成に失敗しました" }, { status: 500 });
    }
    customerId = created.id;
  }

  await admin.from("profiles").upsert({
    id: userData.user.id,
    role: "member",
    customer_id: customerId,
  });

  return NextResponse.json({ ok: true });
}
