import Link from "next/link";
import { requireMember } from "@/lib/auth";
import DonationForm from "./DonationForm";

export default async function DonatePage() {
  await requireMember();
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
