import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { toCsv } from "@/lib/csv";
import { seatUsageBatch } from "@/lib/bookings";

const EXPORT_COLUMNS = [
  "event_id",
  "type",
  "title",
  "starts_at",
  "ends_at",
  "capacity",
  "reserved_seats",
  "remaining_seats",
  "location",
  "supporters_only",
  "is_published",
  "description",
  "created_at",
];

export async function GET() {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("events")
    .select(
      "id, type, title, starts_at, ends_at, capacity, location, supporters_only, is_published, description, created_at",
    )
    .order("starts_at", { ascending: false })
    .limit(10000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (data ?? []).map((r: any) => r.id);
  const usage = await seatUsageBatch(admin as any, ids);

  const rows = (data ?? []).map((r: any) => {
    const used = usage.get(r.id) ?? 0;
    return {
      event_id: r.id,
      type: r.type,
      title: r.title,
      starts_at: r.starts_at ?? "",
      ends_at: r.ends_at ?? "",
      capacity: r.capacity,
      reserved_seats: used,
      remaining_seats: Math.max(0, (r.capacity ?? 0) - used),
      location: r.location ?? "",
      supporters_only: r.supporters_only ? "true" : "false",
      is_published: r.is_published ? "true" : "false",
      description: r.description ?? "",
      created_at: r.created_at ?? "",
    };
  });

  const csv = toCsv(rows, EXPORT_COLUMNS);
  return new NextResponse("﻿" + csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="events_${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}
