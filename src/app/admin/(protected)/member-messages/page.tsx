import Link from "next/link";
import { requireCapability } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/format";
import MemberMessageForm from "./MemberMessageForm";

const STATUS_LABEL: Record<string, string> = {
  draft: "下書き",
  scheduled: "予約",
  sending: "配信中",
  sent: "配信済",
  canceled: "取消",
};

export default async function MemberMessagesPage() {
  await requireCapability("messages.manage");
  const admin = createSupabaseAdminClient();
  const { data: items } = await admin
    .from("member_messages")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">メッセージ配信（お知らせ・メルマガ）</h1>
        <p className="text-sm text-ink-mute mt-1">
          マイページのお知らせ表示と、会員へのメルマガ（HTMLメール）を作成・予約・配信します。
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="font-bold">新規作成</h2>
        <MemberMessageForm />
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">配信一覧</h2>
        <div className="card p-0 overflow-auto">
          <table className="table">
            <thead>
              <tr>
                <th>件名</th>
                <th>状態</th>
                <th>チャネル</th>
                <th>対象</th>
                <th className="text-right">配信/開封</th>
                <th>日時</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(items ?? []).map((m: any) => {
                const openRate =
                  m.sent_count > 0 ? Math.round((m.open_count / m.sent_count) * 100) : 0;
                const when = m.status === "scheduled" ? m.scheduled_at : m.sent_at ?? m.created_at;
                return (
                  <tr key={m.id}>
                    <td className="font-semibold max-w-xs truncate">{m.title}</td>
                    <td>{STATUS_LABEL[m.status] ?? m.status}</td>
                    <td className="text-xs">
                      {m.channel_inapp ? "お知らせ" : ""}
                      {m.channel_inapp && m.channel_email ? " / " : ""}
                      {m.channel_email ? "メール" : ""}
                    </td>
                    <td className="text-xs">{m.audience === "all" ? "全会員" : "指定会員"}</td>
                    <td className="text-right tabular-nums text-xs">
                      {m.channel_email ? (
                        <>
                          {m.sent_count}/{m.recipient_count}
                          <br />
                          開封 {m.open_count}（{openRate}%）
                        </>
                      ) : (
                        <>—</>
                      )}
                    </td>
                    <td className="text-xs">{formatDate(when, true)}</td>
                    <td className="text-right">
                      <Link href={`/admin/member-messages/${m.id}`} className="text-brand underline text-sm">
                        詳細
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {(items ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-ink-mute">
                    まだ配信はありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
