"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const RichTextEditor = dynamic(() => import("@/components/admin/RichTextEditor"), { ssr: false });

const TAG_PRESETS = [
  { tag: "お知らせ", color: "bg-brand-50 text-brand-dark" },
  { tag: "イベント", color: "bg-amber-50 text-amber-800" },
  { tag: "リリース", color: "bg-blue-50 text-blue-700" },
  { tag: "メディア", color: "bg-purple-50 text-purple-700" },
];

export default function NewsForm({ initial, id }: { initial?: any; id?: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const start = initial ?? {
    title: "",
    body: "",
    tag: "お知らせ",
    tag_color: "bg-brand-50 text-brand-dark",
    image_url: "",
    published_at: "",
    is_published: true,
    sort_order: 0,
    pdf_url: "",
  };

  const [form, setForm] = useState<any>({ ...start, pdf_url: start.pdf_url ?? "" });
  const [pdfName, setPdfName] = useState<string>("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfMsg, setPdfMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const set = (k: string) => (e: any) =>
    setForm((p: any) => ({ ...p, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const toLocal = (v: string) => (v ? new Date(v).toISOString().slice(0, 16) : "");

  /* PDF アップロード */
  const handlePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfBusy(true);
    setPdfMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/news/upload", { method: "POST", body: fd });
    setPdfBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setPdfMsg(j.error ?? "PDFのアップロードに失敗しました。");
      return;
    }
    const j = await res.json();
    setForm((p: any) => ({ ...p, pdf_url: j.url }));
    setPdfName(j.name ?? file.name);
    setPdfMsg("PDFをアップロードしました。");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* フォーム保存 */
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const payload = {
      ...form,
      sort_order: Number(form.sort_order),
      pdf_url: form.pdf_url || null,
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
    if (!id) {
      setForm({ ...start, pdf_url: "" });
      setPdfName("");
    }
    router.refresh();
  };

  return (
    <form onSubmit={save} className="card space-y-4">
      <div className="grid md:grid-cols-4 gap-3">
        {/* タイトル */}
        <div className="md:col-span-3">
          <label className="label">タイトル</label>
          <input className="input" value={form.title} onChange={set("title")} required maxLength={200} />
        </div>

        {/* タグ */}
        <div>
          <label className="label">タグ</label>
          <select
            className="input"
            value={form.tag}
            onChange={(e) => {
              const preset = TAG_PRESETS.find((p) => p.tag === e.target.value);
              setForm((p: any) => ({ ...p, tag: e.target.value, tag_color: preset?.color ?? p.tag_color }));
            }}
          >
            {TAG_PRESETS.map((p) => (
              <option key={p.tag} value={p.tag}>{p.tag}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 本文（リッチテキスト） */}
      <div>
        <label className="label">本文（書式・リンク設定可）</label>
        <RichTextEditor
          value={form.body ?? ""}
          onChange={(html) => setForm((p: any) => ({ ...p, body: html }))}
          placeholder="本文を入力…  見出し・色・リンクなどを自由に設定できます。"
          minHeight={200}
        />
        <p className="text-xs text-ink-mute mt-1">H1/H2/H3 で見出し、A で文字色、🔗 でリンクを設定できます。</p>
      </div>

      {/* 画像URL + 公開日時 + 表示順 */}
      <div className="grid md:grid-cols-4 gap-3">
        <div className="md:col-span-2">
          <label className="label">画像URL（任意）</label>
          <input
            className="input"
            value={form.image_url ?? ""}
            onChange={set("image_url")}
            placeholder="https://images.unsplash.com/..."
          />
        </div>
        <div>
          <label className="label">公開日時</label>
          <input
            type="datetime-local"
            className="input"
            value={toLocal(form.published_at)}
            onChange={(e) => setForm((p: any) => ({ ...p, published_at: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">表示順</label>
          <input type="number" className="input" value={form.sort_order} onChange={set("sort_order")} min={0} />
        </div>
      </div>

      {/* PDF 添付 */}
      <div className="border border-surface-line rounded-xl p-4 space-y-2 bg-surface-soft/50">
        <p className="label !mb-0">PDF添付（馬情報等）</p>
        <p className="text-xs text-ink-mute">
          会員ページのニュース詳細にPDFダウンロードリンクが表示されます。最大20MB。
        </p>

        {/* 現在のPDF */}
        {form.pdf_url && (
          <div className="flex items-center gap-3 text-sm">
            <a
              href={form.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand underline flex items-center gap-1"
            >
              📄 {pdfName || "添付PDF"}
            </a>
            <button
              type="button"
              className="text-danger text-xs underline"
              onClick={() => { setForm((p: any) => ({ ...p, pdf_url: "" })); setPdfName(""); }}
            >
              削除
            </button>
          </div>
        )}

        {/* アップロードボタン */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={pdfBusy}
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary !py-2 !px-4 !text-sm"
          >
            {pdfBusy ? "アップロード中…" : form.pdf_url ? "PDFを差し替え" : "PDFをアップロード"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={handlePdfChange}
          />
          {pdfMsg && (
            <p className={`text-xs ${pdfMsg.startsWith("PDF") && !pdfMsg.includes("失敗") ? "text-ok" : "text-danger"}`}>
              {pdfMsg}
            </p>
          )}
        </div>
      </div>

      {/* 公開チェック */}
      <label className="flex items-center gap-2">
        <input type="checkbox" className="w-5 h-5" checked={Boolean(form.is_published)} onChange={set("is_published")} />
        <span>公開する</span>
      </label>

      {msg && <p className={`text-sm ${msg === "保存しました。" ? "text-ok" : "text-danger"}`}>{msg}</p>}

      <button className="btn-primary" disabled={busy}>
        {busy ? "保存中..." : id ? "保存する" : "ニュースを登録"}
      </button>
    </form>
  );
}
