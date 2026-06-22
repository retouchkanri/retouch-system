import type { Metadata } from "next";
import AuthPageLayout from "@/components/AuthPageLayout";
import SignupForm from "./SignupForm";

export const metadata: Metadata = {
  title: "新規会員登録",
  description: "Retouchメンバーズサイトの新規会員登録ページです。",
  robots: { index: false, follow: false },
};

export default function SignupPage() {
  return (
    <AuthPageLayout>
      <div className="card">
        <SignupForm />
      </div>
    </AuthPageLayout>
  );
}
