"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ChatbotSettingsForm({
  initial,
  apiKeyHint,
}: {
  initial: { chat_enabled: boolean; chat_model: string; embedding_model: string; system_prompt: string };
  apiKeyHint: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ ...initial, openai_api_key: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const set = (k: string) => (e: any) =>
    setForm((p) => ({ ...p, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/chatbot/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_enabled: form.chat_enabled,
        chat_model: form.chat_model,
        embedding_model: form.embedding_model,
        system_prompt: form.system_prompt,
        // 空なら据え置き（送らない）
        ...(form.openai_api_key.trim() ? { openai_api_key: form.openai_api_key.trim() } : {}),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error ?? "保存できませんでした。");
      return;
    }
    setMsg("保存しました。");
    setForm((p) => ({ ...p, openai_api_key: "" }));
    router.refresh();
  };

  return (
    <form onSubmit={save} className="card space-y-3">
      <label className="flex items-center gap-2">
        <input type="checkbox" className="w-5 h-5" checked={form.chat_enabled} onChange={set("chat_enabled")} />
        <span className="font-semibold">AIチャットを有効にする</span>
      </label>

      <div>
        <label className="label">OpenAI APIキー（現在: {apiKeyHint}）</label>
        <input
          type="password"
          className="input"
          value={form.openai_api_key}
          onChange={set("openai_api_key")}
          placeholder="変更する場合のみ入力（sk-...）"
          autoComplete="off"
        />
        <p className="text-xs text-ink-mute mt-1">キーはサーバー側に保存され、画面には再表示されません。</p>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="label">チャットモデル</label>
          <input className="input" value={form.chat_model} onChange={set("chat_model")} placeholder="gpt-4o-mini" />
          <p className="text-xs text-ink-mute mt-1">推奨: gpt-4o-mini（低価格・高精度）。</p>
        </div>
        <div>
          <label className="label">埋め込みモデル</label>
          <input className="input" value={form.embedding_model} onChange={set("embedding_model")} placeholder="text-embedding-3-small" />
          <p className="text-xs text-ink-mute mt-1">推奨: text-embedding-3-small（1536次元）。</p>
        </div>
      </div>

      <div>
        <label className="label">システムプロンプト（任意・補足指示）</label>
        <textarea className="input" rows={4} value={form.system_prompt} onChange={set("system_prompt")} placeholder="AIへ伝えたい補足情報や指示があれば入力（例: ホームページURL、特記事項など）。基本の役割・口調・回答ルールは常に適用されます。" />
        <p className="text-xs text-ink-mute mt-1">
          ここに入力した内容は基本指示に<strong>追記</strong>されます（上書きではありません）。空欄でも正しく動作します。
        </p>
      </div>

      {msg && <p className="text-sm">{msg}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? "保存中..." : "設定を保存"}</button>
    </form>
  );
}
