import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatYen, formatUnits, memberClassLabel, statusLabel } from "@/lib/format";
import { isHiddenAccountEmail } from "@/lib/hiddenAccounts";

export default async function CustomersListPage({
  searchParams,
}: {
  searchParams: { q?: string; cls?: string; special?: string; status?: string; pay?: string };
}) {
  const q = (searchParams.q ?? "").trim();
  const cls = searchParams.cls ?? "";
  const special = searchParams.special ?? "";
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
  // 会員種別（基本区分）: A/B/C/SUPPORT を member_class_code で絞り込み
  if (cls) query = query.eq("member_class_code", cls);
  // 特別参加: 特別チーム / リタポ
  if (special === "TEAM") query = query.gt("special_team_count", 0);
  if (special === "RPT") query = query.eq("rpt_active", true);
  if (pay) query = query.eq("contract_status", pay);

  const { data, error } = await query.limit(200);
  // 内部テスト用アカウントは一覧・件数から除外（Supabase 上には存在する）。
  const rows = ((data as any[]) ?? []).filter((r) => !isHiddenAccountEmail(r.email));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">顧客一覧</h1>
        <div className="flex gap-2">
          <Link href="/admin/customers/new" className="btn-primary !py-2 !px-4">新規登録</Link>
          <Link href="/admin/csv" className="btn-secondary !py-2 !px-4">CSV入出力</Link>
        </div>
      </div>

      <form method="get" className="card grid md:grid-cols-6 gap-2">
        <input name="q" defaultValue={q} placeholder="氏名 / メールで検索" className="input md:col-span-2" />
        <select name="cls" defaultValue={cls} className="input">
          <option value="">会員種別：すべて</option>
          <option value="A">アテンダー会員</option>
          <option value="B">メンバーズ／サポーター会員</option>
          <option value="C">リェリーフ会員</option>
          <option value="OWNER">オーナーズ会員</option>
          <option value="SUPPORT">ヘルパーズ会員</option>
        </select>
        <select name="special" defaultValue={special} className="input">
          <option value="">特別参加：すべて</option>
          <option value="TEAM">特別チーム会員</option>
          <option value="RPT">リタポメンバー</option>
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
        <div className="md:col-span-6 flex gap-2">
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
              <th>特別参加</th>
              <th>月額</th>
              <th>決済状態</th>
              <th>状態</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const teamNames: string[] = Array.isArray(r.special_team_names) ? r.special_team_names : [];
              const hasSpecial = (r.special_team_count ?? 0) > 0 || r.rpt_active;
              return (
                <tr key={r.customer_id} className="hover:bg-surface-soft">
                  <td className="text-right text-ink-mute tabular-nums">{i + 1}</td>
                  <td className="font-semibold">{r.full_name}</td>
                  <td>{r.email ?? "—"}</td>
                  <td>{r.primary_plan_name ?? memberClassLabel(r.member_class_code)}</td>
                  <td className="whitespace-nowrap">
                    {(r.total_support_horses ?? 0) > 0
                      ? `${r.total_support_horses}頭 / ${formatUnits(r.total_support_units ?? 0)}`
                      : "—"}
                  </td>
                  <td>
                    {hasSpecial ? (
                      <span className="flex flex-wrap gap-1">
                        {r.rpt_active && <span className="chip-mute">リタポ</span>}
                        {teamNames.map((name) => (
                          <span key={name} className="chip-mute">{name}</span>
                        ))}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
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
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="text-center text-ink-mute py-6">該当する顧客がいません。</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
