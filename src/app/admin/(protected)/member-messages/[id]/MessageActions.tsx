"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendMemberMessageUntilDone, type SendProgress } from "@/lib/memberMessagesClient";

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
  const [progress, setProgress] = useState<SendProgress | null>(null);

  const send = async () => {
    if (!confirm(status === "sending" ? "未送信分の配信を続けますか？" : "今すぐ配信しますか？（件数の上限はありません。完了まで自動的に配信を続けます）")) return;
    setBusy(true);
    setMsg(null);
    setProgress(null);

    const result = await sendMemberMessageUntilDone(id, (p) => {
      setProgress(p);
      setMsg(
        p.recipientCount > 0
          ? `配信中… ${p.sentCount} / ${p.recipientCount} 件送信済み`
          : `配信中… ${p.sentCount} 件送信済み`,
      );
    });

    setBusy(false);
    if (!result.ok) {
      setMsg(result.error ?? "配信に失敗しました。");
      router.refresh();
      return;
    }
    if (result.finished) {
      setMsg(`配信が完了しました（送信 ${result.progress.sentCount} 件）。`);
    } else {
      setMsg(
        `送信 ${result.progress.sentCount} 件まで完了しましたが処理が長時間に及んだため中断しました。もう一度「配信を続ける」を押すか、しばらく待つと自動配信（cron）が続きを送信します。残り ${result.progress.remaining} 件。`,
      );
    }
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
            {busy ? "配信中…" : status === "sending" ? "配信を続ける" : "今すぐ配信（全件・件数無制限）"}
          </button>
        )}
        <button className="btn-danger" disabled={busy} onClick={remove}>
          削除
        </button>
      </div>
      {busy && progress && progress.recipientCount > 0 && (
        <div className="w-full max-w-md h-2 rounded-full bg-surface-soft overflow-hidden">
          <div
            className="h-full bg-brand transition-all"
            style={{ width: `${Math.min(100, Math.round((progress.sentCount / progress.recipientCount) * 100))}%` }}
          />
        </div>
      )}
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
