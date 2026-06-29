import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthPageLayout from "@/components/AuthPageLayout";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import SignupForm from "./SignupForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "新規会員登録",
  description: "Retouchメンバーズサイトの新規会員登録ページです。",
  robots: { index: false, follow: false },
};

export default async function SignupPage() {
  const supabase = createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (session) redirect("/mypage");

  return (
    <AuthPageLayout>
      <div className="card">
        <SignupForm />
      </div>
    </AuthPageLayout>
  );
}
