export type ContractStatus =
  | "active"
  | "past_due"
  | "canceled"
  | "paused"
  | "incomplete";

export type PaymentStatus = "succeeded" | "failed" | "pending" | "refunded" | "canceled";
export type PaymentKind = "subscription" | "donation" | "one_time";
export type EventType = "visit" | "private_visit";
export type BookingStatus = "reserved" | "canceled" | "attended" | "no_show";
export type CustomerStatus = "active" | "suspended" | "withdrawn";
export type MemberPlanCode = "A" | "B" | "C" | "SPECIAL_TEAM" | "SUPPORT";

export type Customer = {
  id: string;
  auth_user_id: string | null;
  stripe_customer_id: string | null;
  full_name: string;
  full_name_kana: string | null;
  email: string | null;
  phone: string | null;
  birthday: string | null;
  gender: "male" | "female" | "other" | "unspecified" | null;
  postal_code: string | null;
  address1: string | null;
  address2: string | null;
  status: CustomerStatus;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MembershipPlan = {
  id: string;
  code: MemberPlanCode;
  name: string;
  monthly_amount: number;
  unit_amount: number | null;
  allow_with_support: boolean;
  allow_with_team: boolean;
  stripe_price_id: string | null;
  description: string | null;
  is_active: boolean;
  sort_order: number;
};

export type Horse = {
  id: string;
  name: string;
  name_kana: string | null;
  sex: string | null;
  birth_year: number | null;
  retired_at: string | null;
  profile: string | null;
  image_url: string | null;
  stripe_price_half_id: string | null;
  stripe_price_full_id: string | null;
  is_supportable: boolean;
  sort_order: number;
};

export type Contract = {
  id: string;
  customer_id: string;
  plan_id: string | null;
  stripe_subscription_id: string | null;
  status: ContractStatus;
  current_period_end: string | null;
  started_at: string;
  canceled_at: string | null;
  plan?: MembershipPlan | null;
};

export type SupportSubscription = {
  id: string;
  contract_id: string;
  customer_id: string;
  horse_id: string;
  units: number;
  monthly_amount: number;
  status: ContractStatus;
  started_at: string;
  canceled_at: string | null;
  horse?: Horse | null;
};

export type Donation = {
  id: string;
  customer_id: string | null;
  donor_name: string | null;
  donor_email: string | null;
  amount: number;
  message: string | null;
  status: PaymentStatus;
  donated_at: string;
};

export type EventRow = {
  id: string;
  type: EventType;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  capacity: number;
  location: string | null;
  supporters_only: boolean;
  is_published: boolean;
};

export type Booking = {
  id: string;
  customer_id: string;
  event_id: string;
  party_size: number;
  note: string | null;
  status: BookingStatus;
  booked_at: string;
  canceled_at: string | null;
  event?: EventRow | null;
};

export type Payment = {
  id: string;
  customer_id: string | null;
  contract_id: string | null;
  donation_id: string | null;
  kind: PaymentKind;
  amount: number;
  status: PaymentStatus;
  stripe_invoice_id: string | null;
  stripe_payment_intent_id: string | null;
  failure_reason: string | null;
  occurred_at: string;
};

export type CustomerSummary = {
  customer_id: string;
  full_name: string;
  email: string | null;
  status: CustomerStatus;
  primary_plan_code: MemberPlanCode | null;
  primary_plan_name: string | null;
  total_support_units: number;
  total_support_horses: number;
  monthly_total: number;
  next_payment_at: string | null;
  contract_status: ContractStatus | null;
};
