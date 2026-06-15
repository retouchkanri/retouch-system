import Link from "next/link";
import SignupForm from "./SignupForm";

export default function SignupPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-brand">
              Retouchメンバーズサイト
            </h1>
            <p className="text-ink-soft mt-1">新規会員登録</p>
            <p className="text-xs text-ink-mute mt-2">
              ログイン不要で、どなたでも登録いただけます。
            </p>
            <p className="text-sm mt-3">
              <Link href="/guide" className="text-brand underline font-semibold">
                ご入会のご案内（会員制度・特典）を読む
              </Link>
            </p>
          </div>
          <div className="card">
            <SignupForm />
          </div>
          <div className="mt-4 text-center text-sm">
            すでにアカウントをお持ちの方は
            <Link href="/login" className="text-brand underline mx-1">
              ログイン
            </Link>
            へ。
          </div>
        </div>
      </main>
    </div>
  );
}
