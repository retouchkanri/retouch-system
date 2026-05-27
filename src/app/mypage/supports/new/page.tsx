import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { loadHorses, loadPlans, loadActiveSupports, loadActiveContract } from "@/lib/customer";
import NewSupportWizard from "./NewSupportWizard";

export default async function NewSupportPage() {
  const session = await requireMember();
  if (!session.customerId) return <div className="card">会員情報が見つかりません。</div>;

  const [horses, plans, existingSupports, contract] = await Promise.all([
    loadHorses(true),
    loadPlans(),
    loadActiveSupports(session.customerId),
    loadActiveContract(session.customerId),
  ]);

  const supportPlans = plans.filter((p) => p.code === "SUPPORT");
  const basicPlan = contract?.plan;
  const blocksSupport = basicPlan && ["A", "B", "C"].includes(basicPlan.code);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">新しい支援を追加</h1>
        <Link href="/mypage" className="text-brand underline">戻る</Link>
      </div>

      {blocksSupport && (
        <div className="card border-2 border-warn">
          <p className="font-bold text-warn">ご注意</p>
          <p className="text-sm mt-1">
            現在{basicPlan?.name}にご加入中です。A/B/C会員と支援会員は併用できません。
            支援を追加するには、現在の会員種別の停止が必要です。運営までお問い合わせください。
          </p>
        </div>
      )}

      <NewSupportWizard
        horses={horses}
        plans={supportPlans}
        existingHorseIds={existingSupports.map((s) => s.horse_id)}
        disabled={!!blocksSupport}
      />
    </div>
  );
}
