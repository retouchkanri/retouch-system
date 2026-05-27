import Link from "next/link";
import { requireMember } from "@/lib/auth";
import {
  loadActiveContract,
  loadActiveSupports,
  loadCustomer,
  loadCustomerSummary,
  loadPayments,
} from "@/lib/customer";
import { formatDate, formatUnits, formatYen } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  describePaymentDisplay,
  fromContractStatus,
} from "@/lib/paymentStatus";

export default async function MyPageTop() {
  const session = await requireMember();
  if (!session.customerId) {
    return (
      <div className="card">
        <p className="text-danger font-semibold mb-2">会員情報が見つかりません。</p>
        <p className="text-sm text-ink-soft">運営へお問い合わせください。</p>
      </div>
    );
  }

  const customerId = session.customerId;
  const [customer, summary, contract, supports, recentPayments] = await Promise.all([
    loadCustomer(customerId),
    loadCustomerSummary(customerId),
    loadActiveContract(customerId),
    loadActiveSupports(customerId),
    loadPayments(customerId, 5),
  ]);

  const baseStatusKey = contract
    ? fromContractStatus(contract.status)
    : supports.length > 0
      ? fromContractStatus(supports[0].status)
      : "stopped";

  const recentlyRecovered =
    baseStatusKey === "ok" &&
    recentPayments.some((p) => p.status === "failed") &&
    recentPayments[0]?.status === "succeeded";

  const now = Date.now();
  const scheduledStop = supports
    .filter((s) => s.status === "active" && s.canceled_at)
    .map((s) => ({
      id: s.id,
      name: s.horse?.name ?? "—",
      date: s.canceled_at as string,
    }))
    .filter((s) => new Date(s.date).getTime() > now)
    .sort((a, b) => a.date.localeCompare(b.date));

  const displayKey =
    scheduledStop.length > 0 && baseStatusKey === "ok"
      ? "in_progress"
      : baseStatusKey;

  const display = describePaymentDisplay(displayKey, {
    recentlyRecovered,
    scheduledCancelAt: scheduledStop[0]?.date ?? null,
  });

  const supabase = createSupabaseServerClient();
  const { count: bookingCount } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId)
    .eq("status", "reserved");

  const supportMonthlyTotal = supports.reduce(
    (sum, s) => sum + Number(s.monthly_amount ?? 0),
    0
  );
  const basicMonthly = contract?.plan?.monthly_amount ?? 0;
  const monthlyGrandTotal = supportMonthlyTotal + basicMonthly;

  const planBadgeText =
    summary?.primary_plan_name ?? (supports.length > 0 ? "支援会員" : "未加入");

  const nextPaymentAt =
    contract?.current_period_end ?? summary?.next_payment_at ?? null;
  const hasActiveRecurring =
    Boolean(nextPaymentAt) &&
    (displayKey === "ok" || displayKey === "failed" || displayKey === "in_progress");

  // Status indicator styling
  const statusBannerColor =
    displayKey === "ok" || displayKey === "in_progress"
      ? "from-brand to-brand-dark"
      : displayKey === "failed"
      ? "from-red-700 to-red-900"
      : "from-gray-600 to-gray-800";

  return (
    <div className="space-y-5">

      {/* ── Hero status banner ── */}
      <section className={`card bg-gradient-to-br ${statusBannerColor} text-white overflow-hidden relative`}>
        {/* Background pattern */}
        <div aria-hidden className="absolute inset-0 opacity-10">
          {["🐴","🐴","🐴"].map((e, i) => (
            <span
              key={i}
              className="absolute text-6xl select-none"
              style={{ right: `${i * 30 + 10}px`, top: `${i * 10 - 10}px`, transform: `rotate(${i * 15}deg)` }}
            >
              {e}
            </span>
          ))}
        </div>

        <div className="relative">
          <p className="text-sm opacity-80">こんにちは</p>
          <h1 className="text-2xl font-bold mt-0.5">{customer?.full_name ?? "会員"}様</h1>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "会員種別", value: planBadgeText },
              { label: "支援中", value: `${supports.length}頭` },
              { label: "月額合計", value: formatYen(monthlyGrandTotal) },
              { label: "予約", value: `${bookingCount ?? 0}件` },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-white/15 rounded-xl px-3 py-2.5 backdrop-blur-sm"
              >
                <p className="text-xs opacity-75">{item.label}</p>
                <p className="text-base font-bold mt-0.5 truncate">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Status detail card ── */}
      <section className="card">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="label">現在の会員種別</p>
            <p className="text-lg font-bold">{planBadgeText}</p>
            <Link href="/mypage/plan" className="text-brand underline text-sm">
              会員種別を変更
            </Link>
          </div>
          <div className="space-y-1">
            <p className="label">お支払い状況</p>
            <span className={display.chipClass}>{display.label}</span>
            <p className="text-sm text-ink-soft mt-1">{display.description}</p>
          </div>
          <div className="space-y-1">
            <p className="label">次回決済日</p>
            {hasActiveRecurring ? (
              <p className="text-lg font-semibold">{formatDate(nextPaymentAt, false)}</p>
            ) : (
              <p className="text-sm text-ink-soft">継続課金中のご契約はありません</p>
            )}
          </div>
          <div className="space-y-1">
            <p className="label">月額支援合計</p>
            <p className="text-lg font-bold">{formatYen(monthlyGrandTotal)}</p>
          </div>
        </div>

        {display.bannerMessage && displayKey === "ok" && (
          <div className="mt-4 p-3 rounded-xl bg-green-50 border border-green-200">
            <p className="text-sm text-green-800">{display.bannerMessage}</p>
          </div>
        )}
        {displayKey === "failed" && (
          <div className="mt-4 p-4 rounded-xl bg-red-50 border-2 border-red-200 flex items-start gap-3">
            <span className="text-xl shrink-0">⚠️</span>
            <div>
              <p className="font-bold text-danger">お支払いが完了していません</p>
              <p className="text-sm mt-1 text-ink-soft">
                「お支払い情報を変更」からカード情報をご確認ください。
              </p>
            </div>
          </div>
        )}
        {scheduledStop.length > 0 && (
          <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
            <p className="font-bold text-amber-800">停止予定の支援があります</p>
            {scheduledStop.map((s) => (
              <p key={s.id} className="text-sm text-amber-700">
                🐴 {s.name}：{formatDate(s.date, false)} をもって終了予定
              </p>
            ))}
          </div>
        )}
      </section>

      {/* ── Supported horses ── */}
      <section className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title mb-0">支援中の馬</h2>
          <Link className="text-brand underline text-sm font-medium" href="/mypage/supports/new">
            + 新しい支援を追加
          </Link>
        </div>

        {supports.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-4xl mb-3">🐴</p>
            <p className="text-ink-mute text-sm">現在、ご支援中の馬はありません。</p>
            <Link href="/mypage/supports/new" className="btn-primary inline-flex mt-4">
              馬を支援する
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-surface-line">
            {supports.map((s) => {
              const isScheduledStop =
                s.status === "active" &&
                s.canceled_at &&
                new Date(s.canceled_at).getTime() > now;

              const statusColor =
                s.status === "active"
                  ? isScheduledStop
                    ? "bg-amber-100 text-amber-800"
                    : "bg-green-100 text-green-800"
                  : s.status === "past_due"
                  ? "bg-red-100 text-red-800"
                  : "bg-gray-100 text-gray-700";

              const statusLabel =
                s.status === "active"
                  ? isScheduledStop
                    ? "停止予定"
                    : "有効"
                  : s.status === "past_due"
                  ? "決済失敗"
                  : s.status === "canceled"
                  ? "停止済"
                  : s.status;

              return (
                <li key={s.id} className="py-4">
                  <div className="flex items-start gap-3">
                    {/* Horse image */}
                    {s.horse?.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.horse.image_url} alt={s.horse?.name ?? ""} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center text-2xl shrink-0">🐴</div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-lg">{s.horse?.name ?? "—"}</p>
                        <span className={`chip text-xs ${statusColor}`}>{statusLabel}</span>
                      </div>
                      <p className="text-sm text-ink-soft mt-0.5">
                        {formatUnits(s.units)} / {formatYen(s.monthly_amount)} / 月
                      </p>
                      {isScheduledStop && (
                        <p className="text-xs text-amber-700 mt-1">
                          {formatDate(s.canceled_at, false)} をもって終了予定
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                      <Link href={`/mypage/supports/${s.id}`} className="btn-secondary !py-2 !px-3 text-sm">
                        変更
                      </Link>
                      <Link href={`/mypage/supports/${s.id}/stop`} className="btn-ghost !py-2 !px-3 text-sm text-danger">
                        停止
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {supports.length > 0 && (
          <div className="mt-4 pt-4 border-t border-surface-line">
            <Link href="/mypage/supports/new" className="btn-primary w-full">
              新しい支援を追加する
            </Link>
          </div>
        )}
      </section>

      {/* ── Quick actions ── */}
      <section>
        <h2 className="section-title">クイックアクション</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Link href="/mypage/donate" className="card hover:shadow-lg transition-shadow group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-50 group-hover:bg-brand-100 flex items-center justify-center text-2xl transition-colors shrink-0">
                💰
              </div>
              <div>
                <p className="text-xs text-ink-mute mb-0.5">単発寄付</p>
                <p className="text-lg font-bold">寄付する</p>
                <p className="text-xs text-ink-soft mt-0.5">一回限りの応援を行います。</p>
              </div>
            </div>
          </Link>
          <Link href="/mypage/bookings" className="card hover:shadow-lg transition-shadow group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-50 group-hover:bg-brand-100 flex items-center justify-center text-2xl transition-colors shrink-0">
                📅
              </div>
              <div>
                <p className="text-xs text-ink-mute mb-0.5">見学会・個別見学</p>
                <p className="text-lg font-bold">予約する</p>
                <p className="text-xs text-ink-soft mt-0.5">日程を選んで申し込みできます。</p>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* ── Recent payments mini-list ── */}
      {recentPayments.length > 0 && (
        <section className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title mb-0">直近の決済</h2>
            <Link href="/mypage/history" className="text-brand underline text-sm">
              全履歴を見る
            </Link>
          </div>
          <ul className="divide-y divide-surface-line">
            {recentPayments.slice(0, 3).map((p: any) => (
              <li key={p.id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{p.description ?? p.kind ?? "決済"}</p>
                  <p className="text-xs text-ink-mute">{formatDate(p.occurred_at, true)}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-bold tabular-nums">{formatYen(p.amount)}</span>
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
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Profile info ── */}
      <section className="card">
        <h2 className="section-title">登録情報</h2>
        <dl className="text-sm space-y-0 divide-y divide-surface-line">
          <div className="flex justify-between py-2.5">
            <dt className="text-ink-soft">メール</dt>
            <dd className="font-medium">{customer?.email ?? "—"}</dd>
          </div>
          <div className="flex justify-between py-2.5">
            <dt className="text-ink-soft">電話番号</dt>
            <dd className="font-medium">{customer?.phone ?? "—"}</dd>
          </div>
          <div className="flex justify-between py-2.5">
            <dt className="text-ink-soft">住所</dt>
            <dd className="text-right font-medium">
              {customer?.postal_code && <span>〒{customer.postal_code}<br /></span>}
              {customer?.address1}
              {customer?.address2 && <><br />{customer.address2}</>}
              {!customer?.address1 && "—"}
            </dd>
          </div>
        </dl>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
          <Link href="/mypage/profile" className="btn-secondary text-center">
            情報を変更
          </Link>
          <form action="/api/stripe/portal" method="post" className="contents">
            <button type="submit" className="btn-secondary w-full">
              お支払い情報を変更
            </button>
          </form>
          <Link href="/mypage/history" className="btn-ghost text-center">
            履歴を見る
          </Link>
        </div>
      </section>
    </div>
  );
}
