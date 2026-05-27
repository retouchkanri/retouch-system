import Image from "next/image";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import HeaderUserMenu from "./HeaderUserMenu";

export default async function SiteHeader() {
  const session = await getSession();

  let name = "";
  let avatarUrl: string | null = null;
  if (session) {
    try {
      const admin = createSupabaseAdminClient();
      const { data } = await admin
        .from("customers")
        .select("full_name, avatar_url")
        .eq("auth_user_id", session.userId)
        .maybeSingle();
      name = (data?.full_name as string) ?? "";
      avatarUrl = (data?.avatar_url as string | null) ?? null;
    } catch {
      // Supabase unreachable — show header with session but without profile details.
    }
  }

  return (
    <header className="site-header sticky top-0 z-30 w-full shrink-0 bg-white/95 backdrop-blur border-b border-surface-line">
      <div className="w-full flex items-center justify-between gap-3 py-3 pr-[5vw]">
        <Link
          href="/"
          className="flex items-center min-w-0 gap-3"
          style={{ marginLeft: "5vw" }}
          aria-label="Retouchメンバーズサイト"
        >
          <Image
            src="/logo.png"
            alt="Retouch Members Site"
            width={220}
            height={64}
            priority
            className="h-12 w-auto"
          />
        </Link>

        {session ? (
          <HeaderUserMenu
            name={name}
            email={session.email ?? ""}
            role={session.role}
            avatarUrl={avatarUrl}
          />
        ) : (
          <nav className="flex items-center gap-2">
            <Link href="/signup" className="btn-primary !px-4 !py-2 text-sm">
              新規会員登録
            </Link>
            <Link href="/login" className="btn-secondary !px-4 !py-2 text-sm">
              ログイン
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
