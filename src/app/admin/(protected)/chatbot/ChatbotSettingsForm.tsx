"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ChatbotSettingsForm({ initialPrompt }: { initialPrompt: string }) {
  const router = useRouter();
  const [content, setContent] = useState(initialPrompt);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/chatbot/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ system_prompt: content }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error ?? "保存できませんでした。");
      return;
    }
    setMsg("保存しました。");
    router.refresh();
  };

  return (
    <form onSubmit={save} className="card space-y-3">
      <textarea
        className="input"
        rows={6}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="チャットボットへの補足指示や情報を入力（任意）"
        maxLength={8000}
      />
      {msg && <p className="text-sm">{msg}</p>}
      <button className="btn-primary" type="submit" disabled={busy}>
        {busy ? "保存中..." : "保存"}
      </button>
    </form>
  );
}
