import Link from "next/link";

export default function SupportCompletedPage() {
  return (
    <div className="card text-center space-y-3">
      <p className="text-2xl">🐴</p>
      <h1 className="text-xl font-bold">申込を受け付けました</h1>
      <p className="text-ink-soft">
        決済完了後、マイページに反映されます。<br />
        処理が反映されるまで少しお時間をいただく場合があります。
      </p>
      <Link href="/mypage" className="btn-primary inline-block mt-3">マイページへ戻る</Link>
    </div>
  );
}
