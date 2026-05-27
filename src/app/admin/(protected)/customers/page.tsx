import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatYen, statusLabel } from "@/lib/format";

export default async function CustomersListPage({
  searchParams,
}: {
  searchParams: { q?: string; plan?: string; status?: string; pay?: string };
}) {
  const q = (searchParams.q ?? "").trim();
  const plan = searchParams.plan ?? "";
  const status = searchParams.status ?? "";
  const pay = searchParams.pay ?? "";

  const supabase = createSupabaseServerClient();
  // Base: view for aggregated info.
  let query = supabase.from("v_customer_summary").select("*").order("full_name");

  if (q) {
    const like = `%${q}%`;
    query = query.or(`full_name.ilike.${like},email.ilike.${like}`);
  }
  if (status) query = query.eq("status", status);
  if (plan) query = query.eq("primary_plan_code", plan);
  if (pay) query = query.eq("contract_status", pay);

  const { data, error } = await query.limit(200);
  const rows = (data as any[]) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">顧客一覧</h1>
        <div className="flex gap-2">
          <Link href="/admin/customers/new" className="btn-primary !py-2 !px-4">新規登録</Link>
          <Link href="/admin/csv" className="btn-secondary !py-2 !px-4">CSV入出力</Link>
        </div>
      </div>

      <form method="get" className="card grid md:grid-cols-5 gap-2">
        <input name="q" defaultValue={q} placeholder="氏名 / メールで検索" className="input md:col-span-2" />
        <select name="plan" defaultValue={plan} className="input">
          <option value="">会員種別：すべて</option>
          <option value="A">A会員</option>
          <option value="B">B会員</option>
          <option value="C">C会員</option>
          <option value="SUPPORT">支援会員</option>
          <option value="SPECIAL_TEAM">特別チーム会員</option>
        </select>
        <select name="pay" defaultValue={pay} className="input">
          <option value="">決済：すべて</option>
          <option value="active">正常</option>
          <option value="past_due">失敗</option>
          <option value="canceled">停止</option>
        </select>
        <select name="status" defaultValue={status} className="input">
          <option value="">会員状態：すべて</option>
          <option value="active">有効</option>
          <option value="suspended">停止中</option>
          <option value="withdrawn">退会</option>
        </select>
        <div className="md:col-span-5 flex gap-2">
          <button className="btn-primary !py-2 !px-4">絞り込む</button>
          <Link href="/admin/customers" className="btn-ghost !py-2 !px-4">リセット</Link>
          <span className="ml-auto text-sm text-ink-soft self-center">{rows.length}件</span>
        </div>
      </form>

      {error && <div className="card text-danger">{error.message}</div>}

      <div className="card p-0 overflow-auto">
        <table className="table">
          <thead>
            <tr>
              <th className="w-12 text-right">No.</th>
              <th>氏名</th>
              <th>メール</th>
              <th>会員種別</th>
              <th>支援数</th>
              <th>月額</th>
              <th>決済状態</th>
              <th>状態</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.customer_id} className="hover:bg-surface-soft">
                <td className="text-right text-ink-mute tabular-nums">{i + 1}</td>
                <td className="font-semibold">{r.full_name}</td>
                <td>{r.email ?? "—"}</td>
                <td>{r.primary_plan_name ?? "—"}</td>
                <td>{r.total_support_horses ?? 0} 件</td>
                <td>{formatYen(r.monthly_total ?? 0)}</td>
                <td>
                  <span className={
                    r.contract_status === "past_due" ? "chip-error" :
                    r.contract_status === "active" ? "chip-ok" :
                    r.contract_status ? "chip-mute" : "chip-mute"
                  }>
                    {statusLabel(r.contract_status ?? "—")}
                  </span>
                </td>
                <td>{statusLabel(r.status ?? "active")}</td>
                <td className="text-right">
                  <Link href={`/admin/customers/${r.customer_id}`} className="text-brand underline">詳細</Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="text-center text-ink-mute py-6">該当する顧客がいません。</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
