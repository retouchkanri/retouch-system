import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import horseImage from "@/assets/images/horse.png";
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
        <div className="flex items-center gap-3 mt-1">
          {support.horse?.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={support.horse.image_url} alt={support.horse?.name ?? ""} className="w-12 h-12 rounded-xl object-cover shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-brand-50 overflow-hidden shrink-0">
              <Image src={horseImage} alt="horse" className="w-full h-full object-cover" />
            </div>
          )}
          <div>
            <p className="text-lg font-bold">{support.horse?.name}</p>
            <p className="text-sm text-ink-soft">{support.units} 口 / 月額 {support.monthly_amount.toLocaleString()} 円</p>
          </div>
        </div>
      </div>
      <ChangeSupportForm support={support} plans={plans} />
      <Link href={`/mypage/supports/${support.id}/stop`} className="btn-ghost w-full text-danger border-2 border-danger">
        この支援を停止する
      </Link>
    </div>
  );
}
