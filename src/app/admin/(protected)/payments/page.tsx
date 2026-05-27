import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, formatYen, statusLabel } from "@/lib/format";
import PaymentRow from "./PaymentRow";

const PAGE_SIZE = 50;

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams?: { status?: string; kind?: string; q?: string; page?: string };
}) {
  const supabase = createSupabaseServerClient();
  const status = searchParams?.status ?? "";
  const kind = searchParams?.kind ?? "";
  const q = (searchParams?.q ?? "").trim();
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("payments")
    .select("*, customer:customers(full_name, email)", { count: "exact" })
    .order("occurred_at", { ascending: false });
  if (status) query = query.eq("status", status);
  if (kind) query = query.eq("kind", kind);

  const { data, count } = await query.range(from, from + PAGE_SIZE - 1);

  const filtered = q
    ? (data ?? []).filter((p: any) => {
        const hay = `${p.customer?.full_name ?? ""} ${p.customer?.email ?? ""} ${p.stripe_invoice_id ?? ""} ${p.stripe_payment_intent_id ?? ""}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      })
    : data ?? [];

  const totalAmount = filtered.reduce((acc: number, p: any) => (p.status === "succeeded" ? acc + Number(p.amount ?? 0) : acc), 0);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">決済履歴</h1>
        <div className="text-sm text-ink-soft">
          全 {count ?? 0} 件 / 成功合計（表示範囲） {formatYen(totalAmount)}
        </div>
      </div>

      <form className="card flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="label">顧客／Stripe ID</label>
          <input name="q" className="input" defaultValue={q} placeholder="検索..." />
        </div>
        <div>
          <label className="label">状態</label>
          <select name="status" className="input" defaultValue={status}>
            <option value="">すべて</option>
            <option value="succeeded">成功</option>
            <option value="failed">失敗</option>
            <option value="pending">保留</option>
            <option value="refunded">返金済</option>
            <option value="canceled">取消</option>
          </select>
        </div>
        <div>
          <label className="label">種別</label>
          <select name="kind" className="input" defaultValue={kind}>
            <option value="">すべて</option>
            <option value="subscription">継続</option>
            <option value="donation">寄付</option>
            <option value="one_time">単発</option>
          </select>
        </div>
        <button className="btn-primary">絞り込む</button>
        {(q || status || kind) && (
          <Link className="btn-ghost" href="/admin/payments">
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
              <th>顧客</th>
              <th>種別</th>
              <th>金額</th>
              <th>状態</th>
              <th>失敗理由</th>
              <th>Stripe</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p: any, i: number) => (
              <PaymentRow
                key={p.id}
                index={from + i + 1}
                payment={{
                  id: p.id,
                  customer_id: p.customer_id,
                  customer_name: p.customer?.full_name ?? "—",
                  customer_email: p.customer?.email ?? "",
                  kind: p.kind,
                  amount: Number(p.amount ?? 0),
                  amount_label: formatYen(p.amount),
                  status: p.status,
                  status_label: statusLabel(p.status),
                  failure_reason: p.failure_reason ?? "",
                  occurred_at: formatDate(p.occurred_at, true),
                  stripe_invoice_id: p.stripe_invoice_id ?? "",
                  stripe_payment_intent_id: p.stripe_payment_intent_id ?? "",
                }}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-6 text-ink-mute">
                  該当する決済がありません。
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
            if (kind) qs.set("kind", kind);
            if (q) qs.set("q", q);
            qs.set("page", String(n));
            return (
              <Link
                key={n}
                href={`/admin/payments?${qs.toString()}`}
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
