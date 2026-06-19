"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type Capability, type Role, can } from "@/lib/roles";

type NavItem = { href: string; label: string; cap?: Capability; external?: boolean };

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "全体",
    items: [
      { href: "/admin", label: "ダッシュボード" },
      { href: "/admin/search", label: "横断検索" },
      { href: "/admin/audit-logs", label: "監査ログ", cap: "audit.view" },
    ],
  },
  {
    label: "会員・支援",
    items: [
      { href: "/admin/customers", label: "顧客一覧" },
      { href: "/admin/contracts", label: "契約一覧", cap: "contracts.manage" },
      { href: "/admin/supports", label: "支援管理" },
      { href: "/admin/donations", label: "寄付一覧" },
      { href: "/admin/payments", label: "決済履歴", cap: "payments.manage" },
    ],
  },
  {
    label: "マスタ",
    items: [
      { href: "/admin/plans", label: "会員プラン", cap: "plans.manage" },
      { href: "/guide", label: "入会案内（公開）", external: true },
      { href: "/support-guide", label: "1口支援案内（公開）", external: true },
      { href: "/admin/horses", label: "馬マスタ" },
      { href: "/admin/events", label: "イベントマスタ" },
      { href: "/admin/bookings", label: "予約管理" },
      { href: "/admin/horse-meetings", label: "馬の面会" },
      { href: "/admin/news", label: "ニュース" },
      { href: "/admin/member-messages", label: "メッセージ配信", cap: "messages.manage" },
      { href: "/admin/chatbot", label: "AIチャットボット", cap: "chatbot.manage" },
    ],
  },
  {
    label: "運用",
    items: [
      { href: "/admin/users", label: "ユーザー管理", cap: "users.manage" },
      { href: "/admin/csv", label: "CSV 入出力", cap: "csv" },
      { href: "/admin/profile", label: "マイプロフィール" },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function AdminNav({ role }: { role: Role }) {
  const pathname = usePathname();

  const groups = navGroups
    .map((g) => ({ ...g, items: g.items.filter((n) => !n.cap || can(role, n.cap)) }))
    .filter((g) => g.items.length > 0);

  return (
    <nav className="p-2 pt-4 flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible">
      {groups.map((g) => (
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
                target={n.external ? "_blank" : undefined}
                rel={n.external ? "noopener noreferrer" : undefined}
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
