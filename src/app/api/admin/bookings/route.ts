import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { hasActiveSupport, seatUsage } from "@/lib/bookings";

const schema = z.object({
  customer_id: z.string().uuid(),
  event_id: z.string().uuid(),
  party_size: z.coerce.number().int().positive().max(20).default(1),
  note: z.string().max(500).optional().nullable(),
  status: z
    .enum(["reserved", "canceled", "attended", "no_show"])
    .default("reserved"),
  /** When true, admin overrides supporters_only / capacity guards. Default false. */
  bypass_guard: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await requireAdmin();
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "入力が不正です" },
      { status: 400 },
    );
  }
  const admin = createSupabaseAdminClient();

  const { data: ev } = await admin
    .from("events")
    .select("id, capacity, supporters_only")
    .eq("id", parsed.data.event_id)
    .maybeSingle();
  if (!ev) {
    return NextResponse.json({ error: "対象のイベントが見つかりません" }, { status: 404 });
  }

  if (!parsed.data.bypass_guard) {
    if ((ev as any).supporters_only) {
      const ok = await hasActiveSupport(admin as any, parsed.data.customer_id);
      if (!ok)
        return NextResponse.json(
          { error: "対象顧客は支援者ではありません（管理者権限で強制登録する場合は bypass_guard を有効化）" },
          { status: 409 },
        );
    }
    if (parsed.data.status !== "canceled") {
      const usage = await seatUsage(admin as any, ev as any);
      if (usage.used + parsed.data.party_size > usage.capacity) {
        return NextResponse.json(
          { error: "定員を超えるため登録できません（管理者権限で強制登録する場合は bypass_guard を有効化）" },
          { status: 409 },
        );
      }
    }
  }

  const { data: existing } = await admin
    .from("bookings")
    .select("id")
    .eq("customer_id", parsed.data.customer_id)
    .eq("event_id", parsed.data.event_id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "既に予約が登録されています" }, { status: 400 });
  }

  // Strip `bypass_guard` — it's a control flag, not a column.
  const { bypass_guard: _bypass, ...insertPayload } = parsed.data;

  const { data: inserted, error } = await admin
    .from("bookings")
    .insert(insertPayload)
    .select("id")
    .single();
  if (error || !inserted) {
    return NextResponse.json({ error: error?.message ?? "登録に失敗しました" }, { status: 500 });
  }

  await writeAudit({
    actorId: session.userId,
    action: "booking.create",
    targetTable: "bookings",
    targetId: inserted.id,
    meta: insertPayload,
  });

  return NextResponse.json({ ok: true, id: inserted.id });
}
