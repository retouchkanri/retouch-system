import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { getBaseUrl } from "@/lib/site";
import { sendMemberMessage } from "@/lib/memberMessages";

export const maxDuration = 60;

/**
 * 即時配信（または配信中の続きを送る）。大量送信時は 1 呼び出しで送り切れず
 * status='sending' のまま返ることがある。その場合は再度呼び出すか、cron が続きを送る。
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await requireCapability("messages.manage");
  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from("member_messages")
    .select("id, status")
    .eq("id", params.id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "配信が見つかりません" }, { status: 404 });
  }
  if ((existing as any).status === "sent") {
    return NextResponse.json({ error: "すでに配信済みです" }, { status: 409 });
  }

  const result = await sendMemberMessage(admin, params.id, { baseUrl: getBaseUrl(req) });

  await writeAudit({
    actorId: session.userId,
    action: "message.send",
    targetTable: "member_messages",
    targetId: params.id,
    meta: result,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "配信に失敗しました" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, result });
}
