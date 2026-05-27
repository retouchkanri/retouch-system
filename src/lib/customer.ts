import { createSupabaseServerClient } from "./supabase/server";
import type {
  Booking,
  Contract,
  Customer,
  CustomerSummary,
  Donation,
  EventRow,
  Horse,
  MembershipPlan,
  Payment,
  SupportSubscription,
} from "@/types/db";

export async function loadCustomer(customerId: string): Promise<Customer | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("customers").select("*").eq("id", customerId).maybeSingle();
  return (data as Customer | null) ?? null;
}

export async function loadCustomerSummary(customerId: string): Promise<CustomerSummary | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("v_customer_summary")
    .select("*")
    .eq("customer_id", customerId)
    .maybeSingle();
  return (data as CustomerSummary | null) ?? null;
}

export async function loadActiveSupports(customerId: string): Promise<SupportSubscription[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("support_subscriptions")
    .select("*, horse:horses(*)")
    .eq("customer_id", customerId)
    .in("status", ["active", "past_due"])
    .order("started_at", { ascending: false });
  return (data as SupportSubscription[] | null) ?? [];
}

export async function loadActiveContract(customerId: string): Promise<Contract | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("contracts")
    .select("*, plan:membership_plans(*)")
    .eq("customer_id", customerId)
    .in("status", ["active", "past_due"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Contract | null) ?? null;
}

export async function loadDonations(customerId: string, limit = 20): Promise<Donation[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("donations")
    .select("*")
    .eq("customer_id", customerId)
    .order("donated_at", { ascending: false })
    .limit(limit);
  return (data as Donation[] | null) ?? [];
}

export async function loadBookings(customerId: string, limit = 20): Promise<Booking[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("bookings")
    .select("*, event:events(*)")
    .eq("customer_id", customerId)
    .order("booked_at", { ascending: false })
    .limit(limit);
  return (data as Booking[] | null) ?? [];
}

export async function loadPayments(customerId: string, limit = 20): Promise<Payment[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("payments")
    .select("*")
    .eq("customer_id", customerId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  return (data as Payment[] | null) ?? [];
}

export async function loadHorses(onlySupportable = true): Promise<Horse[]> {
  const supabase = createSupabaseServerClient();
  const query = supabase.from("horses").select("*").order("sort_order", { ascending: true });
  if (onlySupportable) query.eq("is_supportable", true);
  const { data } = await query;
  return (data as Horse[] | null) ?? [];
}

export async function loadPlans(): Promise<MembershipPlan[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("membership_plans")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return (data as MembershipPlan[] | null) ?? [];
}

export async function loadEvents(onlyUpcoming = true): Promise<EventRow[]> {
  const supabase = createSupabaseServerClient();
  const q = supabase.from("events").select("*").eq("is_published", true).order("starts_at");
  if (onlyUpcoming) q.gte("starts_at", new Date().toISOString());
  const { data } = await q;
  return (data as EventRow[] | null) ?? [];
}
