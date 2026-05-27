import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, formatYen, statusLabel } from "@/lib/format";
import ContractRow from "./ContractRow";

const PAGE_SIZE = 50;

export default async function AdminContractsPage({
  searchParams,
}: {
  searchParams?: { status?: string; q?: string; page?: string };
}) {
  const supabase = createSupabaseServerClient();
  const status = searchParams?.status ?? "";
  const q = (searchParams?.q ?? "").trim();
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("contracts")
    .select("*, plan:membership_plans(name, code, monthly_amount), customer:customers(full_name, email)", { count: "exact" })
    .order("started_at", { ascending: false });
  if (status) query = query.eq("status", status);

  const { data, count } = await query.range(from, from + PAGE_SIZE - 1);

  const filtered = q
    ? (data ?? []).filter((c: any) => {
        const hay = `${c.customer?.full_name ?? ""} ${c.customer?.email ?? ""} ${c.plan?.name ?? ""}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      })
    : data ?? [];

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">契約一覧</h1>
        <span className="text-sm text-ink-soft">全 {count ?? 0} 件</span>
      </div>

      <form className="card flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="label">氏名／メール／プラン</label>
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
            <option value="incomplete">手続き中</option>
          </select>
        </div>
        <button className="btn-primary">絞り込む</button>
        {(q || status) && (
          <Link className="btn-ghost" href="/admin/contracts">
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
              <th>プラン</th>
              <th>月額</th>
              <th>状態</th>
              <th>開始</th>
              <th>次回決済</th>
              <th>停止</th>
              <th>Stripe</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c: any, i: number) => (
              <ContractRow
                key={c.id}
                index={from + i + 1}
                contract={{
                  id: c.id,
                  customer_id: c.customer_id,
                  plan_id: c.plan_id,
                  status: c.status,
                  started_at: formatDate(c.started_at),
                  current_period_end: c.current_period_end ?? null,
                  canceled_at: c.canceled_at ? formatDate(c.canceled_at) : "—",
                  stripe_subscription_id: c.stripe_subscription_id ?? null,
                  customer_name: c.customer?.full_name ?? "—",
                  customer_email: c.customer?.email ?? "",
                  plan_name: c.plan?.name ?? "—",
                  monthly_yen: formatYen(c.plan?.monthly_amount ?? 0),
                  status_label: statusLabel(c.status),
                }}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-6 text-ink-mute">
                  該当する契約がありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/contracts?page=${p}${status ? `&status=${status}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`px-3 py-1 rounded-lg border ${p === page ? "bg-brand text-white border-brand" : "border-surface-line"}`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
