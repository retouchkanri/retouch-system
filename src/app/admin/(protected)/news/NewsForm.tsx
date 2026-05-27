"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const TAG_PRESETS = [
  { tag: "お知らせ", color: "bg-brand-50 text-brand-dark" },
  { tag: "イベント", color: "bg-amber-50 text-amber-800" },
  { tag: "リリース", color: "bg-blue-50 text-blue-700" },
  { tag: "メディア", color: "bg-purple-50 text-purple-700" },
];

export default function NewsForm({ initial, id }: { initial?: any; id?: string }) {
  const router = useRouter();
  const start = initial ?? {
    title: "",
    body: "",
    tag: "お知らせ",
    tag_color: "bg-brand-50 text-brand-dark",
    image_url: "",
    published_at: "",
    is_published: true,
    sort_order: 0,
  };
  const [form, setForm] = useState<any>(start);
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
      sort_order: Number(form.sort_order),
    };
    const res = await fetch(id ? `/api/admin/news/${id}` : "/api/admin/news", {
      method: id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error ?? "保存できませんでした。");
      return;
    }
    setMsg("保存しました。");
    if (!id) setForm(start);
    router.refresh();
  };

  const toLocal = (v: string) => (v ? new Date(v).toISOString().slice(0, 16) : "");

  return (
    <form onSubmit={save} className="card grid md:grid-cols-4 gap-3">
      <div className="md:col-span-3">
        <label className="label">タイトル</label>
        <input className="input" value={form.title} onChange={set("title")} required maxLength={200} />
      </div>
      <div>
        <label className="label">タグ</label>
        <select
          className="input"
          value={form.tag}
          onChange={(e) => {
            const preset = TAG_PRESETS.find((p) => p.tag === e.target.value);
            setForm((p: any) => ({
              ...p,
              tag: e.target.value,
              tag_color: preset?.color ?? p.tag_color,
            }));
          }}
        >
          {TAG_PRESETS.map((p) => (
            <option key={p.tag} value={p.tag}>{p.tag}</option>
          ))}
        </select>
      </div>
      <div className="md:col-span-4">
        <label className="label">本文</label>
        <textarea rows={3} className="input" value={form.body ?? ""} onChange={set("body")} maxLength={2000} />
      </div>
      <div className="md:col-span-2">
        <label className="label">画像URL</label>
        <input className="input" value={form.image_url ?? ""} onChange={set("image_url")} placeholder="https://images.unsplash.com/..." />
      </div>
      <div>
        <label className="label">公開日時</label>
        <input type="datetime-local" className="input" value={toLocal(form.published_at)} onChange={(e) => setForm((p: any) => ({ ...p, published_at: e.target.value }))} />
      </div>
      <div>
        <label className="label">表示順</label>
        <input type="number" className="input" value={form.sort_order} onChange={set("sort_order")} min={0} />
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" className="w-5 h-5" checked={form.is_published} onChange={set("is_published")} />
        <span>公開する</span>
      </label>
      {msg && <p className="md:col-span-4 text-sm">{msg}</p>}
      <div className="md:col-span-4">
        <button className="btn-primary" disabled={busy}>{busy ? "保存中..." : id ? "保存する" : "ニュースを登録"}</button>
      </div>
    </form>
  );
}
