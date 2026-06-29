import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthPageLayout from "@/components/AuthPageLayout";
import AuthModalHeader from "@/components/AuthModalHeader";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "会員ログイン",
  description: "Retouchメンバーズサイトへログインします。引退競走馬の支援状況・寄付履歴をご確認いただけます。",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  const supabase = createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (session) redirect(searchParams.next ?? "/mypage");

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
