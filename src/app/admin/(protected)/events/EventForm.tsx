"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EventForm({ initial, id }: { initial?: any; id?: string }) {
  const router = useRouter();
  const start = initial ?? {
    type: "visit",
    title: "",
    description: "",
    starts_at: "",
    ends_at: "",
    capacity: 10,
    location: "",
    supporters_only: false,
    is_published: true,
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
      capacity: Number(form.capacity),
    };
    const res = await fetch(id ? `/api/admin/events/${id}` : "/api/admin/events", {
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
        <input className="input" value={form.title} onChange={set("title")} required />
      </div>
      <div>
        <label className="label">種別</label>
        <select className="input" value={form.type} onChange={set("type")}>
          <option value="visit">見学会</option>
          <option value="private_visit">個別見学</option>
        </select>
      </div>
      <div>
        <label className="label">開始日時</label>
        <input type="datetime-local" className="input" value={toLocal(form.starts_at)} onChange={(e) => setForm((p: any) => ({ ...p, starts_at: e.target.value }))} required />
      </div>
      <div>
        <label className="label">終了日時</label>
        <input type="datetime-local" className="input" value={toLocal(form.ends_at)} onChange={(e) => setForm((p: any) => ({ ...p, ends_at: e.target.value }))} />
      </div>
      <div>
        <label className="label">定員</label>
        <input type="number" className="input" value={form.capacity} onChange={set("capacity")} min={0} />
      </div>
      <div>
        <label className="label">場所</label>
        <input className="input" value={form.location ?? ""} onChange={set("location")} />
      </div>
      <div className="md:col-span-4">
        <label className="label">説明</label>
        <textarea rows={2} className="input" value={form.description ?? ""} onChange={set("description")} />
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" className="w-5 h-5" checked={form.supporters_only} onChange={set("supporters_only")} />
        <span>支援者限定</span>
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" className="w-5 h-5" checked={form.is_published} onChange={set("is_published")} />
        <span>公開する</span>
      </label>
      {msg && <p className="md:col-span-4 text-sm">{msg}</p>}
      <div className="md:col-span-4"><button className="btn-primary" disabled={busy}>{busy ? "保存中..." : id ? "保存する" : "イベントを登録"}</button></div>
    </form>
  );
}
