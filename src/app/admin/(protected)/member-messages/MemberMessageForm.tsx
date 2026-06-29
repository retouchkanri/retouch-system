"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const TAG_PRESETS = [
  { tag: "お知らせ", color: "bg-brand-50 text-brand-dark" },
  { tag: "イベント", color: "bg-amber-50 text-amber-800" },
  { tag: "リリース", color: "bg-blue-50 text-blue-700" },
  { tag: "メディア", color: "bg-purple-50 text-purple-700" },
];

type TargetCustomer = { id: string; full_name: string | null; email: string | null };

// クライアント側プレビュー用（サーバの messageBodyHtml と同等の最小実装）
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function previewHtml(body: string, format: "html" | "text"): string {
  return format === "text" ? escapeHtml(body).replace(/\r?\n/g, "<br />") : body;
}

function toLocalInput(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  // datetime-local はローカルタイム。タイムゾーンオフセットを引いて整形。
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export default function MemberMessageForm({
  initial,
  id,
  initialTargets,
}: {
  initial?: any;
  id?: string;
  initialTargets?: TargetCustomer[];
}) {
  const router = useRouter();
  const start = initial ?? {
    title: "",
    body: "",
    body_format: "html",
    tag: "お知らせ",
    tag_color: "bg-brand-50 text-brand-dark",
    channel_inapp: true,
    channel_email: true,
    audience: "all",
    scheduled_at: null,
  };
  const [form, setForm] = useState<any>({ ...start });
  const [targets, setTargets] = useState<TargetCustomer[]>(initialTargets ?? []);
  const [schedule, setSchedule] = useState<string>(toLocalInput(start.scheduled_at));
  const [showPreview, setShowPreview] = useState(true);

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<TargetCustomer[]>([]);
  const [searching, setSearching] = useState(false);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const set = (k: string) => (e: any) =>
    setForm((p: any) => ({ ...p, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const runSearch = async (q: string) => {
    setSearch(q);
    if (q.trim().length < 1) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const res = await fetch(`/api/admin/customers/search?q=${encodeURIComponent(q)}&limit=10`);
    setSearching(false);
    if (res.ok) {
      const j = await res.json();
      setSearchResults(j.results ?? []);
    }
  };
  const addTarget = (c: TargetCustomer) => {
    setTargets((prev) => (prev.some((t) => t.id === c.id) ? prev : [...prev, c]));
    setSearch("");
    setSearchResults([]);
  };
  const removeTarget = (cid: string) => setTargets((prev) => prev.filter((t) => t.id !== cid));

  const submit = async (action: "draft" | "schedule" | "send") => {
    setBusy(true);
    setMsg(null);
    const payload: any = {
      title: form.title,
      body: form.body,
      body_format: form.body_format,
      tag: form.tag,
      tag_color: form.tag_color,
      channel_inapp: form.channel_inapp,
      channel_email: form.channel_email,
      audience: form.audience,
      target_customer_ids: form.audience === "subset" ? targets.map((t) => t.id) : [],
    };
    if (action === "schedule") payload.scheduled_at = schedule ? new Date(schedule).toISOString() : null;

    let res: Response;
    if (id) {
      // 編集: 下書き or 予約として保存（即時配信は詳細ページの「今すぐ配信」）
      payload.status = action === "schedule" ? "scheduled" : "draft";
      res = await fetch(`/api/admin/member-messages/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      payload.action = action;
      res = await fetch("/api/admin/member-messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error ?? "保存できませんでした。");
      return;
    }
    const j = await res.json().catch(() => ({}));
    if (!id) {
      const created = j.id as string | undefined;
      if (action === "send") {
        setMsg(`配信を開始しました（送信 ${j.result?.sentCount ?? 0} / 残り ${j.result?.remaining ?? 0}）。`);
      } else {
        setMsg(action === "schedule" ? "予約しました。" : "下書きを保存しました。");
      }
      if (created) {
        router.push(`/admin/member-messages/${created}`);
        return;
      }
    } else {
      setMsg("保存しました。");
    }
    router.refresh();
  };

  return (
    <div className="card space-y-4">
      <div className="grid md:grid-cols-4 gap-3">
        <div className="md:col-span-3">
          <label className="label">件名（メールの件名・お知らせのタイトル）</label>
          <input className="input" value={form.title} onChange={set("title")} maxLength={200} required />
        </div>
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

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="w-5 h-5" checked={form.channel_inapp} onChange={set("channel_inapp")} />
          <span>マイページに表示（お知らせ）</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="w-5 h-5" checked={form.channel_email} onChange={set("channel_email")} />
          <span>メール配信（メルマガ）</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="label !mb-0">本文形式</span>
          <select className="input !w-auto" value={form.body_format} onChange={set("body_format")}>
            <option value="html">HTML</option>
            <option value="text">テキスト</option>
          </select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="label">本文{form.body_format === "html" ? "（HTML）" : "（テキスト）"}</label>
          <button type="button" className="text-brand underline text-sm" onClick={() => setShowPreview((v) => !v)}>
            {showPreview ? "プレビューを隠す" : "プレビュー表示"}
          </button>
        </div>
        <textarea
          className="input font-mono text-sm"
          rows={10}
          value={form.body}
          onChange={set("body")}
          placeholder={form.body_format === "html" ? "<p>こんにちは。今月のお知らせです。</p>" : "こんにちは。今月のお知らせです。"}
        />
        {showPreview && (
          <div className="mt-2 border border-surface-line rounded-lg p-4 bg-white">
            <p className="text-xs text-ink-mute mb-2">プレビュー</p>
            <div
              className="prose prose-sm max-w-none text-[15px] leading-relaxed"
              dangerouslySetInnerHTML={{ __html: previewHtml(form.body ?? "", form.body_format) }}
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="label">配信対象</label>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {[
            { value: "all", label: "全アクティブ会員" },
            { value: "rpt_only", label: "リタポ会員のみ" },
            { value: "support_only", label: "1口支援者のみ" },
            { value: "no_class", label: "会員種別・空白の人のみ" },
            { value: "subset", label: "手動指定した会員のみ" },
          ].map((opt) => (
            <label key={opt.value} className="flex items-center gap-2">
              <input
                type="radio"
                name="audience"
                checked={form.audience === opt.value}
                onChange={() => setForm((p: any) => ({ ...p, audience: opt.value }))}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>

        {form.audience === "subset" && (
          <div className="space-y-2">
            <input
              className="input"
              placeholder="氏名・カナ・メールで検索して追加"
              value={search}
              onChange={(e) => runSearch(e.target.value)}
            />
            {searching && <p className="text-xs text-ink-mute">検索中...</p>}
            {searchResults.length > 0 && (
              <div className="border border-surface-line rounded-lg divide-y">
                {searchResults.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="block w-full text-left px-3 py-2 hover:bg-brand-50 text-sm"
                    onClick={() => addTarget(c)}
                  >
                    {c.full_name ?? "（無名）"}{" "}
                    <span className="text-ink-mute">{c.email ?? ""}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {targets.map((t) => (
                <span key={t.id} className="inline-flex items-center gap-1 bg-brand-50 text-brand-dark text-sm px-2 py-1 rounded-full">
                  {t.full_name ?? t.email ?? t.id}
                  <button type="button" className="text-ink-mute hover:text-ink" onClick={() => removeTarget(t.id)}>×</button>
                </span>
              ))}
              {targets.length === 0 && <span className="text-xs text-ink-mute">会員が選択されていません。</span>}
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="label">予約配信日時（予約する場合のみ・日本時間）</label>
        <input
          type="datetime-local"
          className="input md:w-auto"
          value={schedule}
          onChange={(e) => setSchedule(e.target.value)}
        />
      </div>

      {msg && <p className="text-sm">{msg}</p>}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => submit("draft")}>
          {busy ? "保存中..." : "下書き保存"}
        </button>
        <button type="button" className="btn-secondary" disabled={busy || !schedule} onClick={() => submit("schedule")}>
          予約{id ? "保存" : "する"}
        </button>
        {!id && (
          <button type="button" className="btn-primary" disabled={busy} onClick={() => submit("send")}>
            今すぐ配信
          </button>
        )}
      </div>
    </div>
  );
}
