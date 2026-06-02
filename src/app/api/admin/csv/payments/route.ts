import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { toCsv } from "@/lib/csv";

const EXPORT_COLUMNS = [
  "payment_id",
  "occurred_at",
  "customer_id",
  "customer_name",
  "customer_email",
  "kind",
  "amount",
  "currency",
  "status",
  "failure_reason",
  "stripe_invoice_id",
  "stripe_payment_intent_id",
  "stripe_charge_id",
];

export async function GET() {
  await requireCapability("csv");
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("payments")
    .select(
      "id, occurred_at, customer_id, kind, amount, currency, status, failure_reason, " +
        "stripe_invoice_id, stripe_payment_intent_id, stripe_charge_id, " +
        "customer:customers(full_name, email)",
    )
    .order("occurred_at", { ascending: false })
    .limit(50000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((r: any) => ({
    payment_id: r.id,
    occurred_at: r.occurred_at ?? "",
    customer_id: r.customer_id ?? "",
    customer_name: r.customer?.full_name ?? "",
    customer_email: r.customer?.email ?? "",
    kind: r.kind ?? "",
    amount: r.amount ?? 0,
    currency: r.currency ?? "jpy",
    status: r.status ?? "",
    failure_reason: r.failure_reason ?? "",
    stripe_invoice_id: r.stripe_invoice_id ?? "",
    stripe_payment_intent_id: r.stripe_payment_intent_id ?? "",
    stripe_charge_id: r.stripe_charge_id ?? "",
  }));

  const csv = toCsv(rows, EXPORT_COLUMNS);
  return new NextResponse("﻿" + csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="payments_${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}
