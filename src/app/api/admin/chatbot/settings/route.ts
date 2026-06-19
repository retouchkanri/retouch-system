import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCapability } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { SETTING_KEYS } from "@/lib/chatbot";

const schema = z.object({
  // 空文字なら既存キーを維持（変更しない）。
  openai_api_key: z.string().optional(),
  chat_model: z.string().trim().max(100).optional(),
  embedding_model: z.string().trim().max(100).optional(),
  chat_enabled: z.boolean().optional(),
  system_prompt: z.string().max(8000).optional().nullable(),
});

export async function POST(req: Request) {
  const session = await requireCapability("chatbot.manage");
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "入力が不正です" }, { status: 400 });
  }
  const d = parsed.data;
  const admin = createSupabaseAdminClient();

  const rows: { key: string; value: string | null }[] = [];
  // APIキーは入力があった場合のみ更新（マスキング表示のため空送信＝据え置き）。
  if (typeof d.openai_api_key === "string" && d.openai_api_key.trim() !== "") {
    rows.push({ key: SETTING_KEYS.apiKey, value: d.openai_api_key.trim() });
  }
  if (d.chat_model !== undefined) rows.push({ key: SETTING_KEYS.chatModel, value: d.chat_model || null });
  if (d.embedding_model !== undefined) rows.push({ key: SETTING_KEYS.embeddingModel, value: d.embedding_model || null });
  if (d.chat_enabled !== undefined) rows.push({ key: SETTING_KEYS.enabled, value: d.chat_enabled ? "true" : "false" });
  if (d.system_prompt !== undefined) rows.push({ key: SETTING_KEYS.systemPrompt, value: d.system_prompt || null });

  for (const r of rows) {
    const { error } = await admin
      .from("app_settings")
      .upsert(
        { key: r.key, value: r.value, updated_by: session.userId, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writeAudit({
    actorId: session.userId,
    action: "setting.chatbot_update",
    targetTable: "app_settings",
    // APIキーの値は監査ログにも残さない。
    meta: {
      updated_keys: rows.map((r) => r.key),
      api_key_changed: rows.some((r) => r.key === SETTING_KEYS.apiKey),
    },
  });

  return NextResponse.json({ ok: true });
}
