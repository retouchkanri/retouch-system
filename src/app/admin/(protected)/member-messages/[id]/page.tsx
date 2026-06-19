import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/format";
import MemberMessageForm from "../MemberMessageForm";
import MessageActions from "./MessageActions";

const STATUS_LABEL: Record<string, string> = {
  draft: "下書き",
  scheduled: "予約",
  sending: "配信中",
  sent: "配信済",
  canceled: "取消",
};
const EMAIL_STATUS_LABEL: Record<string, string> = {
  pending: "未送信",
  sent: "送信済",
  failed: "失敗",
  skipped: "対象外",
};

export default async function MemberMessageDetailPage({ params }: { params: { id: string } }) {
  await requireCapability("messages.manage");
  const admin = createSupabaseAdminClient();

  const { data: message } = await admin
    .from("member_messages")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!message) notFound();
  const m = message as any;

  const editable = m.status === "draft" || m.status === "scheduled";

  // 指定会員の場合は名前を解決してフォームへ渡す
  let initialTargets: { id: string; full_name: string | null; email: string | null }[] = [];
  if (m.audience === "subset" && (m.target_customer_ids ?? []).length > 0) {
    const { data } = await admin
      .from("customers")
      .select("id, full_name, email")
      .in("id", m.target_customer_ids);
    initialTargets = (data as any[]) ?? [];
  }

  // 配信先（最大300件まで表示）
  const { data: recipients } = await admin
    .from("member_message_recipients")
    .select("id, email, email_status, opened_at, read_at, customer:customers(full_name)")
    .eq("message_id", params.id)
    .order("created_at", { ascending: true })
    .limit(300);

  const openRate = m.sent_count > 0 ? Math.round((m.open_count / m.sent_count) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">配信詳細</h1>
        <Link href="/admin/member-messages" className="text-brand underline">一覧へ戻る</Link>
      </div>

      <div className="card grid sm:grid-cols-3 gap-3 text-sm">
        <div><span className="text-ink-mute">状態</span><div className="font-semibold">{STATUS_LABEL[m.status] ?? m.status}</div></div>
        <div><span className="text-ink-mute">チャネル</span><div>{[m.channel_inapp && "お知らせ", m.channel_email && "メール"].filter(Boolean).join(" / ") || "—"}</div></div>
        <div><span className="text-ink-mute">対象</span><div>{m.audience === "all" ? "全アクティブ会員" : "指定会員"}</div></div>
        <div><span className="text-ink-mute">配信先 / 送信</span><div className="tabular-nums">{m.recipient_count} / {m.sent_count}</div></div>
        <div><span className="text-ink-mute">開封（ユニーク）</span><div className="tabular-nums">{m.open_count}（開封率 {openRate}%）</div></div>
        <div><span className="text-ink-mute">{m.status === "scheduled" ? "予約日時" : "配信日時"}</span><div>{formatDate(m.status === "scheduled" ? m.scheduled_at : m.sent_at, true)}</div></div>
      </div>

      <MessageActions id={m.id} status={m.status} />

      {editable ? (
        <section className="space-y-2">
          <h2 className="font-bold">編集</h2>
          <MemberMessageForm initial={m} id={m.id} initialTargets={initialTargets} />
        </section>
      ) : (
        <section className="space-y-2">
          <h2 className="font-bold">本文</h2>
          <div className="card">
            <p className="font-semibold mb-2">{m.title}</p>
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: m.body_format === "text" ? "" : m.body }} />
            {m.body_format === "text" && <pre className="whitespace-pre-wrap text-sm">{m.body}</pre>}
          </div>
        </section>
      )}

      {m.channel_email && (recipients ?? []).length > 0 && (
        <section className="space-y-2">
          <h2 className="font-bold">配信先（最大300件）</h2>
          <div className="card p-0 overflow-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>会員</th>
                  <th>メール</th>
                  <th>送信状態</th>
                  <th>開封</th>
                  <th>既読</th>
                </tr>
              </thead>
              <tbody>
                {(recipients ?? []).map((r: any) => (
                  <tr key={r.id}>
                    <td>{r.customer?.full_name ?? "—"}</td>
                    <td className="text-xs">{r.email ?? "—"}</td>
                    <td className="text-xs">{EMAIL_STATUS_LABEL[r.email_status] ?? r.email_status}</td>
                    <td className="text-xs">{r.opened_at ? formatDate(r.opened_at, true) : "—"}</td>
                    <td className="text-xs">{r.read_at ? formatDate(r.read_at, true) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
