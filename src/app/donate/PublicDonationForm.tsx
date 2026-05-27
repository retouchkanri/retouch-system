"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatYen } from "@/lib/format";

const PRESETS = [1000, 3000, 5000, 10000, 30000];

export default function PublicDonationForm() {
  const router = useRouter();
  const [amount, setAmount] = useState(3000);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!amount || amount < 100) {
      setError("金額は100円以上で指定してください。");
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("お礼メール送付のため、メールアドレスをご入力ください。");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/donations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount,
          message: message || null,
          donor_name: name || null,
          donor_email: email || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? "処理できませんでした。");
        return;
      }
      if (j.checkout_url) {
        window.location.href = j.checkout_url;
        return;
      }
      router.push("/donate/thanks");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-4">
      <div>
        <label className="label">寄付金額</label>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {PRESETS.map((p) => (
            <button
              type="button"
              key={p}
              onClick={() => setAmount(p)}
              className={`py-3 rounded-xl border-2 font-bold ${
                amount === p ? "bg-brand text-white border-brand" : "bg-white border-surface-line text-ink"
              }`}
            >
              {formatYen(p)}
            </button>
          ))}
        </div>
        <input
          type="number"
          min={100}
          step={100}
          className="input text-lg font-bold text-right"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
      </div>

      <div>
        <label className="label">お名前（任意）</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div>
        <label className="label">
          メールアドレス <span className="text-danger">（必須：お礼メール送付先）</span>
        </label>
        <input
          type="email"
          required
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="example@example.com"
        />
        <p className="text-xs text-ink-mute mt-1">
          寄付確認メールをお送りするため、メールアドレスの入力をお願いしております。
        </p>
      </div>

      <div>
        <label className="label">応援メッセージ（任意）</label>
        <textarea
          className="input"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      {error && <p className="text-danger text-sm">{error}</p>}

      <button className="btn-primary w-full" disabled={saving}>
        {saving ? "処理中..." : "この内容で寄付する"}
      </button>
      <p className="text-xs text-ink-mute">
        Stripe の決済ページへ移動します。カード情報は当サイトでは保存されません。
      </p>
    </form>
  );
}
