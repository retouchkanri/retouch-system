#!/usr/bin/env node
/**
 * Register emergency support horses (54・55番).
 * Usage: node scripts/apply-emergency-horses.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = t.slice(i + 1).trim();
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const HORSES = [
  {
    name: "54：緊急支援募集馬",
    name_kana: "54キンキュウシエンボシュウウマ",
    profile: "肥育場からの54番目の子（千葉予定）★支援募集開始★",
    sort_order: 1,
  },
  {
    name: "55：緊急支援募集馬",
    name_kana: "55キンキュウシエンボシュウウマ",
    profile: "肥育場からの55番目の子（千葉予定）★支援募集開始★",
    sort_order: 2,
  },
];

async function hasEmergencyColumn() {
  const { error } = await sb.from("horses").select("is_emergency_recruitment").limit(1);
  return !error;
}

async function tryApplyMigration() {
  const sql = fs.readFileSync(
    path.resolve(__dirname, "../supabase/migrations/20260625_emergency_support_horses.sql"),
    "utf8",
  );
  const { error } = await sb.rpc("exec_sql", { query: sql });
  if (error) {
    console.log("[info] exec_sql unavailable — apply migration manually if needed:");
    console.log("       supabase/migrations/20260625_emergency_support_horses.sql");
    return false;
  }
  console.log("✅ Applied 20260625_emergency_support_horses.sql");
  return true;
}

async function upsertHorses() {
  const withFlag = await hasEmergencyColumn();

  for (const horse of HORSES) {
    const { data: existing } = await sb
      .from("horses")
      .select("id, name")
      .eq("name", horse.name)
      .maybeSingle();

    const payload = {
      name_kana: horse.name_kana,
      profile: horse.profile,
      is_supportable: true,
      sort_order: horse.sort_order,
      ...(withFlag ? { is_emergency_recruitment: true } : {}),
    };

    if (existing?.id) {
      const { error } = await sb.from("horses").update(payload).eq("id", existing.id);
      if (error) {
        console.error(`[fail] update ${horse.name}:`, error.message);
        process.exit(1);
      }
      console.log(`[ok] updated ${horse.name} (${existing.id})`);
      continue;
    }

    const { data, error } = await sb
      .from("horses")
      .insert({ name: horse.name, ...payload })
      .select("id")
      .single();

    if (error) {
      console.error(`[fail] insert ${horse.name}:`, error.message);
      process.exit(1);
    }
    console.log(`[ok] inserted ${horse.name} (${data.id})`);
  }
}

async function main() {
  await tryApplyMigration();
  await upsertHorses();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
