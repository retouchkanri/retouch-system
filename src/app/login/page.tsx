import type { Metadata } from "next";
import Link from "next/link";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "会員ログイン",
  description: "Retouchメンバーズサイトへログインします。引退競走馬の支援状況・寄付履歴をご確認いただけます。",
  robots: { index: false, follow: false },
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-brand">
              Retouchメンバーズサイト
            </h1>
            <p className="text-ink-soft mt-1">会員ログイン</p>
          </div>
          <div className="card">
            {searchParams.error === "invalid" && (
              <p className="mb-4 text-danger text-sm">
                メールアドレスかパスワードが違います。もう一度ご確認ください。
              </p>
            )}
            <LoginForm next={searchParams.next ?? "/mypage"} />
          </div>
          <div className="mt-4 flex justify-between text-sm">
            <Link href="/signup" className="text-brand underline">
              新規会員登録はこちら
            </Link>
            <Link href="/login/reset" className="text-brand underline">
              パスワードを忘れた方
            </Link>
          </div>
          <div className="mt-6 text-center text-xs text-ink-mute">
            まだアカウントをお持ちでない方も
            <Link href="/signup" className="text-brand underline mx-1">
              こちら
            </Link>
            からご登録いただけます。
          </div>
        </div>
      </main>
    </div>
  );
}
