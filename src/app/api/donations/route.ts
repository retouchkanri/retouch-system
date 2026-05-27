import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { donationThanksTemplate, notify } from "@/lib/notify";

const schema = z.object({
  amount: z.number().int().min(100).max(10_000_000),
  message: z.string().max(1000).optional().nullable(),
  donor_name: z.string().max(120).optional().nullable(),
  // Spec: 匿名寄付であっても、履歴統合のためメールは必須取得。
  donor_email: z.string().email("メールアドレスの形式が正しくありません"),
});

/**
 * Public one-time donation endpoint. Accepts anonymous donations.
 * If the caller is a logged-in member, the donation is attached to
 * their customer record automatically.
 */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "入力が不正です" }, { status: 400 });
  }
  const { amount, message, donor_name, donor_email } = parsed.data;

  const admin = createSupabaseAdminClient();
  const session = await getSession();
  let customerId: string | null = session?.customerId ?? null;

  // If anonymous donor supplied an email that matches a known customer,
  // link to that customer for history aggregation.
  if (!customerId && donor_email) {
    const { data: match } = await admin
      .from("customers")
      .select("id")
      .eq("email", donor_email)
      .maybeSingle();
    customerId = (match as any)?.id ?? null;
  }

  const { data: inserted, error: dErr } = await admin
    .from("donations")
    .insert({
      customer_id: customerId,
      donor_name: donor_name ?? null,
      donor_email: donor_email ?? session?.email ?? null,
      amount,
      message: message ?? null,
      status: "pending",
    })
    .select("id")
    .single();
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });

  const stripe = getStripe();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const returnBase = session ? "/mypage/donate" : "/donate";

  if (!stripe) {
    // Dev mode: mark succeeded instantly and send thank-you
    await admin.from("donations").update({ status: "succeeded" }).eq("id", inserted.id);
    const tpl = donationThanksTemplate({ name: donor_name ?? null, amount });
    await notify({
      kind: "donation_thanks",
      to: donor_email ?? session?.email ?? null,
      to_name: donor_name ?? null,
      subject: tpl.subject,
      body_text: tpl.body_text,
      meta: { donation_id: inserted.id, dev_mode: true },
    });
    return NextResponse.json({ ok: true, checkout_url: null });
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "jpy",
          unit_amount: amount,
          product_data: { name: "Retouchメンバーズサイト 単発寄付" },
        },
      },
    ],
    client_reference_id: inserted.id,
    metadata: {
      donation_id: inserted.id,
      customer_id: customerId ?? "",
      donor_name: donor_name ?? "",
      kind: "donation",
    },
    success_url: `${siteUrl}${returnBase}/thanks?sid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}${returnBase}`,
    customer_email: donor_email ?? session?.email ?? undefined,
  });

  await admin
    .from("donations")
    .update({ stripe_checkout_session_id: checkout.id })
    .eq("id", inserted.id);

  return NextResponse.json({ ok: true, checkout_url: checkout.url });
}
