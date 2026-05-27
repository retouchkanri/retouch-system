import Link from "next/link";

export default function PublicDonateThanksPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center space-y-3">
          <p className="text-3xl">💚</p>
          <h1 className="text-xl font-bold">ご寄付をお預かりしました</h1>
          <p className="text-ink-soft">
            ご寄付ありがとうございました。受付が完了しました。<br />
            確認メールをお送りしておりますので、ご確認ください。
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Link href="/signup" className="btn-primary">
              会員登録して継続支援を検討する
            </Link>
            <Link href="/" className="btn-ghost">
              トップへ戻る
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
