"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navGroups: { label: string; items: { href: string; label: string }[] }[] = [
  {
    label: "全体",
    items: [
      { href: "/admin", label: "ダッシュボード" },
      { href: "/admin/search", label: "横断検索" },
      { href: "/admin/audit-logs", label: "監査ログ" },
    ],
  },
  {
    label: "会員・支援",
    items: [
      { href: "/admin/customers", label: "顧客一覧" },
      { href: "/admin/contracts", label: "契約一覧" },
      { href: "/admin/supports", label: "支援管理" },
      { href: "/admin/donations", label: "寄付一覧" },
      { href: "/admin/payments", label: "決済履歴" },
    ],
  },
  {
    label: "マスタ",
    items: [
      { href: "/admin/plans", label: "会員プラン" },
      { href: "/admin/horses", label: "馬マスタ" },
      { href: "/admin/events", label: "イベントマスタ" },
      { href: "/admin/bookings", label: "予約管理" },
      { href: "/admin/news", label: "ニュース" },
    ],
  },
  {
    label: "運用",
    items: [
      { href: "/admin/users", label: "ユーザー管理" },
      { href: "/admin/csv", label: "CSV 入出力" },
      { href: "/admin/profile", label: "マイプロフィール" },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="p-2 pt-4 flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible">
      {navGroups.map((g) => (
        <div key={g.label} className="md:mb-2 md:block flex gap-1">
          <p className="hidden md:block text-[10px] uppercase tracking-wider text-white/50 px-3 pt-2 pb-1">
            {g.label}
          </p>
          {g.items.map((n) => {
            const active = isActive(pathname, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`relative px-3 py-2 rounded-lg whitespace-nowrap text-sm block transition-colors ${
                  active
                    ? "bg-white text-brand-dark font-bold shadow-sm md:before:absolute md:before:left-0 md:before:top-1.5 md:before:bottom-1.5 md:before:w-1 md:before:rounded-full md:before:bg-brand-light"
                    : "text-white hover:bg-white/10"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
