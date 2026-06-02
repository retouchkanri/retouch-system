import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/auth";
import { syncStripePayments } from "@/lib/stripeSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST { full?: boolean } — pull Stripe payments into the local payments table.
// full=true reconciles the whole history (backfill); default is incremental.
export async function POST(req: Request) {
  await requireCapability("payments.manage");
  const body = await req.json().catch(() => ({}));
  const full = Boolean((body as any)?.full);
  try {
    const result = await syncStripePayments({ full });
    if (result.reason === "stripe_disabled") {
      return NextResponse.json({ error: "Stripeが未設定です（STRIPE_SECRET_KEY）。" }, { status: 503 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "同期に失敗しました" }, { status: 500 });
  }
}
