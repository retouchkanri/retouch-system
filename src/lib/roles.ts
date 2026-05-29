/**
 * Six-level role & permission model.
 *
 * Hierarchy (highest → lowest authority):
 *   owner > admin > moderator > honorary_member > member > user
 *
 * - owner / admin / moderator have access to the admin area (with the
 *   capability matrix below deciding what each may actually do).
 * - honorary_member / member / user are customer-facing only.
 *
 * Badge tier (the "3 / 2 / 1" grouping):
 *   gold   = owner, admin, moderator
 *   silver = honorary_member, member
 *   bronze = user
 * Override: anyone holding an active RPT (RetouchPony【リタポ】) contract is
 * shown a GOLD badge regardless of role.
 */

export const ROLES = [
  "owner",
  "admin",
  "moderator",
  "honorary_member",
  "member",
  "user",
] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Normalise any stored/legacy value to a valid Role (defaults to "member"). */
export function toRole(value: unknown): Role {
  return isRole(value) ? value : "member";
}

export const ROLE_LABELS_JP: Record<Role, string> = {
  owner: "オーナー",
  admin: "管理者",
  moderator: "モデレーター",
  honorary_member: "名誉会員",
  member: "一般会員",
  user: "ユーザー",
};

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------
// Each capability is a discrete action gate. Routes/pages call can(role, cap)
// (server-side) to decide access. The admin area is reachable by any role with
// "admin.access"; everything else is checked per-action.

export type Capability =
  | "admin.access" // enter the /admin area at all
  | "settings.system" // system-wide configuration
  | "settings.payment" // Stripe / payment configuration
  | "roles.manage" // edit role definitions / promote to owner
  | "users.manageStaff" // create/edit owner & admin accounts (owner only)
  | "users.manage" // manage moderator / honorary / member / user accounts
  | "customers.manage" // create/edit/suspend/withdraw customers
  | "plans.manage" // membership plans & prices
  | "contracts.manage" // contracts / subscriptions
  | "horses.manage" // horses & support availability
  | "supports.manage" // support subscriptions
  | "donations.manage" // donations (write)
  | "payments.manage" // operational payment records
  | "csv" // CSV import / export
  | "audit.view" // view audit logs
  | "events.manage" // events
  | "bookings.manage" // event bookings
  | "news.manage" // news / posts
  | "inquiries.manage"; // inquiries

const ADMIN_CAPS: Capability[] = [
  "admin.access",
  "users.manage",
  "customers.manage",
  "plans.manage",
  "contracts.manage",
  "horses.manage",
  "supports.manage",
  "donations.manage",
  "payments.manage",
  "csv",
  "audit.view",
  "events.manage",
  "bookings.manage",
  "news.manage",
  "inquiries.manage",
];

const OWNER_CAPS: Capability[] = [
  ...ADMIN_CAPS,
  "settings.system",
  "settings.payment",
  "roles.manage",
  "users.manageStaff",
];

const MODERATOR_CAPS: Capability[] = [
  "admin.access",
  "events.manage",
  "bookings.manage",
  "news.manage",
  "inquiries.manage",
];

export const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  owner: OWNER_CAPS,
  admin: ADMIN_CAPS,
  moderator: MODERATOR_CAPS,
  honorary_member: [],
  member: [],
  user: [],
};

export function can(role: Role, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

/** Roles that can reach the admin dashboard. */
export function isStaffRole(role: Role): boolean {
  return can(role, "admin.access");
}

// ---------------------------------------------------------------------------
// Who may assign / edit whom (user-management page)
// ---------------------------------------------------------------------------
// - owner: may assign any role and edit any account.
// - admin: may manage moderator / honorary_member / member / user, but NOT
//   owner or admin accounts.

export function assignableRoles(actor: Role): Role[] {
  if (actor === "owner") return [...ROLES];
  if (actor === "admin") return ["moderator", "honorary_member", "member", "user"];
  return [];
}

/** Whether `actor` may create/edit/delete an account that currently has role `target`. */
export function canManageRole(actor: Role, target: Role): boolean {
  if (actor === "owner") return true;
  if (actor === "admin") return assignableRoles("admin").includes(target);
  return false;
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export type Medal = "gold" | "silver" | "bronze";

/**
 * Two-track badge:
 *  - Staff roles wear "Full" badges by rank — owner ×3, admin ×2, moderator ×1.
 *  - Member-level roles wear a medal by rank — honorary→gold, member→silver, user→bronze.
 */
export type Badge =
  | { kind: "full"; count: 1 | 2 | 3 }
  | { kind: "medal"; tier: Medal };

export const MEDAL_LABELS_JP: Record<Medal, string> = {
  gold: "ゴールド",
  silver: "シルバー",
  bronze: "ブロンズ",
};

/**
 * Effective badge for a role. An active RPT (RetouchPony【リタポ】) contract
 * upgrades a member-level badge to gold; it does not change staff "Full" badges.
 */
export function badgeFor(role: Role, hasActiveRpt = false): Badge {
  if (role === "owner") return { kind: "full", count: 3 };
  if (role === "admin") return { kind: "full", count: 2 };
  if (role === "moderator") return { kind: "full", count: 1 };
  if (hasActiveRpt || role === "honorary_member") return { kind: "medal", tier: "gold" };
  if (role === "member") return { kind: "medal", tier: "silver" };
  return { kind: "medal", tier: "bronze" };
}
