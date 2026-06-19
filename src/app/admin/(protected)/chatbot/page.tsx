import Link from "next/link";
import { requireCapability } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getChatSettings } from "@/lib/chatbot";
import { formatDate } from "@/lib/format";
import ChatbotSettingsForm from "./ChatbotSettingsForm";
import KbForm from "./KbForm";
import KbDeleteButton from "./KbDeleteButton";
import ReindexButton from "./ReindexButton";

export const dynamic = "force-dynamic";

export default async function ChatbotAdminPage() {
  await requireCapability("chatbot.manage");
  const admin = createSupabaseAdminClient();

  const settings = await getChatSettings(admin);
  const apiKey = settings.apiKey ?? "";
  const apiKeyHint = apiKey ? `設定済み（末尾 ${apiKey.slice(-4)}）` : "未設定";

  const [{ data: entries }, { data: embedded }] = await Promise.all([
    admin
      .from("kb_entries")
      .select("id, title, category, is_active, updated_at")
      .order("updated_at", { ascending: false }),
    admin.from("kb_entries").select("id").not("embedding", "is", null),
  ]);
  const embeddedIds = new Set((embedded ?? []).map((e: any) => e.id));
  const list = entries ?? [];
  const missingCount = list.filter((e: any) => !embeddedIds.has(e.id)).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AIチャットボット</h1>
        <p className="text-sm text-ink-mute mt-1">
          OpenAI APIキーとナレッジベースを設定します。ナレッジは保存時に自動で学習（埋め込み生成）され、
          利用者の質問に対して関連情報を検索して回答します。
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="font-bold">基本設定</h2>
        <ChatbotSettingsForm
          initial={{
            chat_enabled: settings.enabled,
            chat_model: settings.chatModel,
            embedding_model: settings.embeddingModel,
            system_prompt: settings.systemPrompt ?? "",
          }}
          apiKeyHint={apiKeyHint}
        />
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">ナレッジベース</h2>
          <ReindexButton missingCount={missingCount} />
        </div>
        {missingCount > 0 && (
          <p className="text-xs text-amber-700">
            ⚠️ 埋め込み未生成のエントリが {missingCount} 件あります。APIキー設定後に「埋め込みを再生成」を実行してください。
          </p>
        )}
        <KbForm />
        <div className="card p-0 overflow-auto">
          <table className="table">
            <thead>
              <tr>
                <th>タイトル</th>
                <th>カテゴリ</th>
                <th>状態</th>
                <th>学習</th>
                <th>更新</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((e: any) => (
                <tr key={e.id}>
                  <td className="font-semibold max-w-xs truncate">{e.title}</td>
                  <td className="text-xs">{e.category}</td>
                  <td className="text-xs">{e.is_active ? "有効" : "無効"}</td>
                  <td className="text-xs">{embeddedIds.has(e.id) ? "✅" : "—"}</td>
                  <td className="text-xs">{formatDate(e.updated_at)}</td>
                  <td className="text-right space-x-2 whitespace-nowrap">
                    <Link href={`/admin/chatbot/${e.id}`} className="text-brand underline text-sm">編集</Link>
                    <KbDeleteButton id={e.id} title={e.title} />
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={6} className="text-center py-6 text-ink-mute">ナレッジはまだありません。</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
