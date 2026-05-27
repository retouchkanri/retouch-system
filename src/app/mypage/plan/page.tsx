import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { loadActiveContract, loadActiveSupports, loadPlans } from "@/lib/customer";
import { formatYen } from "@/lib/format";
import PlanSelector from "./PlanSelector";

export default async function PlanPage() {
  const session = await requireMember();
  if (!session.customerId) {
    return <div className="card">会員情報が見つかりません。</div>;
  }
  const [plans, contract, supports] = await Promise.all([
    loadPlans(),
    loadActiveContract(session.customerId),
    loadActiveSupports(session.customerId),
  ]);

  const basicPlans = plans.filter((p) => ["A", "B", "C"].includes(p.code));
  const hasSupport = supports.length > 0;
  const currentBasic = contract?.plan && ["A", "B", "C"].includes(contract.plan.code) ? contract.plan : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">会員種別の選択・変更</h1>
        <Link href="/mypage" className="text-brand underline">戻る</Link>
      </div>

      <section className="card">
        <p className="label">現在の会員種別</p>
        <p className="text-2xl font-bold">
          {currentBasic?.name ?? (hasSupport ? "支援会員" : "未加入")}
        </p>
        {currentBasic && (
          <p className="text-sm text-ink-soft mt-1">月額 {formatYen(currentBasic.monthly_amount)}</p>
        )}
      </section>

      {hasSupport && (
        <div className="card border-2 border-amber-400 bg-amber-50">
          <p className="font-bold text-warn">ご注意：支援会員と併用はできません</p>
          <p className="text-sm mt-1">
            現在、{supports.length}頭の馬をご支援中です。A/B/C会員へ切り替える場合は、先にすべての支援を停止してください。
          </p>
        </div>
      )}

      <section className="card space-y-3">
        <h2 className="section-title mb-0">プランを選ぶ</h2>
        <p className="text-sm text-ink-soft">
          A/B/C会員は1つだけお選びいただけます。いつでも変更・停止が可能です。
        </p>
        <PlanSelector
          plans={basicPlans.map((p) => ({
            id: p.id,
            code: p.code,
            name: p.name,
            monthly_amount: p.monthly_amount,
            description: p.description,
          }))}
          currentPlanId={currentBasic?.id ?? null}
          disabled={hasSupport}
        />
      </section>

      {currentBasic && !hasSupport && (
        <section className="card">
          <p className="font-bold">プランを停止する</p>
          <p className="text-sm text-ink-soft mb-2">
            現在のプランを停止すると、次回以降の決済が止まります。
          </p>
          <PlanSelector.Cancel />
        </section>
      )}
    </div>
  );
}
