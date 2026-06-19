import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { messageBodyHtml } from "@/lib/memberMessages";
import MarkAnnouncementRead from "./MarkAnnouncementRead";

export const dynamic = "force-dynamic";

export default async function MemberAnnouncementDetailPage({ params }: { params: { id: string } }) {
  await requireMember();
  const supabase = createSupabaseServerClient();

  // RLS により、自分が対象でない／未配信のメッセージは取得できない
  const { data: message } = await supabase
    .from("member_messages")
    .select("id, title, body, body_format, tag, tag_color, sent_at, channel_inapp, status")
    .eq("id", params.id)
    .eq("channel_inapp", true)
    .eq("status", "sent")
    .maybeSingle();
  if (!message) notFound();
  const m = message as any;

  return (
    <div className="space-y-4">
      <MarkAnnouncementRead id={m.id} />
      <div className="flex items-center justify-between">
        <Link href="/mypage/announcements" className="text-brand underline">お知らせ一覧へ</Link>
        <span className="text-xs text-ink-mute">{formatDate(m.sent_at)}</span>
      </div>
      <article className="card space-y-3">
        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${m.tag_color}`}>{m.tag}</span>
        <h1 className="text-xl font-bold">{m.title}</h1>
        <div
          className="prose prose-sm max-w-none text-[15px] leading-relaxed"
          dangerouslySetInnerHTML={{ __html: messageBodyHtml(m.body ?? "", m.body_format) }}
        />
      </article>
    </div>
  );
}
