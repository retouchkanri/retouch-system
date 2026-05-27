/**
 * Seed sample customers/horses/contracts/supports for smoke testing.
 * Run after the SQL migrations have been applied.
 *   npx tsx scripts/seed.ts
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const sampleHorses = [
    { name: "サクラエース", name_kana: "サクラエース", sex: "牡", birth_year: 2012, profile: "やさしい性格で人気。", sort_order: 10 },
    { name: "ミドリノカゼ", name_kana: "ミドリノカゼ", sex: "牝", birth_year: 2014, profile: "穏やかで見学会の看板馬。", sort_order: 20 },
    { name: "ハヤテボーイ", name_kana: "ハヤテボーイ", sex: "牡", birth_year: 2011, profile: "元重賞勝ち馬。", sort_order: 30 },
  ];
  for (const h of sampleHorses) {
    const { data: existing } = await admin.from("horses").select("id").eq("name", h.name).maybeSingle();
    if (!existing) {
      const { error } = await admin.from("horses").insert({ ...h, is_supportable: true });
      if (error) console.error(`horse ${h.name}:`, error.message);
    }
  }

  const sampleCustomers = [
    { full_name: "山田 太郎", full_name_kana: "ヤマダ タロウ", email: "taro.yamada@example.com", phone: "090-1234-5678", status: "active" },
    { full_name: "佐藤 花子", full_name_kana: "サトウ ハナコ", email: "hanako.sato@example.com", phone: "090-0000-1111", status: "active" },
    { full_name: "鈴木 次郎", full_name_kana: "スズキ ジロウ", email: "jiro.suzuki@example.com", phone: "", status: "active" },
  ];
  for (const c of sampleCustomers) {
    const { data: existing } = await admin.from("customers").select("id").eq("email", c.email).maybeSingle();
    if (!existing) {
      const { error } = await admin.from("customers").insert(c);
      if (error) console.error(`customer ${c.email}:`, error.message);
    }
  }

  // Create 1 contract + 1 support for 山田太郎 just for smoke test (if not already present).
  const { data: taro } = await admin.from("customers").select("id").eq("email", "taro.yamada@example.com").maybeSingle();
  const { data: horseA } = await admin.from("horses").select("id").eq("name", "サクラエース").maybeSingle();
  const { data: planSupport } = await admin.from("membership_plans").select("id, unit_amount, monthly_amount").eq("code", "SUPPORT").eq("name", "1口支援").maybeSingle();
  if (taro && horseA && planSupport) {
    const { data: existingContract } = await admin
      .from("contracts")
      .select("id")
      .eq("customer_id", (taro as any).id)
      .maybeSingle();
    let contractId = (existingContract as any)?.id;
    if (!contractId) {
      const { data } = await admin
        .from("contracts")
        .insert({
          customer_id: (taro as any).id,
          plan_id: (planSupport as any).id,
          status: "active",
          current_period_end: new Date(Date.now() + 30 * 86400_000).toISOString(),
        })
        .select("id")
        .single();
      contractId = (data as any).id;
    }
    const { data: existingSupport } = await admin
      .from("support_subscriptions")
      .select("id")
      .eq("customer_id", (taro as any).id)
      .eq("horse_id", (horseA as any).id)
      .maybeSingle();
    if (!existingSupport) {
      const unit = (planSupport as any).unit_amount ?? (planSupport as any).monthly_amount;
      await admin.from("support_subscriptions").insert({
        contract_id: contractId,
        customer_id: (taro as any).id,
        horse_id: (horseA as any).id,
        units: 1,
        monthly_amount: unit,
        status: "active",
      });
    }
  }

  console.log("Seed complete.");
}

main().catch((e) => { console.error(e); process.exit(1); });
