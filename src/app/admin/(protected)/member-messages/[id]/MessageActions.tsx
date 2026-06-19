"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MessageActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const send = async () => {
    if (!confirm(status === "sending" ? "未送信分の配信を続けますか？" : "今すぐ配信しますか？")) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/admin/member-messages/${id}/send`, { method: "POST" });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(j.error ?? "配信に失敗しました。");
      return;
    }
    const r = j.result ?? {};
    setMsg(
      r.remaining > 0
        ? `送信 ${r.sentCount} 件。残り ${r.remaining} 件は予約処理で順次配信されます。`
        : `配信が完了しました（送信 ${r.sentCount} 件）。`,
    );
    router.refresh();
  };

  const remove = async () => {
    if (!confirm("この配信を削除します。よろしいですか？")) return;
    setBusy(true);
    const res = await fetch(`/api/admin/member-messages/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error ?? "削除に失敗しました。");
      return;
    }
    router.push("/admin/member-messages");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status !== "sent" && status !== "canceled" && (
          <button className="btn-primary" disabled={busy} onClick={send}>
            {busy ? "処理中..." : status === "sending" ? "配信を続ける" : "今すぐ配信"}
          </button>
        )}
        <button className="btn-danger" disabled={busy} onClick={remove}>
          削除
        </button>
      </div>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
