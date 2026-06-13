import Image from "next/image";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatUnits } from "@/lib/format";
import horsePortrait from "@/assets/images/horse-portrait.jpg";

type HorseRow = {
  id: string;
  name: string;
  profile: string | null;
  image_url: string | null;
  is_supportable: boolean;
};
type SupportInfo = {
  totalUnits: number;
  supporters: number;
  nicknames: string[];
};

export default async function HorsesSupportSection() {
  const admin = createSupabaseAdminClient();

  const [{ data: horses }, { data: supporters }] = await Promise.all([
    admin
      .from("horses")
      .select("id, name, profile, image_url, is_supportable")
      .order("sort_order"),
    admin
      .from("support_subscriptions")
      .select("horse_id, units, customer:customers(full_name_kana)")
      .in("status", ["active", "past_due"]),
  ]);

  if (!horses || horses.length === 0) return null;

  // Build per-horse support info
  const byHorse = new Map<string, SupportInfo>();
  for (const s of supporters ?? []) {
    const cur = byHorse.get(s.horse_id) ?? { totalUnits: 0, supporters: 0, nicknames: [] };
    cur.totalUnits += Number(s.units);
    cur.supporters += 1;
    const nick = ((s.customer as any)?.full_name_kana as string | null)?.trim();
    if (nick) cur.nicknames.push(nick);
    byHorse.set(s.horse_id, cur);
  }

  // Sort: zero-support horses first, then ascending by units
  const sorted = [...(horses as HorseRow[])].sort((a, b) => {
    const ua = byHorse.get(a.id)?.totalUnits ?? 0;
    const ub = byHorse.get(b.id)?.totalUnits ?? 0;
    return ua - ub;
  });

  return (
    <section id="horses" className="bg-[#faf9f6] py-20 px-5">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-brand font-bold tracking-[0.2em] text-xs sm:text-sm mb-3">OUR HORSES</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-ink mb-4 font-serif">馬ごとの支援状況</h2>
          <p className="text-ink-soft text-sm max-w-2xl mx-auto leading-relaxed">
            支援の少ない馬から順に並んでいます。<br />
            気になった馬をぜひ応援してください。
          </p>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          {sorted.map((horse) => {
            const info = byHorse.get(horse.id);
            const units = info?.totalUnits ?? 0;
            const supporters = info?.supporters ?? 0;
            const nicknames = info?.nicknames ?? [];
            const hasSupport = units > 0;

            return (
              <div
                key={horse.id}
                className={`relative rounded-xl border flex flex-col transition-shadow hover:shadow-md overflow-hidden
                  ${hasSupport ? "border-surface-line bg-white" : "border-dashed border-brand/30 bg-brand-50/20"}`}
              >
                {/* Top: image + name row */}
                <div className="flex items-center gap-3 p-3">
                  <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-brand-50">
                    {horse.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={horse.image_url}
                        alt={horse.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Image
                        src={horsePortrait}
                        alt={horse.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-ink truncate">{horse.name}</p>
                    {hasSupport ? (
                      <p className="text-xs text-ink-soft mt-0.5">
                        支援者 {supporters}名 / {formatUnits(units)}
                      </p>
                    ) : (
                      <p className="text-xs text-brand font-semibold mt-0.5">
                        {horse.is_supportable ? "支援者募集中 ✦" : "現在募集停止中"}
                      </p>
                    )}
                  </div>
                </div>

                {/* Nicknames */}
                {nicknames.length > 0 && (
                  <div className="px-3 pb-3 flex flex-wrap gap-1">
                    {nicknames.map((name, i) => (
                      <span
                        key={i}
                        className="text-[11px] bg-brand-50 text-brand-dark border border-brand-100 px-2 py-0.5 rounded-full"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Profile tooltip (if no nicknames, show profile snippet) */}
                {nicknames.length === 0 && horse.profile && (
                  <p className="px-3 pb-3 text-xs text-ink-mute line-clamp-2 leading-relaxed">
                    {horse.profile}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-10 text-center">
          <p className="text-ink-soft text-sm mb-4">あなたの応援が、馬たちの毎日を支えます。</p>
          <a href="/signup" className="btn-primary btn-pulse">支援を始める</a>
        </div>
      </div>
    </section>
  );
}
