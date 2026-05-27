"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Horse } from "@/types/db";

export default function HorseEditForm({ horse }: { horse: Horse }) {
  const router = useRouter();
  const [form, setForm] = useState<any>({
    name: horse.name ?? "",
    name_kana: horse.name_kana ?? "",
    sex: horse.sex ?? "",
    birth_year: horse.birth_year ?? "",
    profile: horse.profile ?? "",
    is_supportable: horse.is_supportable,
    sort_order: horse.sort_order ?? 100,
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: string) => (e: any) =>
    setForm((p: any) => ({ ...p, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const payload = {
      ...form,
      birth_year: form.birth_year ? Number(form.birth_year) : null,
      sort_order: Number(form.sort_order),
    };
    const res = await fetch(`/api/admin/horses/${horse.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    setMsg(res.ok ? "保存しました。" : "保存に失敗しました。");
    router.refresh();
  };

  return (
    <form onSubmit={save} className="card grid md:grid-cols-4 gap-3 max-w-3xl">
      <div className="md:col-span-2"><label className="label">名前</label><input className="input" value={form.name} onChange={set("name")} required /></div>
      <div><label className="label">カナ</label><input className="input" value={form.name_kana} onChange={set("name_kana")} /></div>
      <div><label className="label">性別</label><input className="input" value={form.sex} onChange={set("sex")} /></div>
      <div><label className="label">生年</label><input type="number" className="input" value={form.birth_year} onChange={set("birth_year")} /></div>
      <div className="md:col-span-3"><label className="label">紹介文</label><input className="input" value={form.profile} onChange={set("profile")} /></div>
      <div><label className="label">並び順</label><input type="number" className="input" value={form.sort_order} onChange={set("sort_order")} /></div>
      <label className="flex items-center gap-2 md:col-span-4">
        <input type="checkbox" checked={form.is_supportable} onChange={set("is_supportable")} className="w-5 h-5" />
        <span>支援受付中</span>
      </label>
      {msg && <p className="text-sm md:col-span-4">{msg}</p>}
      <div className="md:col-span-4"><button className="btn-primary" disabled={busy}>{busy ? "保存中..." : "保存する"}</button></div>
    </form>
  );
}
