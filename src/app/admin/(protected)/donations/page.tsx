import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, formatYen, statusLabel } from "@/lib/format";
import DonationRow from "./DonationRow";
import DonationForm from "./DonationForm";

const PAGE_SIZE = 50;

export default async function AdminDonationsPage({
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
    .from("donations")
    .select("*, customer:customers(full_name, email)", { count: "exact" })
    .order("donated_at", { ascending: false });
  if (status) query = query.eq("status", status);

  const { data, count } = await query.range(from, from + PAGE_SIZE - 1);

  const filtered = q
    ? (data ?? []).filter((d: any) => {
        const hay = `${d.customer?.full_name ?? ""} ${d.customer?.email ?? ""} ${d.donor_name ?? ""} ${d.donor_email ?? ""} ${d.message ?? ""}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      })
    : data ?? [];

  const total = filtered.reduce(
    (acc: number, d: any) => (d.status === "succeeded" ? acc + Number(d.amount ?? 0) : acc),
    0,
  );
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">寄付一覧</h1>
        <div className="text-sm text-ink-soft">
          全 {count ?? 0} 件 / 成功合計（表示範囲） {formatYen(total)}
        </div>
      </div>

      <details className="card">
        <summary className="cursor-pointer font-semibold">＋ 手動で寄付を追加</summary>
        <div className="mt-3">
          <DonationForm />
        </div>
      </details>

      <form className="card flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="label">検索</label>
          <input name="q" className="input" defaultValue={q} placeholder="氏名、メール、メッセージ..." />
        </div>
        <div>
          <label className="label">状態</label>
          <select name="status" className="input" defaultValue={status}>
            <option value="">すべて</option>
            <option value="succeeded">成功</option>
            <option value="pending">保留</option>
            <option value="failed">失敗</option>
            <option value="refunded">返金済</option>
          </select>
        </div>
        <button className="btn-primary">絞り込む</button>
        {(q || status) && (
          <Link className="btn-ghost" href="/admin/donations">
            リセット
          </Link>
        )}
      </form>

      <div className="card p-0 overflow-auto">
        <table className="table">
          <thead>
            <tr>
              <th className="w-12 text-right">No.</th>
              <th>日時</th>
              <th>寄付者</th>
              <th>会員</th>
              <th>金額</th>
              <th>状態</th>
              <th>メッセージ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d: any, i: number) => (
              <DonationRow
                key={d.id}
                index={from + i + 1}
                donation={{
                  id: d.id,
                  customer_id: d.customer_id,
                  customer_name: d.customer?.full_name ?? "",
                  customer_email: d.customer?.email ?? "",
                  donor_name: d.donor_name ?? "",
                  donor_email: d.donor_email ?? "",
                  amount: Number(d.amount ?? 0),
                  amount_label: formatYen(d.amount),
                  status: d.status,
                  status_label: statusLabel(d.status),
                  message: d.message ?? "",
                  donated_at: formatDate(d.donated_at, true),
                }}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-6 text-ink-mute">
                  該当する寄付がありません。
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
            if (q) qs.set("q", q);
            qs.set("page", String(n));
            return (
              <Link
                key={n}
                href={`/admin/donations?${qs.toString()}`}
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
