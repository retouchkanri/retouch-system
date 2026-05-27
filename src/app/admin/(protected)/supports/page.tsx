import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, formatUnits, formatYen, statusLabel } from "@/lib/format";
import SupportRow from "./SupportRow";
import SupportForm from "./SupportForm";

const PAGE_SIZE = 50;

export default async function AdminSupportsPage({
  searchParams,
}: {
  searchParams?: { status?: string; q?: string; horse?: string; page?: string };
}) {
  const supabase = createSupabaseServerClient();
  const status = searchParams?.status ?? "";
  const q = (searchParams?.q ?? "").trim();
  const horse = searchParams?.horse ?? "";
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const from = (page - 1) * PAGE_SIZE;

  const [{ data: horses }, { data: horseStats }] = await Promise.all([
    supabase.from("horses").select("id, name").order("sort_order"),
    supabase
      .from("support_subscriptions")
      .select("horse_id, units, monthly_amount, status, horse:horses(name)")
      .eq("status", "active"),
  ]);

  let query = supabase
    .from("support_subscriptions")
    .select(
      "*, customer:customers(full_name, email), horse:horses(name)",
      { count: "exact" },
    )
    .order("started_at", { ascending: false });
  if (status) query = query.eq("status", status);
  if (horse) query = query.eq("horse_id", horse);

  const { data, count } = await query.range(from, from + PAGE_SIZE - 1);

  const filtered = q
    ? (data ?? []).filter((s: any) => {
        const hay = `${s.customer?.full_name ?? ""} ${s.customer?.email ?? ""} ${s.horse?.name ?? ""}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      })
    : data ?? [];

  // horse-wise visualization
  const stats = new Map<string, { name: string; units: number; monthly: number; supporters: number }>();
  for (const r of horseStats ?? []) {
    const id = (r as any).horse_id as string;
    const name = (r as any).horse?.name ?? "—";
    const cur = stats.get(id) ?? { name, units: 0, monthly: 0, supporters: 0 };
    cur.units += Number((r as any).units ?? 0);
    cur.monthly += Number((r as any).monthly_amount ?? 0);
    cur.supporters += 1;
    stats.set(id, cur);
  }
  const horseSummary = Array.from(stats.entries()).sort((a, b) => b[1].monthly - a[1].monthly);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">支援管理</h1>
        <span className="text-sm text-ink-soft">全 {count ?? 0} 件</span>
      </div>

      {horseSummary.length > 0 && (
        <div className="card">
          <h2 className="section-title">馬ごとの支援状況</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
            {horseSummary.map(([id, s]) => (
              <div key={id} className="p-3 rounded-xl border border-surface-line">
                <p className="font-bold">{s.name}</p>
                <p className="text-xs text-ink-soft">
                  支援者 {s.supporters}名 / {formatUnits(s.units)} / {formatYen(s.monthly)}月
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <details className="card">
        <summary className="cursor-pointer font-semibold">＋ 手動で支援を追加</summary>
        <div className="mt-3">
          <SupportForm horses={(horses as any[]) ?? []} />
        </div>
      </details>

      <form className="card flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="label">顧客／メール</label>
          <input name="q" className="input" defaultValue={q} placeholder="検索..." />
        </div>
        <div>
          <label className="label">状態</label>
          <select name="status" className="input" defaultValue={status}>
            <option value="">すべて</option>
            <option value="active">有効</option>
            <option value="past_due">決済失敗</option>
            <option value="canceled">停止</option>
            <option value="paused">一時停止</option>
          </select>
        </div>
        <div>
          <label className="label">馬</label>
          <select name="horse" className="input" defaultValue={horse}>
            <option value="">すべて</option>
            {(horses as any[] | null)?.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-primary">絞り込む</button>
        {(q || status || horse) && (
          <Link className="btn-ghost" href="/admin/supports">
            リセット
          </Link>
        )}
      </form>

      <div className="card p-0 overflow-auto">
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
              <th>停止</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s: any, i: number) => (
              <SupportRow
                key={s.id}
                index={from + i + 1}
                support={{
                  id: s.id,
                  customer_id: s.customer_id,
                  customer_name: s.customer?.full_name ?? "—",
                  customer_email: s.customer?.email ?? "",
                  horse_name: s.horse?.name ?? "—",
                  units: Number(s.units ?? 0),
                  units_label: formatUnits(s.units),
                  monthly_amount: Number(s.monthly_amount ?? 0),
                  monthly_label: formatYen(s.monthly_amount),
                  status: s.status,
                  status_label: statusLabel(s.status),
                  started_at: formatDate(s.started_at),
                  canceled_at: s.canceled_at ? formatDate(s.canceled_at) : "—",
                }}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-6 text-ink-mute">
                  該当する支援がありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => {
            const qs = new URLSearchParams();
            if (status) qs.set("status", status);
            if (horse) qs.set("horse", horse);
            if (q) qs.set("q", q);
            qs.set("page", String(n));
            return (
              <Link
                key={n}
                href={`/admin/supports?${qs.toString()}`}
                className={`px-3 py-1 rounded-lg border ${n === page ? "bg-brand text-white border-brand" : "border-surface-line"}`}
              >
                {n}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
