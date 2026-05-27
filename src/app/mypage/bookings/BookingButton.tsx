"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BookingButton({
  eventId,
  disabled,
  cancel,
  edit,
  initialPartySize,
  initialNote,
  maxPartySize = 20,
}: {
  eventId: string;
  disabled?: boolean;
  cancel?: boolean;
  edit?: boolean;
  initialPartySize?: number;
  initialNote?: string | null;
  maxPartySize?: number;
}) {
  const router = useRouter();
  const max = Math.max(1, Math.min(20, maxPartySize));
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [partySize, setPartySize] = useState(
    Math.max(1, Math.min(max, initialPartySize ?? 1)),
  );
  const [note, setNote] = useState(initialNote ?? "");
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setErr(null);
    const method = cancel ? "DELETE" : edit ? "PATCH" : "POST";
    const res = await fetch("/api/mypage/bookings", {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event_id: eventId,
        ...(cancel ? {} : { party_size: partySize, note: note || null }),
      }),
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(j.error ?? "処理できませんでした");
      return;
    }
    setOpen(false);
    router.refresh();
  };

  if (cancel) {
    return (
      <button
        onClick={() => {
          if (!confirm("予約をキャンセルしますか？")) return;
          run();
        }}
        disabled={disabled || busy}
        className="btn-ghost !py-1.5 !px-3 text-danger"
      >
        {busy ? "処理中..." : "キャンセル"}
      </button>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={disabled || busy}
        className={edit ? "btn-ghost !py-1.5 !px-3" : "btn-primary !py-2 !px-4"}
      >
        {edit ? "内容変更" : "予約する"}
      </button>
    );
  }

  return (
    <div className="w-full space-y-2 p-3 border-2 border-surface-line rounded-xl bg-surface-soft">
      <div>
        <label className="label">
          人数 <span className="text-ink-mute font-normal">（最大 {max} 名）</span>
        </label>
        <input
          type="number"
          min={1}
          max={max}
          className="input"
          value={partySize}
          onChange={(e) =>
            setPartySize(Math.max(1, Math.min(max, Number(e.target.value) || 1)))
          }
        />
      </div>
      <div>
        <label className="label">メモ（アレルギー等）</label>
        <textarea
          className="input"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      {err && <p className="text-danger text-sm">{err}</p>}
      <div className="flex gap-2">
        <button className="btn-ghost flex-1" onClick={() => setOpen(false)} disabled={busy}>
          戻る
        </button>
        <button className="btn-primary flex-1" onClick={run} disabled={busy}>
          {busy ? "処理中..." : edit ? "変更を保存" : "予約を確定"}
        </button>
      </div>
    </div>
  );
}
