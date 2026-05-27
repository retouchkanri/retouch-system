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
      // Supabase unreachable
    }
  }

  return (
    <>
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

          {/* Desktop: phone + nav */}
          <div className="hidden md:flex items-center gap-4">
            <a href="tel:050-6875-3336" className="flex items-center gap-1.5 text-sm text-ink-soft hover:text-brand transition">
              <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17.5 14.1v2.4a1.6 1.6 0 01-1.7 1.6A15.8 15.8 0 012 4.2 1.6 1.6 0 013.6 2.5H6a1.6 1.6 0 011.6 1.4c.1.8.3 1.5.6 2.2a1.6 1.6 0 01-.4 1.7l-1 1a12.8 12.8 0 004.8 4.8l1-1a1.6 1.6 0 011.7-.4c.7.3 1.4.5 2.2.6a1.6 1.6 0 011.4 1.6z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="font-semibold">050-6875-3336</span>
            </a>
            {session ? (
              <HeaderUserMenu
                name={name}
                email={session.email ?? ""}
                role={session.role}
                avatarUrl={avatarUrl}
              />
            ) : (
              <nav className="flex items-center gap-2">
                <Link href="/signup" className="btn-primary !px-4 !py-2 text-sm btn-pulse">
                  新規会員登録
                </Link>
                <Link href="/login" className="btn-secondary !px-4 !py-2 text-sm">
                  ログイン
                </Link>
              </nav>
            )}
          </div>

          {/* Mobile: only user menu if logged in */}
          <div className="md:hidden">
            {session && (
              <HeaderUserMenu
                name={name}
                email={session.email ?? ""}
                role={session.role}
                avatarUrl={avatarUrl}
              />
            )}
          </div>
        </div>
      </header>

      {/* Mobile sticky bottom CTA bar */}
      {!session && (
        <div className="mobile-cta-bar">
          <a href="tel:050-6875-3336" className="flex items-center gap-1.5 text-sm font-semibold text-ink shrink-0">
            <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none" stroke="#2d6a4f" strokeWidth="1.5">
              <path d="M17.5 14.1v2.4a1.6 1.6 0 01-1.7 1.6A15.8 15.8 0 012 4.2 1.6 1.6 0 013.6 2.5H6a1.6 1.6 0 011.6 1.4c.1.8.3 1.5.6 2.2a1.6 1.6 0 01-.4 1.7l-1 1a12.8 12.8 0 004.8 4.8l1-1a1.6 1.6 0 011.7-.4c.7.3 1.4.5 2.2.6a1.6 1.6 0 011.4 1.6z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            電話
          </a>
          <div className="flex gap-2 flex-1 justify-end">
            <Link href="/login" className="bg-white text-brand border-2 border-brand px-4 py-2.5 text-sm font-bold text-center flex-1 max-w-[120px]">
              ログイン
            </Link>
            <Link href="/signup" className="bg-brand text-white px-4 py-2.5 text-sm font-bold text-center flex-1 max-w-[140px] btn-pulse">
              無料会員登録
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
