import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatYen, formatUnits, memberClassLabel, statusLabel } from "@/lib/format";
import { HIDDEN_ACCOUNT_EMAILS, isHiddenAccountEmail } from "@/lib/hiddenAccounts";
import CustomerDeleteButton from "./CustomerDeleteButton";

const PAGE_SIZE = 50;

export default async function CustomersListPage({
  searchParams,
}: {
  searchParams: { q?: string; cls?: string; special?: string; status?: string; pay?: string; page?: string };
}) {
  const q = (searchParams.q ?? "").trim();
  const cls = searchParams.cls ?? "";
  const special = searchParams.special ?? "";
  const status = searchParams.status ?? "";
  const pay = searchParams.pay ?? "";
  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = createSupabaseServerClient();
  // Base: view for aggregated info.
  // 件数は count:"exact"（サーバ側の実数）を使う。取得ページの配列長を件数として
  // 表示すると、該当者が 1 ページ分を超えた時点で表示が頭打ちになるため。
  let query = supabase.from("v_customer_summary").select("*", { count: "exact" }).order("full_name");

  if (q) {
    const like = `%${q}%`;
    query = query.or(`full_name.ilike.${like},email.ilike.${like}`);
  }
  if (status) query = query.eq("status", status);
  // 会員種別（基本区分）: A/B/C/SUPPORT を member_class_code で絞り込み
  // "NONE" は会員種別が未設定（NULL）かつ リタポ・特別チーム（ガンガン等）にも
  // 加入していない、契約が一切ない顧客のみを抽出する（メッセージ配信の no_class と同一条件）。
  // アテンダー会員はコード A を流用しているため、plan_name で メンバーズ会員 と区別する。
  if (cls === "NONE") query = query.is("member_class_code", null).eq("rpt_active", false).eq("special_team_count", 0);
  else if (cls === "ATTENDER") query = query.eq("primary_plan_name", "アテンダー会員");
  else if (cls === "A") query = query.eq("member_class_code", "A").neq("primary_plan_name", "アテンダー会員");
  else if (cls) query = query.eq("member_class_code", cls);
  // 特別参加: 特別チーム / リタポ
  if (special === "TEAM") query = query.gt("special_team_count", 0);
  if (special === "RPT") query = query.eq("rpt_active", true);
  if (pay) query = query.eq("contract_status", pay);

  // 内部テスト用アカウントは一覧・件数から除外（Supabase 上には存在する）。
  // count と一覧を一致させるため、取得後ではなくクエリ段階で除外する。
  // NOT IN は email が NULL の行も落としてしまうので、NULL は明示的に残す。
  if (HIDDEN_ACCOUNT_EMAILS.length > 0) {
    const hidden = HIDDEN_ACCOUNT_EMAILS.map((e) => `"${e}"`).join(",");
    query = query.or(`email.is.null,email.not.in.(${hidden})`);
  }

  const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1);
  // 大文字小文字の違いで DB 側の除外をすり抜けた場合の保険（表示のみ）。
  const rows = ((data as any[]) ?? []).filter((r) => !isHiddenAccountEmail(r.email));
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
          <option value="A">メンバーズ会員</option>
          <option value="ATTENDER">アテンダー会員</option>
          <option value="B">サポーター会員</option>
          <option value="C">リェリーフ会員</option>
          <option value="OWNER">オーナーズ会員</option>
          <option value="SUPPORT">ヘルパーズ会員</option>
          <option value="NONE">（空白・未設定）</option>
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
          <span className="ml-auto text-sm text-ink-soft self-center">全 {total} 件</span>
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
                  <td className="text-right text-ink-mute tabular-nums">{from + i + 1}</td>
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
                  <td className="text-right whitespace-nowrap">
                    <Link href={`/admin/customers/${r.customer_id}`} className="text-brand underline">詳細</Link>
                    <span className="mx-1 text-ink-mute">|</span>
                    <CustomerDeleteButton id={r.customer_id} name={r.full_name ?? "この顧客"} />
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

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => {
            const qs = new URLSearchParams();
            if (q) qs.set("q", q);
            if (cls) qs.set("cls", cls);
            if (special) qs.set("special", special);
            if (status) qs.set("status", status);
            if (pay) qs.set("pay", pay);
            qs.set("page", String(n));
            return (
              <Link
                key={n}
                href={`/admin/customers?${qs.toString()}`}
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
