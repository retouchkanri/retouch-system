import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, formatYen, statusLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

type AnyRow = Record<string, any>;

/**
 * Admin cross-search.
 *
 * 1. Build candidate `customer_ids` / `horse_ids` at the DB layer from the
 *    keyword (name / kana / email / phone / address / memo body / stripe id).
 * 2. Fan out to every related table filtering by those id sets + direct
 *    field matches. No in-memory `String.includes` filtering.
 * 3. `admin_memos` (internal memos) are now a first-class scope AND feed
 *    the customer-id pool so memo hits surface everywhere.
 */
export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams: { q?: string; scope?: string };
}) {
  const q = (searchParams.q ?? "").trim();
  const scope = (searchParams.scope ?? "all").trim();
  const supabase = createSupabaseServerClient();

  let customers: AnyRow[] = [];
  let supports: AnyRow[] = [];
  let donations: AnyRow[] = [];
  let bookings: AnyRow[] = [];
  let payments: AnyRow[] = [];
  let horses: AnyRow[] = [];
  let memos: AnyRow[] = [];

  if (q.length > 0) {
    const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    const wantsAll = scope === "all";
    const wantsCustomers = wantsAll || scope === "customers";
    const wantsSupports = wantsAll || scope === "supports";
    const wantsDonations = wantsAll || scope === "donations";
    const wantsBookings = wantsAll || scope === "bookings";
    const wantsPayments = wantsAll || scope === "payments";
    const wantsHorses = wantsAll || scope === "horses";
    const wantsMemos = wantsAll || scope === "memos";

    // --- 1. Candidate pools -------------------------------------------------
    const [{ data: custMatches }, { data: horseMatches }, { data: memoMatches }] =
      await Promise.all([
        supabase
          .from("customers")
          .select(
            "id, full_name, full_name_kana, email, phone, status, avatar_url, joined_at",
          )
          .or(
            [
              `full_name.ilike.${like}`,
              `full_name_kana.ilike.${like}`,
              `email.ilike.${like}`,
              `phone.ilike.${like}`,
              `postal_code.ilike.${like}`,
              `address1.ilike.${like}`,
              `address2.ilike.${like}`,
              `stripe_customer_id.ilike.${like}`,
            ].join(","),
          )
          .order("full_name")
          .limit(200),
        supabase
          .from("horses")
          .select("id, name, name_kana, sex, birth_year, profile, sort_order")
          .or(
            [`name.ilike.${like}`, `name_kana.ilike.${like}`, `profile.ilike.${like}`].join(","),
          )
          .order("sort_order")
          .limit(100),
        supabase
          .from("admin_memos")
          .select("id, customer_id, slot, body, updated_at, customer:customers(id, full_name, email)")
          .ilike("body", like)
          .order("updated_at", { ascending: false })
          .limit(100),
      ]);

    const candidateCustomers = (custMatches as AnyRow[]) ?? [];
    const candidateHorses = (horseMatches as AnyRow[]) ?? [];
    const candidateMemos = (memoMatches as AnyRow[]) ?? [];

    // Merge customer ids from memo hits so downstream scopes pick them up.
    const customerIdSet = new Set<string>(candidateCustomers.map((c) => c.id));
    for (const m of candidateMemos) {
      if (m.customer_id) customerIdSet.add(m.customer_id);
    }
    const horseIdSet = new Set<string>(candidateHorses.map((h) => h.id));
    const customerIds = [...customerIdSet];
    const horseIds = [...horseIdSet];

    if (wantsCustomers) {
      // Pull ALL customers hit through direct fields OR memo matches.
      if (customerIds.length > 0) {
        const { data } = await supabase
          .from("customers")
          .select("id, full_name, full_name_kana, email, phone, status, avatar_url, joined_at")
          .in("id", customerIds)
          .order("full_name")
          .limit(100);
        customers = (data as AnyRow[]) ?? [];
      } else {
        customers = [];
      }
    }
    if (wantsHorses) horses = candidateHorses;
    if (wantsMemos) memos = candidateMemos;

    const tasks: Array<() => Promise<void>> = [];

    if (wantsSupports) {
      tasks.push(async () => {
        const orParts: string[] = [];
        if (customerIds.length > 0) orParts.push(`customer_id.in.(${customerIds.join(",")})`);
        if (horseIds.length > 0) orParts.push(`horse_id.in.(${horseIds.join(",")})`);
        if (orParts.length === 0) {
          supports = [];
          return;
        }
        const { data } = await supabase
          .from("support_subscriptions")
          .select(
            "id, units, monthly_amount, status, started_at, canceled_at, customer:customers(id, full_name, email), horse:horses(id, name)",
          )
          .or(orParts.join(","))
          .order("started_at", { ascending: false })
          .limit(200);
        supports = (data as AnyRow[]) ?? [];
      });
    }

    if (wantsDonations) {
      tasks.push(async () => {
        const orParts: string[] = [
          `donor_name.ilike.${like}`,
          `donor_email.ilike.${like}`,
          `message.ilike.${like}`,
          `stripe_payment_intent_id.ilike.${like}`,
        ];
        if (customerIds.length > 0) orParts.push(`customer_id.in.(${customerIds.join(",")})`);
        const { data } = await supabase
          .from("donations")
          .select(
            "id, amount, message, status, donated_at, donor_name, donor_email, customer:customers(id, full_name, email)",
          )
          .or(orParts.join(","))
          .order("donated_at", { ascending: false })
          .limit(200);
        donations = (data as AnyRow[]) ?? [];
      });
    }

    if (wantsBookings) {
      tasks.push(async () => {
        const { data: matchedEvents } = await supabase
          .from("events")
          .select("id, title")
          .or([`title.ilike.${like}`, `description.ilike.${like}`, `location.ilike.${like}`].join(","))
          .limit(50);
        const eventIds = ((matchedEvents as AnyRow[] | null) ?? []).map((e) => e.id);

        const orParts: string[] = [`note.ilike.${like}`];
        if (customerIds.length > 0) orParts.push(`customer_id.in.(${customerIds.join(",")})`);
        if (eventIds.length > 0) orParts.push(`event_id.in.(${eventIds.join(",")})`);

        const { data } = await supabase
          .from("bookings")
          .select(
            "id, party_size, note, status, booked_at, customer:customers(id, full_name, email), event:events(id, title, type, starts_at)",
          )
          .or(orParts.join(","))
          .order("booked_at", { ascending: false })
          .limit(200);
        bookings = (data as AnyRow[]) ?? [];
      });
    }

    if (wantsPayments) {
      tasks.push(async () => {
        const orParts: string[] = [
          `stripe_payment_intent_id.ilike.${like}`,
          `stripe_invoice_id.ilike.${like}`,
          `failure_reason.ilike.${like}`,
        ];
        if (customerIds.length > 0) orParts.push(`customer_id.in.(${customerIds.join(",")})`);
        const { data } = await supabase
          .from("payments")
          .select(
            "id, amount, kind, status, occurred_at, failure_reason, stripe_payment_intent_id, stripe_invoice_id, customer:customers(id, full_name, email)",
          )
          .or(orParts.join(","))
          .order("occurred_at", { ascending: false })
          .limit(200);
        payments = (data as AnyRow[]) ?? [];
      });
    }

    await Promise.all(tasks.map((fn) => fn()));
  }

  const totalHits =
    customers.length +
    supports.length +
    donations.length +
    bookings.length +
    payments.length +
    horses.length +
    memos.length;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">横断検索</h1>

      <form method="get" className="card flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="氏名 / メール / 電話 / 馬名 / 社内メモ / Stripe ID など"
          className="input flex-1 min-w-[260px]"
          autoFocus
        />
        <select name="scope" defaultValue={scope} className="input w-auto">
          <option value="all">すべて</option>
          <option value="customers">顧客</option>
          <option value="horses">馬</option>
          <option value="supports">支援</option>
          <option value="donations">寄付</option>
          <option value="bookings">予約</option>
          <option value="payments">決済</option>
          <option value="memos">社内メモ</option>
        </select>
        <button className="btn-primary !py-2 !px-4">検索</button>
      </form>

      {q.length === 0 ? (
        <p className="card text-ink-mute text-sm">
          キーワードを入力して検索してください。顧客・馬・支援・寄付・予約・決済・社内メモを横断的に探せます。
        </p>
      ) : (
        <p className="text-sm text-ink-soft">
          「{q}」の検索結果：合計 <span className="font-bold">{totalHits}</span> 件
        </p>
      )}

      {customers.length > 0 && (
        <section className="card">
          <h2 className="section-title">
            顧客 <span className="text-ink-mute text-sm">({customers.length})</span>
          </h2>
          <table className="table">
            <thead>
              <tr>
                <th className="w-12 text-right">No.</th>
                <th></th>
                <th>氏名</th>
                <th>メール</th>
                <th>電話</th>
                <th>状態</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c, i) => (
                <tr key={c.id} className="hover:bg-surface-soft">
                  <td className="text-right text-ink-mute tabular-nums">{i + 1}</td>
                  <td>
                    {c.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.avatar_url}
                        alt=""
                        className="w-9 h-9 rounded-full object-cover border border-surface-line"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-surface-soft border border-surface-line" />
                    )}
                  </td>
                  <td className="font-semibold">{c.full_name}</td>
                  <td>{c.email ?? "—"}</td>
                  <td>{c.phone ?? "—"}</td>
                  <td>{statusLabel(c.status)}</td>
                  <td className="text-right">
                    <Link href={`/admin/customers/${c.id}`} className="text-brand underline">
                      詳細
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {horses.length > 0 && (
        <section className="card">
          <h2 className="section-title">
            馬 <span className="text-ink-mute text-sm">({horses.length})</span>
          </h2>
          <table className="table">
            <thead>
              <tr>
                <th className="w-12 text-right">No.</th>
                <th>名前</th>
                <th>カナ</th>
                <th>性別</th>
                <th>生年</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {horses.map((h, i) => (
                <tr key={h.id}>
                  <td className="text-right text-ink-mute tabular-nums">{i + 1}</td>
                  <td className="font-semibold">{h.name}</td>
                  <td>{h.name_kana ?? "—"}</td>
                  <td>{h.sex ?? "—"}</td>
                  <td>{h.birth_year ?? "—"}</td>
                  <td className="text-right">
                    <Link href={`/admin/horses/${h.id}`} className="text-brand underline">
                      詳細
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {supports.length > 0 && (
        <section className="card">
          <h2 className="section-title">
            支援 <span className="text-ink-mute text-sm">({supports.length})</span>
          </h2>
          <table className="table">
            <thead>
              <tr>
                <th className="w-12 text-right">No.</th>
                <th>顧客</th>
                <th>馬</th>
                <th>口数</th>
                <th>月額</th>
                <th>状態</th>
                <th>開始</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {supports.map((s, i) => (
                <tr key={s.id}>
                  <td className="text-right text-ink-mute tabular-nums">{i + 1}</td>
                  <td className="font-semibold">{s.customer?.full_name ?? "—"}</td>
                  <td>{s.horse?.name ?? "—"}</td>
                  <td>{s.units}口</td>
                  <td>{formatYen(s.monthly_amount)}</td>
                  <td>{statusLabel(s.status)}</td>
                  <td>{formatDate(s.started_at)}</td>
                  <td className="text-right">
                    {s.customer?.id && (
                      <Link
                        href={`/admin/customers/${s.customer.id}`}
                        className="text-brand underline"
                      >
                        顧客
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {donations.length > 0 && (
        <section className="card">
          <h2 className="section-title">
            寄付 <span className="text-ink-mute text-sm">({donations.length})</span>
          </h2>
          <table className="table">
            <thead>
              <tr>
                <th className="w-12 text-right">No.</th>
                <th>日時</th>
                <th>顧客/寄付者</th>
                <th>金額</th>
                <th>状態</th>
                <th>メッセージ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {donations.map((d, i) => (
                <tr key={d.id}>
                  <td className="text-right text-ink-mute tabular-nums">{i + 1}</td>
                  <td>{formatDate(d.donated_at, true)}</td>
                  <td>{d.customer?.full_name ?? d.donor_name ?? "—"}</td>
                  <td>{formatYen(d.amount)}</td>
                  <td>{statusLabel(d.status)}</td>
                  <td className="text-xs">{d.message ?? "—"}</td>
                  <td className="text-right">
                    {d.customer?.id && (
                      <Link
                        href={`/admin/customers/${d.customer.id}`}
                        className="text-brand underline"
                      >
                        顧客
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {bookings.length > 0 && (
        <section className="card">
          <h2 className="section-title">
            予約 <span className="text-ink-mute text-sm">({bookings.length})</span>
          </h2>
          <table className="table">
            <thead>
              <tr>
                <th className="w-12 text-right">No.</th>
                <th>種別</th>
                <th>イベント</th>
                <th>日時</th>
                <th>顧客</th>
                <th>人数</th>
                <th>状態</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b, i) => (
                <tr key={b.id}>
                  <td className="text-right text-ink-mute tabular-nums">{i + 1}</td>
                  <td>{b.event?.type === "private_visit" ? "個別見学" : "見学会"}</td>
                  <td>{b.event?.title ?? "—"}</td>
                  <td>{formatDate(b.event?.starts_at, true)}</td>
                  <td>{b.customer?.full_name ?? "—"}</td>
                  <td>{b.party_size}名</td>
                  <td>{statusLabel(b.status)}</td>
                  <td className="text-right">
                    {b.customer?.id && (
                      <Link
                        href={`/admin/customers/${b.customer.id}`}
                        className="text-brand underline"
                      >
                        顧客
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {payments.length > 0 && (
        <section className="card">
          <h2 className="section-title">
            決済 <span className="text-ink-mute text-sm">({payments.length})</span>
          </h2>
          <table className="table">
            <thead>
              <tr>
                <th className="w-12 text-right">No.</th>
                <th>日時</th>
                <th>顧客</th>
                <th>種別</th>
                <th>金額</th>
                <th>状態</th>
                <th>Stripe ID</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <tr key={p.id}>
                  <td className="text-right text-ink-mute tabular-nums">{i + 1}</td>
                  <td>{formatDate(p.occurred_at, true)}</td>
                  <td>{p.customer?.full_name ?? "—"}</td>
                  <td>{p.kind}</td>
                  <td>{formatYen(p.amount)}</td>
                  <td>{statusLabel(p.status)}</td>
                  <td className="font-mono text-xs">
                    {p.stripe_payment_intent_id ?? p.stripe_invoice_id ?? "—"}
                  </td>
                  <td className="text-right">
                    {p.customer?.id && (
                      <Link
                        href={`/admin/customers/${p.customer.id}`}
                        className="text-brand underline"
                      >
                        顧客
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {memos.length > 0 && (
        <section className="card">
          <h2 className="section-title">
            社内メモ <span className="text-ink-mute text-sm">({memos.length})</span>
          </h2>
          <table className="table">
            <thead>
              <tr>
                <th className="w-12 text-right">No.</th>
                <th>更新</th>
                <th>顧客</th>
                <th>枠</th>
                <th>本文</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {memos.map((m, i) => (
                <tr key={m.id}>
                  <td className="text-right text-ink-mute tabular-nums">{i + 1}</td>
                  <td>{formatDate(m.updated_at, true)}</td>
                  <td className="font-semibold">{m.customer?.full_name ?? "—"}</td>
                  <td>#{m.slot}</td>
                  <td className="text-xs whitespace-pre-wrap max-w-[520px]">
                    {m.body?.length > 200 ? `${m.body.slice(0, 200)}…` : m.body}
                  </td>
                  <td className="text-right">
                    {m.customer?.id && (
                      <Link
                        href={`/admin/customers/${m.customer.id}`}
                        className="text-brand underline"
                      >
                        顧客
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {q.length > 0 && totalHits === 0 && (
        <div className="card text-center text-ink-mute">該当する結果は見つかりませんでした。</div>
      )}
    </div>
  );
}
