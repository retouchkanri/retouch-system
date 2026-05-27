import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { bookingConfirmedTemplate, notify } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";
import { hasActiveSupport, seatUsage } from "@/lib/bookings";

const schema = z.object({
  event_id: z.string().uuid(),
  party_size: z.number().int().min(1).max(20).optional(),
  note: z.string().max(500).optional().nullable(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.customerId) {
    return NextResponse.json({ error: "認証されていません" }, { status: 401 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: ev } = await admin
    .from("events")
    .select("id, title, starts_at, capacity, supporters_only, is_published")
    .eq("id", parsed.data.event_id)
    .maybeSingle();
  if (!ev || !(ev as any).is_published) {
    return NextResponse.json({ error: "対象のイベントが見つかりません" }, { status: 404 });
  }

  if ((ev as any).supporters_only) {
    const ok = await hasActiveSupport(admin as any, session.customerId);
    if (!ok) return NextResponse.json({ error: "このイベントは支援者限定です" }, { status: 403 });
  }

  const partySize = parsed.data.party_size ?? 1;
  const note = parsed.data.note ?? null;
  const usage = await seatUsage(admin as any, ev as any);
  if (usage.used + partySize > usage.capacity) {
    return NextResponse.json({ error: "定員を超えるため予約できません" }, { status: 409 });
  }

  const { data: existing } = await admin
    .from("bookings")
    .select("id, status")
    .eq("customer_id", session.customerId)
    .eq("event_id", (ev as any).id)
    .maybeSingle();

  if (existing && (existing as any).status !== "canceled") {
    return NextResponse.json({ error: "すでにこのイベントを予約しています" }, { status: 409 });
  }

  let bookingId: string | null = null;
  if (existing) {
    const { data: updated, error } = await admin
      .from("bookings")
      .update({
        status: "reserved",
        canceled_at: null,
        booked_at: new Date().toISOString(),
        party_size: partySize,
        note,
      })
      .eq("id", (existing as any).id)
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    bookingId = updated?.id ?? null;
  } else {
    const { data: inserted, error } = await admin
      .from("bookings")
      .insert({
        customer_id: session.customerId,
        event_id: (ev as any).id,
        party_size: partySize,
        note,
        status: "reserved",
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    bookingId = inserted?.id ?? null;
  }

  await writeAudit({
    actorId: session.userId,
    action: "booking.self_create",
    targetTable: "bookings",
    targetId: bookingId,
    meta: {
      event_id: (ev as any).id,
      event_title: (ev as any).title,
      party_size: partySize,
      note,
    },
  });

  const { data: cust } = await admin
    .from("customers")
    .select("full_name, email")
    .eq("id", session.customerId)
    .maybeSingle();
  const tpl = bookingConfirmedTemplate({
    name: (cust as any)?.full_name ?? null,
    eventTitle: (ev as any).title,
    startsAt: (ev as any).starts_at,
  });
  await notify({
    kind: "booking_confirmed",
    to: (cust as any)?.email ?? session.email,
    to_name: (cust as any)?.full_name ?? null,
    subject: tpl.subject,
    body_text: tpl.body_text,
    meta: { event_id: (ev as any).id, party_size: partySize },
  });

  return NextResponse.json({ ok: true, id: bookingId });
}

const patchSchema = z.object({
  event_id: z.string().uuid(),
  party_size: z.number().int().min(1).max(20).optional(),
  note: z.string().max(500).optional().nullable(),
});

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session?.customerId) {
    return NextResponse.json({ error: "認証されていません" }, { status: 401 });
  }
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  }
  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from("bookings")
    .select("id, status, party_size, note")
    .eq("customer_id", session.customerId)
    .eq("event_id", parsed.data.event_id)
    .maybeSingle();
  if (!existing || (existing as any).status === "canceled") {
    return NextResponse.json({ error: "予約が見つかりません" }, { status: 404 });
  }

  if (parsed.data.party_size !== undefined) {
    const { data: ev } = await admin
      .from("events")
      .select("id, capacity")
      .eq("id", parsed.data.event_id)
      .maybeSingle();
    if (!ev) return NextResponse.json({ error: "イベントが見つかりません" }, { status: 404 });
    const usage = await seatUsage(admin as any, ev as any, session.customerId);
    if (usage.used + parsed.data.party_size > usage.capacity) {
      return NextResponse.json({ error: "定員を超えるため変更できません" }, { status: 409 });
    }
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.party_size !== undefined) update.party_size = parsed.data.party_size;
  if (parsed.data.note !== undefined) update.note = parsed.data.note;
  const { error } = await admin
    .from("bookings")
    .update(update)
    .eq("id", (existing as any).id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit({
    actorId: session.userId,
    action: "booking.self_update",
    targetTable: "bookings",
    targetId: (existing as any).id,
    meta: {
      event_id: parsed.data.event_id,
      prev: { party_size: (existing as any).party_size, note: (existing as any).note },
      next: update,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session?.customerId) {
    return NextResponse.json({ error: "認証されていません" }, { status: 401 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  }
  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from("bookings")
    .select("id, party_size")
    .eq("customer_id", session.customerId)
    .eq("event_id", parsed.data.event_id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "予約が見つかりません" }, { status: 404 });
  }

  const { error } = await admin
    .from("bookings")
    .update({ status: "canceled", canceled_at: new Date().toISOString() })
    .eq("id", (existing as any).id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit({
    actorId: session.userId,
    action: "booking.self_cancel",
    targetTable: "bookings",
    targetId: (existing as any).id,
    meta: { event_id: parsed.data.event_id, party_size: (existing as any).party_size },
  });

  return NextResponse.json({ ok: true });
}
