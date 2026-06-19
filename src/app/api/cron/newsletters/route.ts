import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBaseUrl } from "@/lib/site";
import { sendMemberMessage } from "@/lib/memberMessages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 大量送信に備え関数の実行時間を延長（Vercel Pro 以上で有効。Hobby は上限で頭打ち）。
export const maxDuration = 60;

/**
 * スケジュール配信のドレイン。Vercel Cron（x-vercel-cron ヘッダ）または
 * CRON_SECRET 付きの外部スケジューラから定期的に叩かれる想定。
 *   - status='scheduled' かつ scheduled_at <= now → 配信開始
 *   - status='sending'（前回送り切れなかった分）→ 続きを送信
 * 1 メッセージあたりは時間/件数バジェット内で送信し、残りは次回に持ち越す。
 */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Vercel Cron からの呼び出しは x-vercel-cron ヘッダを含む
  if (req.headers.get("x-vercel-cron")) return true;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const q = new URL(req.url).searchParams.get("secret");
  return q === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  // 予約到来済み + 配信中の続き。古い順に処理。
  const { data: due } = await admin
    .from("member_messages")
    .select("id, status, scheduled_at")
    .or(`and(status.eq.scheduled,scheduled_at.lte.${nowIso}),status.eq.sending`)
    .order("scheduled_at", { ascending: true })
    .limit(10);

  const baseUrl = getBaseUrl(req);
  const results: Array<{ id: string; status: string; sent: number; remaining: number }> = [];
  for (const m of due ?? []) {
    const r = await sendMemberMessage(admin, (m as any).id, { baseUrl });
    results.push({ id: (m as any).id, status: r.status, sent: r.sentCount, remaining: r.remaining });
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
