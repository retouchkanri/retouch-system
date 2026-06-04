import { requireAdmin } from "@/lib/auth";
import AdminNav from "./AdminNav";
import BottomRightPanel from "@/components/BottomRightPanel";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  return (
    <div className="font-serif flex min-h-0 flex-1 flex-col md:block">
      {/* Sidebar: fixed below the (sticky) header on desktop so it stays put
          while the main content scrolls. Stacks normally on mobile. */}
      <aside className="bg-brand-dark text-white md:fixed md:top-[73px] md:bottom-0 md:left-0 md:z-40 md:w-[240px] md:overflow-y-auto">
        <AdminNav role={session.role} />
        <div className="p-3 mt-4 border-t border-white/10">
          <p className="text-xs text-white/70 mb-2">{session.email}</p>
          <form action="/api/auth/logout?next=/admin/login" method="post">
            <button className="text-xs text-white/70 underline" type="submit">
              ログアウト
            </button>
          </form>
        </div>
      </aside>
      <main className="p-4 md:p-6 md:ml-[240px] overflow-x-auto bg-surface-soft">{children}</main>
      {/* 管理画面はトップへ戻るボタンのみ（寄付・チャットは非表示）。 */}
      <BottomRightPanel showDonate={false} showChat={false} />
    </div>
  );
}
