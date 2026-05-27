"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type DonationView = {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string;
  donor_name: string;
  donor_email: string;
  amount: number;
  amount_label: string;
  status: string;
  status_label: string;
  message: string;
  donated_at: string;
};

export default function DonationRow({ donation, index }: { donation: DonationView; index: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(donation.amount));
  const [status, setStatus] = useState(donation.status);
  const [donorName, setDonorName] = useState(donation.donor_name);
  const [donorEmail, setDonorEmail] = useState(donation.donor_email);
  const [message, setMessage] = useState(donation.message);

  const save = async () => {
    setBusy(true);
    const payload: Record<string, unknown> = {
      amount: Number(amount),
      status,
      donor_name: donorName || null,
      message: message || null,
    };
    if (donorEmail) payload.donor_email = donorEmail;
    const res = await fetch(`/api/admin/donations/${donation.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "保存できませんでした");
      return;
    }
    setEditing(false);
    router.refresh();
  };

  const remove = async () => {
    if (!confirm("この寄付レコードを削除しますか？")) return;
    setBusy(true);
    const res = await fetch(`/api/admin/donations/${donation.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "削除できませんでした");
      return;
    }
    router.refresh();
  };

  return (
    <>
      <tr>
        <td className="text-right text-ink-mute tabular-nums">{index}</td>
        <td className="whitespace-nowrap">{donation.donated_at}</td>
        <td>
          {donation.donor_name || <span className="text-ink-mute">匿名</span>}
          <div className="text-xs text-ink-mute">{donation.donor_email}</div>
        </td>
        <td>
          {donation.customer_id ? (
            <Link href={`/admin/customers/${donation.customer_id}`} className="text-brand underline">
              {donation.customer_name}
            </Link>
          ) : (
            <span className="text-ink-mute">—</span>
          )}
        </td>
        <td>{donation.amount_label}</td>
        <td>{donation.status_label}</td>
        <td className="text-xs max-w-[260px] truncate" title={donation.message}>
          {donation.message || "—"}
        </td>
        <td className="text-right whitespace-nowrap">
          <button className="text-brand underline text-sm mr-3" onClick={() => setEditing((v) => !v)}>
            編集
          </button>
          <button className="text-danger underline text-sm" onClick={remove} disabled={busy}>
            削除
          </button>
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={8} className="bg-surface-soft">
            <div className="p-3 grid sm:grid-cols-4 gap-3">
              <div>
                <label className="label">金額</label>
                <input type="number" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <label className="label">状態</label>
                <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="succeeded">成功</option>
                  <option value="pending">保留</option>
                  <option value="failed">失敗</option>
                  <option value="refunded">返金済</option>
                  <option value="canceled">取消</option>
                </select>
              </div>
              <div>
                <label className="label">寄付者名</label>
                <input className="input" value={donorName} onChange={(e) => setDonorName(e.target.value)} />
              </div>
              <div>
                <label className="label">寄付者メール</label>
                <input type="email" className="input" value={donorEmail} onChange={(e) => setDonorEmail(e.target.value)} />
              </div>
              <div className="sm:col-span-4">
                <label className="label">メッセージ</label>
                <textarea className="input" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
              </div>
              <div className="sm:col-span-4 flex gap-2">
                <button className="btn-primary" onClick={save} disabled={busy}>
                  保存
                </button>
                <button className="btn-ghost" onClick={() => setEditing(false)}>
                  閉じる
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
