"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DonationForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    customer_id: "",
    donor_name: "",
    donor_email: "",
    amount: "3000",
    message: "",
    status: "succeeded" as "succeeded" | "pending" | "failed" | "refunded",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value as any }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const payload: Record<string, unknown> = {
      amount: Number(form.amount),
      status: form.status,
      message: form.message || null,
      donor_name: form.donor_name || null,
    };
    if (form.customer_id) payload.customer_id = form.customer_id;
    if (form.donor_email) payload.donor_email = form.donor_email;
    const res = await fetch("/api/admin/donations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(j.error ?? "登録できませんでした。");
      return;
    }
    setMsg("登録しました。");
    setForm({
      customer_id: "",
      donor_name: "",
      donor_email: "",
      amount: "3000",
      message: "",
      status: "succeeded",
    });
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="grid md:grid-cols-4 gap-3">
      <div>
        <label className="label">顧客ID（任意）</label>
        <input className="input font-mono text-xs" value={form.customer_id} onChange={set("customer_id")} placeholder="UUID" />
      </div>
      <div>
        <label className="label">寄付者名</label>
        <input className="input" value={form.donor_name} onChange={set("donor_name")} />
      </div>
      <div>
        <label className="label">寄付者メール</label>
        <input type="email" className="input" value={form.donor_email} onChange={set("donor_email")} />
      </div>
      <div>
        <label className="label">金額（円）</label>
        <input type="number" className="input" value={form.amount} onChange={set("amount")} min={100} />
      </div>
      <div>
        <label className="label">状態</label>
        <select className="input" value={form.status} onChange={set("status")}>
          <option value="succeeded">成功</option>
          <option value="pending">保留</option>
          <option value="failed">失敗</option>
          <option value="refunded">返金済</option>
        </select>
      </div>
      <div className="md:col-span-3">
        <label className="label">メッセージ</label>
        <input className="input" value={form.message} onChange={set("message")} />
      </div>
      {msg && <p className="md:col-span-4 text-sm">{msg}</p>}
      <div className="md:col-span-4">
        <button className="btn-primary" disabled={busy}>
          {busy ? "登録中..." : "寄付を追加"}
        </button>
      </div>
    </form>
  );
}
