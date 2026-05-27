"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Customer } from "@/types/db";

export default function ProfileForm({ customer }: { customer: Customer }) {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: customer.full_name ?? "",
    full_name_kana: customer.full_name_kana ?? "",
    phone: customer.phone ?? "",
    postal_code: customer.postal_code ?? "",
    address1: customer.address1 ?? "",
    address2: customer.address2 ?? "",
    birthday: customer.birthday ?? "",
    gender: customer.gender ?? "unspecified",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [k]: e.target.value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    setMsg(null);
    const res = await fetch("/api/mypage/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const j = await res.json();
    setSaving(false);
    if (!res.ok) {
      setErr(j.error ?? "保存できませんでした。");
      return;
    }
    setMsg("変更内容を保存しました。");
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      <div>
        <label className="label">お名前</label>
        <input className="input" value={form.full_name} onChange={set("full_name")} required />
      </div>
      <div>
        <label className="label">お名前（カナ）</label>
        <input className="input" value={form.full_name_kana} onChange={set("full_name_kana")} />
      </div>
      <div>
        <label className="label">電話番号</label>
        <input className="input" value={form.phone} onChange={set("phone")} />
      </div>
      <div>
        <label className="label">郵便番号</label>
        <input className="input" value={form.postal_code} onChange={set("postal_code")} />
      </div>
      <div>
        <label className="label">住所</label>
        <input className="input mb-2" placeholder="都道府県・市区町村・番地" value={form.address1} onChange={set("address1")} />
        <input className="input" placeholder="建物名・部屋番号など" value={form.address2} onChange={set("address2")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">生年月日</label>
          <input type="date" className="input" value={form.birthday} onChange={set("birthday")} />
        </div>
        <div>
          <label className="label">性別</label>
          <select className="input" value={form.gender} onChange={set("gender")}>
            <option value="unspecified">未回答</option>
            <option value="male">男性</option>
            <option value="female">女性</option>
            <option value="other">その他</option>
          </select>
        </div>
      </div>
      {msg && <p className="text-ok text-sm font-semibold">{msg}</p>}
      {err && <p className="text-danger text-sm font-semibold">{err}</p>}
      <button className="btn-primary w-full" disabled={saving}>
        {saving ? "保存中..." : "変更内容を保存する"}
      </button>
    </form>
  );
}
