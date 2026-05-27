import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatYen } from "@/lib/format";
import PlanForm from "./PlanForm";
import PlanRow from "./PlanRow";

export default async function AdminPlansPage() {
  const supabase = createSupabaseServerClient();
  const { data: plans } = await supabase
    .from("membership_plans")
    .select("*")
    .order("sort_order")
    .order("monthly_amount");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">会員プラン管理</h1>
      <p className="text-sm text-ink-soft">
        A/B/C・特別チーム・支援プランの料金・説明・Stripe価格IDなどを編集できます。
        契約中の顧客がいるプランは削除できません（無効化されます）。
      </p>

      <details className="card">
        <summary className="cursor-pointer font-semibold">＋ 新しいプランを追加</summary>
        <div className="mt-3">
          <PlanForm />
        </div>
      </details>

      <div className="card p-0 overflow-auto">
        <table className="table">
          <thead>
            <tr>
              <th className="w-12 text-right">No.</th>
              <th>コード</th>
              <th>名称</th>
              <th>月額</th>
              <th>単価</th>
              <th>併用</th>
              <th>Stripe</th>
              <th>有効</th>
              <th>順</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(plans ?? []).map((p: any, i: number) => (
              <PlanRow key={p.id} index={i + 1} plan={p} displayYen={formatYen(p.monthly_amount)} />
            ))}
            {(plans ?? []).length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-6 text-ink-mute">
                  登録されたプランがありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
