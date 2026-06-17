import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { MEMBER_SELF_SERVICE_ENABLED } from "@/lib/featureFlags";
import SelfServiceClosedNotice from "@/components/SelfServiceClosedNotice";
import DonationForm from "./DonationForm";

export default async function DonatePage() {
  await requireMember();
  if (!MEMBER_SELF_SERVICE_ENABLED) {
    return (
      <SelfServiceClosedNotice
        title="単発寄付について"
        description="単発寄付のお手続きは、現在運営にて承っております。お手数ですが運営までお問い合わせください。"
      />
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">単発寄付</h1>
        <Link href="/mypage" className="text-brand underline">戻る</Link>
      </div>
      <div className="card border-2 border-brand-light bg-brand-50">
        <p className="text-sm leading-relaxed">
          単発寄付は、月々の支援とは別に、一回限りの応援として受け付けております。<br />
          いただいたご寄付は、引退競走馬のケア・見学会運営にありがたく活用させていただきます。
        </p>
      </div>
      <DonationForm />
    </div>
  );
}
