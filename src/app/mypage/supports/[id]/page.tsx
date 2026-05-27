import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadPlans } from "@/lib/customer";
import type { SupportSubscription } from "@/types/db";
import ChangeSupportForm from "./ChangeSupportForm";

export default async function ChangeSupportPage({ params }: { params: { id: string } }) {
  const session = await requireMember();
  if (!session.customerId) return notFound();

  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("support_subscriptions")
    .select("*, horse:horses(*)")
    .eq("id", params.id)
    .eq("customer_id", session.customerId)
    .maybeSingle();

  const support = data as SupportSubscription | null;
  if (!support) return notFound();

  const plans = (await loadPlans()).filter((p) => p.code === "SUPPORT");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">支援内容の変更</h1>
        <Link href="/mypage" className="text-brand underline">マイページへ戻る</Link>
      </div>
      <div className="card">
        <p className="label">現在の支援内容</p>
        <p className="text-lg font-bold">{support.horse?.name}</p>
        <p className="text-sm text-ink-soft">{support.units} 口 / 月額 {support.monthly_amount.toLocaleString()} 円</p>
      </div>
      <ChangeSupportForm support={support} plans={plans} />
      <Link href={`/mypage/supports/${support.id}/stop`} className="btn-ghost w-full text-danger border-2 border-danger">
        この支援を停止する
      </Link>
    </div>
  );
}
