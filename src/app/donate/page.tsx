import Link from "next/link";
import PublicDonationForm from "./PublicDonationForm";

export default function PublicDonatePage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Back button */}
      <div className="w-full flex justify-end px-4 pt-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-brand transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          戻る
        </Link>
      </div>
      <main className="flex-1 w-full max-w-xl mx-auto p-4 space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-brand">単発寄付</h1>
          <p className="text-sm text-ink-soft mt-1">
            一回限りのご支援を承ります。ログインは不要です。
          </p>
        </div>
        <div className="card border-2 border-brand-light bg-brand-50">
          <p className="text-sm leading-relaxed">
            いただいたご寄付は、引退競走馬のケア・見学会運営に活用させていただきます。<br />
            会員登録後のマイページから、継続支援もご検討いただけます。
          </p>
        </div>
        <PublicDonationForm />
        <div className="text-center text-xs text-ink-mute">
          会員の方は{" "}
          <Link href="/mypage/donate" className="text-brand underline">
            マイページから寄付
          </Link>
          することで履歴に自動登録されます。
        </div>
      </main>
    </div>
  );
}
