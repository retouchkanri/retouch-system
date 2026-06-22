import type { Metadata } from "next";
import AuthPageLayout from "@/components/AuthPageLayout";
import AuthModalHeader from "@/components/AuthModalHeader";
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
    <AuthPageLayout>
      <div className="card">
        <AuthModalHeader />

        {searchParams.error === "invalid" && (
          <p className="mb-4 text-danger text-sm">
            メールアドレスかパスワードが違います。もう一度ご確認ください。
          </p>
        )}

        <LoginForm next={searchParams.next ?? "/mypage"} />
      </div>
    </AuthPageLayout>
  );
}
