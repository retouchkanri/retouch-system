import { requireAdmin } from "@/lib/auth";
import AdminNav from "./AdminNav";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  return (
    <div className="flex min-h-0 flex-1 grid grid-cols-1 md:grid-cols-[240px_1fr]">
      <aside className="bg-brand-dark text-white md:sticky md:top-[73px] md:h-[calc(100vh-73px)] md:overflow-y-auto">
        <AdminNav />
        <div className="p-3 mt-4 border-t border-white/10">
          <p className="text-xs text-white/70 mb-2">{session.email}</p>
          <form action="/api/auth/logout?next=/admin/login" method="post">
            <button className="text-xs text-white/70 underline" type="submit">
              ログアウト
            </button>
          </form>
        </div>
      </aside>
      <main className="p-4 md:p-6 overflow-x-auto bg-surface-soft">{children}</main>
    </div>
  );
}
