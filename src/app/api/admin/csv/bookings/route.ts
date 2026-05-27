import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { toCsv } from "@/lib/csv";

const EXPORT_COLUMNS = [
  "booking_id",
  "event_id",
  "event_title",
  "event_type",
  "event_starts_at",
  "customer_id",
  "customer_name",
  "customer_email",
  "party_size",
  "status",
  "booked_at",
  "canceled_at",
  "note",
];

export async function GET(req: Request) {
  await requireAdmin();
  const url = new URL(req.url);
  const eventId = url.searchParams.get("event_id");

  const admin = createSupabaseAdminClient();
  let query = admin
    .from("bookings")
    .select(
      "id, event_id, party_size, status, booked_at, canceled_at, note, " +
        "customer_id, customer:customers(full_name, email), event:events(title, type, starts_at)",
    )
    .order("booked_at", { ascending: false })
    .limit(50000);
  if (eventId) query = query.eq("event_id", eventId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((b: any) => ({
    booking_id: b.id,
    event_id: b.event_id,
    event_title: b.event?.title ?? "",
    event_type: b.event?.type ?? "",
    event_starts_at: b.event?.starts_at ?? "",
    customer_id: b.customer_id,
    customer_name: b.customer?.full_name ?? "",
    customer_email: b.customer?.email ?? "",
    party_size: b.party_size,
    status: b.status,
    booked_at: b.booked_at ?? "",
    canceled_at: b.canceled_at ?? "",
    note: b.note ?? "",
  }));

  const csv = toCsv(rows, EXPORT_COLUMNS);
  return new NextResponse("﻿" + csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="bookings_${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}
