import { createSupabaseAdminClient } from "./supabase/admin";

export type AuditAction =
  | `event.${"create" | "update" | "delete" | "unpublish"}`
  | `booking.${"create" | "update" | "cancel" | "delete" | "self_create" | "self_update" | "self_cancel"}`
  | `support.${string}`
  | `contract.${string}`
  | `customer.${string}`
  | `donation.${string}`
  | `payment.${string}`
  | `plan.${string}`
  | `notify.${string}`;

export type AuditEntry = {
  actorId: string | null;
  action: AuditAction;
  targetTable?: string | null;
  targetId?: string | null;
  meta?: Record<string, unknown> | null;
};

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("audit_logs").insert({
      actor_id: entry.actorId,
      action: entry.action,
      target_table: entry.targetTable ?? null,
      target_id: entry.targetId ?? null,
      meta: entry.meta ?? null,
    });
  } catch {
    // Audit logging must never break the caller.
  }
}
