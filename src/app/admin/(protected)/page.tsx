import Image from "next/image";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, formatYen } from "@/lib/format";
import { syncStripePayments } from "@/lib/stripeSync";
import { buildRevenueSeries, type RawPayment } from "@/lib/revenueSeries";
import RevenueChart from "./RevenueChart";
import horseImage from "@/assets/images/horse.png";

// 収益推移チャートは年・月・週・日で切替表示するため、十分に長い期間
// （直近 5 年）の成功決済を取得する。1000 行の上限を超える可能性があるので
// ページングして全件取得する。
async function fetchSucceededPayments(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  sinceISO: string,
): Promise<RawPayment[]> {
  const pageSize = 1000;
  const rows: RawPayment[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("payments")
      .select("occurred_at, amount")
      .eq("status", "succeeded")
      .gte("occurred_at", sinceISO)
      .order("occurred_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error || !data || data.length === 0) break;
    rows.push(...(data as RawPayment[]));
    if (data.length < pageSize) break;
  }
  return rows;
}

export default async function AdminDashboardPage() {
  // Reflect the latest Stripe payments on the dashboard (incremental,
  // best-effort — never blocks the page if Stripe is slow/unreachable).
  await syncStripePayments({}).catch(() => {});
  const supabase = createSupabaseServerClient();

  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

  const [
    { count: customersTotal },
    { count: pastDueCount },
    { count: activeContracts },
    { count: canceledContracts },
    { count: bookingsToday },
    { data: recentPayments },
    revenuePayments,
    { data: recentSupports },
    { data: upcomingEvents },
  ] = await Promise.all([
    supabase.from("customers").select("*", { count: "exact", head: true }),
    supabase.from("contracts").select("*", { count: "exact", head: true }).eq("status", "past_due"),
    supabase.from("contracts").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("contracts").select("*", { count: "exact", head: true }).eq("status", "canceled"),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .gte("booked_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    supabase
      .from("payments")
      .select("*, customer:customers(full_name,email)")
      .order("occurred_at", { ascending: false })
      .limit(5),
    fetchSucceededPayments(supabase, fiveYearsAgo.toISOString()),
    supabase
      .from("support_subscriptions")
      .select("*, horse:horses(name), customer:customers(full_name)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("events")
      .select("*")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(5),
  ]);

  // ── Revenue chart series (day / week / month / year) ──
  const revenueSeries = buildRevenueSeries(revenuePayments);

  // ── Donut chart for contract status ──
  const total = (activeContracts ?? 0) + (pastDueCount ?? 0) + (canceledContracts ?? 0);
  const C = 2 * Math.PI * 14; // circumference ≈ 87.96
  const activeLen = total > 0 ? ((activeContracts ?? 0) / total) * C : 0;
  const failedLen = total > 0 ? ((pastDueCount ?? 0) / total) * C : 0;
  const canceledLen = total > 0 ? ((canceledContracts ?? 0) / total) * C : 0;
  const activeOffset = C / 4; // start at top

  const cards = [
    { label: "会員数", value: customersTotal ?? 0, href: "/admin/customers", icon: "https://api.iconify.design/fluent-emoji-flat/bust-in-silhouette.svg", sub: "登録済み" },
    { label: "継続契約", value: activeContracts ?? 0, href: "/admin/contracts", icon: "https://api.iconify.design/fluent-emoji-flat/page-facing-up.svg", sub: "有効中" },
    {
      label: "決済失敗",
      value: pastDueCount ?? 0,
      warn: (pastDueCount ?? 0) > 0,
      href: "/admin/payments?status=failed",
      icon: "https://api.iconify.design/fluent-emoji-flat/warning.svg",
      sub: "要対応",
    },
    { label: "本日の予約", value: bookingsToday ?? 0, href: "/admin/bookings", icon: "https://api.iconify.design/fluent-emoji-flat/spiral-calendar.svg", sub: "本日" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <p className="text-sm text-ink-mute">{new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => {
          const inner = (
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-ink-soft mb-1">{c.label}</p>
                <p className={`text-3xl font-bold tabular-nums ${c.warn ? "text-danger" : "text-ink"}`}>
                  {c.value.toLocaleString()}
                </p>
                <p className={`text-xs mt-1 ${c.warn ? "text-danger" : "text-ink-mute"}`}>
                  {c.warn ? "→ 対応が必要です" : c.sub}
                </p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.icon} alt="" className="w-9 h-9 mt-0.5 shrink-0" />

            </div>
          );
          return c.href ? (
            <Link
              key={c.label}
              href={c.href}
              className={`card hover:shadow-lg transition-shadow ${c.warn ? "ring-2 ring-danger/40 bg-red-50/60" : ""}`}
            >
              {inner}
            </Link>
          ) : (
            <div key={c.label} className="card">{inner}</div>
          );
        })}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: "/admin/customers", label: "顧客一覧", sub: "検索・編集・履歴", icon: "https://api.iconify.design/fluent-emoji-flat/busts-in-silhouette.svg" },
          { href: "/admin/supports", label: "支援管理", sub: "馬ごと・口数・状態", icon: "https://api.iconify.design/fluent-emoji-flat/horse-face.svg" },
          { href: "/admin/contracts", label: "契約一覧", sub: "A/B/C・停止処理", icon: "https://api.iconify.design/fluent-emoji-flat/page-with-curl.svg" },
          { href: "/admin/payments", label: "決済履歴", sub: "成功・失敗・返金", icon: "https://api.iconify.design/fluent-emoji-flat/credit-card.svg" },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="card hover:shadow-lg transition-shadow flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={l.icon} alt="" className="w-8 h-8 shrink-0" />
            <div>
              <p className="font-bold text-sm">{l.label}</p>
              <p className="text-xs text-ink-soft mt-0.5">{l.sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Revenue Chart (day / week / month / year) */}
        <div className="card md:col-span-2">
          <RevenueChart series={revenueSeries} />
        </div>

        {/* Contract Status Donut */}
        <div className="card flex flex-col">
          <h2 className="section-title">契約状態の内訳</h2>
          <div className="flex flex-1 items-center gap-4">
            <div className="relative shrink-0">
              <svg viewBox="0 0 36 36" width="88" height="88" className="-rotate-90">
                <circle cx="18" cy="18" r="15" fill="none" stroke="#f5f5f5" strokeWidth="2.8" />
                {/* active */}
                <circle
                  cx="18" cy="18" r="15" fill="none" stroke="#4a9e7e" strokeWidth="2.8"
                  strokeDasharray={`${total > 0 ? ((activeContracts ?? 0) / total) * (2 * Math.PI * 15) : 0} ${2 * Math.PI * 15}`}
                  strokeDashoffset={2 * Math.PI * 15 / 4}
                  strokeLinecap="round"
                />
                {/* past_due */}
                <circle
                  cx="18" cy="18" r="15" fill="none" stroke="#e85d5d" strokeWidth="2.8"
                  strokeDasharray={`${total > 0 ? ((pastDueCount ?? 0) / total) * (2 * Math.PI * 15) : 0} ${2 * Math.PI * 15}`}
                  strokeDashoffset={2 * Math.PI * 15 / 4 - (total > 0 ? ((activeContracts ?? 0) / total) * (2 * Math.PI * 15) : 0)}
                  strokeLinecap="round"
                />
                {/* canceled */}
                <circle
                  cx="18" cy="18" r="15" fill="none" stroke="#c4c4c4" strokeWidth="2.8"
                  strokeDasharray={`${total > 0 ? ((canceledContracts ?? 0) / total) * (2 * Math.PI * 15) : 0} ${2 * Math.PI * 15}`}
                  strokeDashoffset={2 * Math.PI * 15 / 4 - (total > 0 ? (((activeContracts ?? 0) + (pastDueCount ?? 0)) / total) * (2 * Math.PI * 15) : 0)}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold text-ink tabular-nums leading-none">{total}</span>
                <span className="text-[9px] text-ink-mute mt-0.5">件</span>
              </div>
            </div>
            <dl className="space-y-3 text-sm flex-1">
              {[
                { color: "#4a9e7e", label: "有効", count: activeContracts ?? 0 },
                { color: "#e85d5d", label: "失敗", count: pastDueCount ?? 0 },
                { color: "#c4c4c4", label: "解約", count: canceledContracts ?? 0 },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                    <span className="text-ink-soft text-xs">{item.label}</span>
                  </div>
                  <span className="font-bold tabular-nums text-sm">{item.count.toLocaleString()}</span>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* Tables row */}
      <section className="card">
        <h2 className="section-title">直近の決済</h2>
        <table className="table">
          <thead>
            <tr>
              <th className="w-10 text-right">No.</th>
              <th>日時</th>
              <th>顧客</th>
              <th>種別</th>
              <th>金額</th>
              <th>状態</th>
            </tr>
          </thead>
          <tbody>
            {(recentPayments ?? []).map((p: any, i: number) => (
              <tr key={p.id} className="hover:bg-surface-soft transition-colors">
                <td className="text-right text-ink-mute tabular-nums">{i + 1}</td>
                <td className="tabular-nums">{formatDate(p.occurred_at, true)}</td>
                <td>
                  <span className="font-medium">{p.customer?.full_name ?? p.raw?.stripe_name ?? "—"}</span>
                  {(p.customer?.email ?? p.raw?.stripe_email) && (
                    <span className="block text-xs text-ink-mute">{p.customer?.email ?? p.raw?.stripe_email}</span>
                  )}
                </td>
                <td>{p.kind}</td>
                <td className="tabular-nums font-medium">{formatYen(p.amount)}</td>
                <td>
                  <span
                    className={`chip text-xs ${
                      p.status === "succeeded"
                        ? "chip-ok"
                        : p.status === "failed"
                        ? "chip-error"
                        : "chip-mute"
                    }`}
                  >
                    {p.status === "succeeded" ? "成功" : p.status === "failed" ? "失敗" : p.status}
                  </span>
                </td>
              </tr>
            ))}
            {(recentPayments ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-ink-mute py-6">
                  決済履歴はまだありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="section-title">最近の支援申込</h2>
          <ul className="divide-y divide-surface-line">
            {(recentSupports ?? []).map((s: any) => (
              <li key={s.id} className="py-3 flex items-center justify-between gap-2">
                <div>
                  <span className="font-medium text-sm">{s.customer?.full_name}</span>
                  <span className="text-ink-mute mx-1.5">→</span>
                  {s.horse?.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.horse.image_url} alt="" className="w-6 h-6 rounded-md object-cover inline-block align-text-bottom mr-1" />
                  ) : (
                    <Image src={horseImage} alt="" width={16} height={16} className="inline-block w-4 h-4 rounded-sm object-cover align-text-bottom mr-1" />
                  )}
                  <span className="text-sm text-brand font-medium">{s.horse?.name}</span>
                </div>
                <span className="text-xs text-ink-mute shrink-0">{formatDate(s.created_at)}</span>
              </li>
            ))}
            {(recentSupports ?? []).length === 0 && (
              <li className="text-ink-mute py-4 text-sm text-center">データなし</li>
            )}
          </ul>
        </div>

        <div className="card">
          <h2 className="section-title">今後のイベント</h2>
          <ul className="divide-y divide-surface-line">
            {(upcomingEvents ?? []).map((e: any) => (
              <li key={e.id} className="py-3 flex items-center justify-between gap-2">
                <Link href={`/admin/events/${e.id}`} className="text-brand underline text-sm font-medium hover:text-brand-dark">
                  📅 {e.title}
                </Link>
                <span className="text-xs text-ink-mute shrink-0">{formatDate(e.starts_at, true)}</span>
              </li>
            ))}
            {(upcomingEvents ?? []).length === 0 && (
              <li className="text-ink-mute py-4 text-sm text-center">予定はありません。</li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
