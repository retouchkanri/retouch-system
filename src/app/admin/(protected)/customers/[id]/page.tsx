import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, formatUnits, formatYen, statusLabel } from "@/lib/format";
import InfoEditor from "./InfoEditor";
import MemoEditor from "./MemoEditor";
import StatusEditor from "./StatusEditor";

export default async function CustomerDetail({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();

  const [
    { data: customer },
    { data: summary },
    { data: contracts },
    { data: supports },
    { data: donations },
    { data: bookings },
    { data: payments },
    { data: memos },
  ] = await Promise.all([
    supabase.from("customers").select("*").eq("id", params.id).maybeSingle(),
    supabase.from("v_customer_summary").select("*").eq("customer_id", params.id).maybeSingle(),
    supabase.from("contracts").select("*, plan:membership_plans(*)").eq("customer_id", params.id).order("started_at", { ascending: false }),
    supabase.from("support_subscriptions").select("*, horse:horses(*)").eq("customer_id", params.id).order("started_at", { ascending: false }),
    supabase.from("donations").select("*").eq("customer_id", params.id).order("donated_at", { ascending: false }),
    supabase.from("bookings").select("*, event:events(*)").eq("customer_id", params.id).order("booked_at", { ascending: false }),
    supabase.from("payments").select("*").eq("customer_id", params.id).order("occurred_at", { ascending: false }).limit(50),
    supabase.from("admin_memos").select("*").eq("customer_id", params.id).order("slot"),
  ]);

  if (!customer) return notFound();
  const c: any = customer;
  const s: any = summary;

  const supportIds = (supports ?? []).map((x: any) => x.id);
  const { data: supportAudits } = supportIds.length
    ? await supabase
        .from("audit_logs")
        .select("id, action, target_id, meta, created_at")
        .eq("target_table", "support_subscriptions")
        .in("target_id", supportIds)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] as any[] };

  const bookingIds = (bookings ?? []).map((b: any) => b.id);
  const { data: bookingAudits } = bookingIds.length
    ? await supabase
        .from("audit_logs")
        .select("id, action, target_id, meta, created_at")
        .eq("target_table", "bookings")
        .in("target_id", bookingIds)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] as any[] };
  const bookingByAuditId = new Map<string, any>();
  for (const b of bookings ?? []) bookingByAuditId.set((b as any).id, b);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/customers" className="text-brand underline text-sm">← 顧客一覧</Link>
          <h1 className="text-2xl font-bold mt-1">{c.full_name} 様</h1>
          <p className="text-sm text-ink-soft">{c.email ?? "—"}  /  {c.phone ?? "—"}</p>
        </div>
        <StatusEditor customerId={c.id} initialStatus={c.status} />
      </div>

      <div className="grid md:grid-cols-4 gap-3">
        <div className="card">
          <p className="text-xs text-ink-soft">会員種別</p>
          <p className="text-lg font-bold">{s?.primary_plan_name ?? "—"}</p>
        </div>
        <div className="card">
          <p className="text-xs text-ink-soft">支援状況</p>
          <p className="text-lg font-bold">{s?.total_support_horses ?? 0}頭 / {formatUnits(s?.total_support_units ?? 0)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-ink-soft">月額合計</p>
          <p className="text-lg font-bold">{formatYen(s?.monthly_total ?? 0)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-ink-soft">次回決済</p>
          <p className="text-lg font-bold">{formatDate(s?.next_payment_at)}</p>
        </div>
      </div>

      <section className="card">
        <h2 className="section-title">基本情報</h2>
        <InfoEditor
          customerId={c.id}
          initial={{
            full_name: c.full_name ?? null,
            full_name_kana: c.full_name_kana ?? null,
            email: c.email ?? null,
            phone: c.phone ?? null,
            birthday: c.birthday ?? null,
            gender: c.gender ?? null,
            postal_code: c.postal_code ?? null,
            address1: c.address1 ?? null,
            address2: c.address2 ?? null,
          }}
        />
        <dl className="mt-3 pt-3 border-t border-surface-line grid md:grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <div className="flex justify-between py-1.5 border-b border-surface-line">
            <dt className="text-ink-soft">Stripe Customer</dt>
            <dd className="font-mono text-xs">{c.stripe_customer_id ?? "—"}</dd>
          </div>
          <div className="flex justify-between py-1.5 border-b border-surface-line">
            <dt className="text-ink-soft">加入日</dt>
            <dd>{formatDate(c.joined_at)}</dd>
          </div>
        </dl>
      </section>

      <section className="card">
        <h2 className="section-title">支援履歴</h2>
        <table className="table">
          <thead><tr><th className="w-12 text-right">No.</th><th>馬</th><th>口数</th><th>月額</th><th>状態</th><th>開始</th><th>停止</th></tr></thead>
          <tbody>
            {(supports ?? []).map((x: any, i: number) => (
              <tr key={x.id}>
                <td className="text-right text-ink-mute tabular-nums">{i + 1}</td>
                <td>{x.horse?.name ?? "—"}</td>
                <td>{formatUnits(x.units)}</td>
                <td>{formatYen(x.monthly_amount)}</td>
                <td>{statusLabel(x.status)}</td>
                <td>{formatDate(x.started_at)}</td>
                <td>{x.canceled_at ? formatDate(x.canceled_at) : "—"}</td>
              </tr>
            ))}
            {(supports ?? []).length === 0 && <tr><td colSpan={7} className="text-center text-ink-mute py-3">支援履歴はまだありません。</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 className="section-title">支援の変更・停止履歴</h2>
        {(supportAudits ?? []).length === 0 ? (
          <p className="text-ink-mute text-sm">変更・停止の履歴はまだありません。</p>
        ) : (
          <table className="table">
            <thead><tr><th className="w-12 text-right">No.</th><th>日時</th><th>種別</th><th>対象馬</th><th>内容</th></tr></thead>
            <tbody>
              {(supportAudits ?? []).map((a: any, i: number) => {
                const m = a.meta ?? {};
                const kind =
                  a.action === "support.create" ? "新規追加" :
                  a.action === "support.update" ? "変更" :
                  a.action === "support.cancel" ? "停止" : a.action;
                let detail = "—";
                if (a.action === "support.create") {
                  detail = `${formatUnits(m.units)} / ${formatYen(m.monthly)}`;
                } else if (a.action === "support.update") {
                  const from = `${formatUnits(m.prev_units)} (${formatYen(m.prev_monthly)})`;
                  const to = `${formatUnits(m.units)} (${formatYen(m.monthly)})`;
                  detail = `${from} → ${to}`;
                } else if (a.action === "support.cancel") {
                  detail = `${formatUnits(m.units)} / ${formatYen(m.monthly)} を停止`;
                }
                return (
                  <tr key={a.id}>
                    <td className="text-right text-ink-mute tabular-nums">{i + 1}</td>
                    <td>{formatDate(a.created_at, true)}</td>
                    <td>
                      <span className={
                        a.action === "support.create" ? "chip-ok" :
                        a.action === "support.cancel" ? "chip-error" : "chip-warn"
                      }>{kind}</span>
                    </td>
                    <td>{m.horse_name ?? "—"}</td>
                    <td className="text-sm">{detail}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2 className="section-title">契約</h2>
        <table className="table">
          <thead><tr><th className="w-12 text-right">No.</th><th>プラン</th><th>状態</th><th>開始</th><th>次回決済</th><th>停止</th></tr></thead>
          <tbody>
            {(contracts ?? []).map((x: any, i: number) => (
              <tr key={x.id}>
                <td className="text-right text-ink-mute tabular-nums">{i + 1}</td>
                <td>{x.plan?.name ?? "—"}</td>
                <td>{statusLabel(x.status)}</td>
                <td>{formatDate(x.started_at)}</td>
                <td>{formatDate(x.current_period_end)}</td>
                <td>{x.canceled_at ? formatDate(x.canceled_at) : "—"}</td>
              </tr>
            ))}
            {(contracts ?? []).length === 0 && <tr><td colSpan={6} className="text-center text-ink-mute py-3">契約はまだありません。</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 className="section-title">寄付履歴</h2>
        <table className="table">
          <thead><tr><th className="w-12 text-right">No.</th><th>日時</th><th>金額</th><th>状態</th><th>メッセージ</th></tr></thead>
          <tbody>
            {(donations ?? []).map((d: any, i: number) => (
              <tr key={d.id}>
                <td className="text-right text-ink-mute tabular-nums">{i + 1}</td>
                <td>{formatDate(d.donated_at, true)}</td>
                <td>{formatYen(d.amount)}</td>
                <td>{statusLabel(d.status)}</td>
                <td className="text-xs">{d.message ?? "—"}</td>
              </tr>
            ))}
            {(donations ?? []).length === 0 && <tr><td colSpan={5} className="text-center text-ink-mute py-3">寄付履歴はまだありません。</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 className="section-title">見学会・個別見学 履歴</h2>
        <table className="table">
          <thead><tr><th className="w-12 text-right">No.</th><th>種別</th><th>タイトル</th><th>日時</th><th>人数</th><th>状態</th></tr></thead>
          <tbody>
            {(bookings ?? []).map((b: any, i: number) => (
              <tr key={b.id}>
                <td className="text-right text-ink-mute tabular-nums">{i + 1}</td>
                <td>{b.event?.type === "private_visit" ? "個別見学" : "見学会"}</td>
                <td>{b.event?.title}</td>
                <td>{formatDate(b.event?.starts_at, true)}</td>
                <td>{b.party_size}</td>
                <td>{statusLabel(b.status)}</td>
              </tr>
            ))}
            {(bookings ?? []).length === 0 && <tr><td colSpan={6} className="text-center text-ink-mute py-3">見学履歴はまだありません。</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 className="section-title">予約の変更・キャンセル履歴</h2>
        {(bookingAudits ?? []).length === 0 ? (
          <p className="text-ink-mute text-sm">操作履歴はまだありません。</p>
        ) : (
          <table className="table">
            <thead><tr><th className="w-12 text-right">No.</th><th>日時</th><th>操作</th><th>対象イベント</th><th>内容</th></tr></thead>
            <tbody>
              {(bookingAudits ?? []).map((a: any, i: number) => {
                const m = a.meta ?? {};
                const target = bookingByAuditId.get(a.target_id);
                const eventTitle = target?.event?.title ?? m.event_title ?? "—";
                let kindLabel = a.action;
                let chipClass = "chip-mute";
                if (a.action === "booking.create") { kindLabel = "管理者：追加"; chipClass = "chip-ok"; }
                else if (a.action === "booking.update") { kindLabel = "管理者：変更"; chipClass = "chip-warn"; }
                else if (a.action === "booking.cancel") { kindLabel = "管理者：取消"; chipClass = "chip-error"; }
                else if (a.action === "booking.delete") { kindLabel = "管理者：削除"; chipClass = "chip-error"; }
                else if (a.action === "booking.self_create") { kindLabel = "会員：申込"; chipClass = "chip-ok"; }
                else if (a.action === "booking.self_update") { kindLabel = "会員：変更"; chipClass = "chip-warn"; }
                else if (a.action === "booking.self_cancel") { kindLabel = "会員：取消"; chipClass = "chip-error"; }

                let detail = "—";
                if (a.action.endsWith("create") || a.action.endsWith("self_create")) {
                  detail = `${m.party_size ?? "?"}名`;
                } else if (a.action.endsWith("update") || a.action.endsWith("self_update")) {
                  const prev = m.prev ?? {};
                  const next = m.next ?? {};
                  if (prev.party_size !== undefined && next.party_size !== undefined) {
                    detail = `人数 ${prev.party_size} → ${next.party_size}`;
                  } else if (next.status) {
                    detail = `状態 → ${statusLabel(next.status)}`;
                  } else {
                    detail = JSON.stringify(next).slice(0, 80);
                  }
                } else if (a.action.endsWith("cancel") || a.action.endsWith("delete")) {
                  detail = `${m.party_size ?? ""}名 取消／削除`;
                }
                return (
                  <tr key={a.id}>
                    <td className="text-right text-ink-mute tabular-nums">{i + 1}</td>
                    <td className="whitespace-nowrap text-xs">{formatDate(a.created_at, true)}</td>
                    <td><span className={chipClass}>{kindLabel}</span></td>
                    <td className="text-xs">{eventTitle}</td>
                    <td className="text-xs">{detail}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2 className="section-title">決済履歴</h2>
        <table className="table">
          <thead><tr><th className="w-12 text-right">No.</th><th>日時</th><th>種別</th><th>金額</th><th>状態</th><th>失敗理由</th></tr></thead>
          <tbody>
            {(payments ?? []).map((p: any, i: number) => (
              <tr key={p.id}>
                <td className="text-right text-ink-mute tabular-nums">{i + 1}</td>
                <td>{formatDate(p.occurred_at, true)}</td>
                <td>{p.kind}</td>
                <td>{formatYen(p.amount)}</td>
                <td>{statusLabel(p.status)}</td>
                <td className="text-xs">{p.failure_reason ?? "—"}</td>
              </tr>
            ))}
            {(payments ?? []).length === 0 && <tr><td colSpan={6} className="text-center text-ink-mute py-3">決済履歴はまだありません。</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 className="section-title">内部メモ（顧客には非表示）</h2>
        <MemoEditor customerId={c.id} initial={(memos as any[]) ?? []} />
      </section>
    </div>
  );
}
