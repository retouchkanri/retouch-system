import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase/server";
import { createSupabaseAdminClient } from "./supabase/admin";
import { safeGetUser } from "./supabase/safe-auth";

export type SessionInfo = {
  userId: string;
  email: string | null;
  role: "member" | "admin" | "staff";
  customerId: string | null;
};

export async function getSession(): Promise<SessionInfo | null> {
  try {
    const supabase = createSupabaseServerClient();
    const { user } = await safeGetUser(supabase);
    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, customer_id")
      .eq("id", user.id)
      .maybeSingle();

    let customerId = (profile?.customer_id as string | null) ?? null;
    const role = (profile?.role as SessionInfo["role"]) ?? "member";

    if (!customerId) {
      const admin = createSupabaseAdminClient();
      const { data: cust } = await admin
        .from("customers")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (cust?.id) {
        customerId = cust.id as string;
        await admin.from("profiles").upsert({
          id: user.id,
          role,
          customer_id: customerId,
        });
      }
    }

    return {
      userId: user.id,
      email: user.email ?? null,
      role,
      customerId,
    };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[auth] getSession failed — treating as logged out.",
        error instanceof Error ? error.message : error,
      );
    }
    return null;
  }
}

export async function requireMember(): Promise<SessionInfo> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireAdmin(): Promise<SessionInfo> {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (session.role !== "admin" && session.role !== "staff") {
    redirect("/admin/login?error=forbidden");
  }
  return session;
}
