-- =====================================================================
-- Retouch Members Supabase — Combined setup script.
-- Run this file in the Supabase SQL editor in one go.
-- It is idempotent: safe to re-run.
--
-- Contents:
--   1. Schema (tables, enums, indexes, triggers, RLS, view)
--   2. Seed data (membership plans, sample horses/events)
--   3. Storage bucket for avatars (public)
--   4. Admin seed account (admin@gmail.com / admin@gmail.com)
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";
create extension if not exists "citext";

-- ---------- enums ----------
do $$ begin
  create type member_plan_code as enum ('A','B','C','SPECIAL_TEAM','SUPPORT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type contract_status as enum ('active','past_due','canceled','paused','incomplete');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('succeeded','failed','pending','refunded','canceled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_kind as enum ('subscription','donation','one_time');
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_type as enum ('visit','private_visit');
exception when duplicate_object then null; end $$;

do $$ begin
  create type booking_status as enum ('reserved','canceled','attended','no_show');
exception when duplicate_object then null; end $$;

do $$ begin
  create type gender_type as enum ('male','female','other','unspecified');
exception when duplicate_object then null; end $$;

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member','admin','staff')),
  customer_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- customers ----------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  stripe_customer_id text unique,
  full_name text not null,
  full_name_kana text,
  email citext unique,
  phone text,
  birthday date,
  gender gender_type default 'unspecified',
  postal_code text,
  address1 text,
  address2 text,
  avatar_url text,
  status text not null default 'active' check (status in ('active','suspended','withdrawn')),
  joined_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.customers
  add column if not exists avatar_url text;
create index if not exists customers_email_idx on public.customers (lower(email));
create index if not exists customers_name_idx on public.customers (full_name);
create index if not exists customers_status_idx on public.customers (status);

alter table public.profiles
  drop constraint if exists profiles_customer_fkey;
alter table public.profiles
  add constraint profiles_customer_fkey
  foreign key (customer_id) references public.customers(id) on delete set null
  not valid;
alter table public.profiles validate constraint profiles_customer_fkey;

-- ---------- membership_plans ----------
create table if not exists public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  code member_plan_code not null,
  name text not null,
  monthly_amount integer not null,
  unit_amount integer,
  allow_with_support boolean not null default false,
  allow_with_team boolean not null default true,
  stripe_price_id text,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code, name)
);

-- ---------- horses ----------
create table if not exists public.horses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_kana text,
  sex text,
  birth_year integer,
  retired_at date,
  profile text,
  image_url text,
  stripe_price_half_id text,
  stripe_price_full_id text,
  is_supportable boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists horses_supportable_idx on public.horses (is_supportable);

-- ---------- contracts ----------
create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  plan_id uuid references public.membership_plans(id) on delete set null,
  stripe_subscription_id text unique,
  status contract_status not null default 'active',
  current_period_end timestamptz,
  started_at timestamptz not null default now(),
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contracts_customer_idx on public.contracts (customer_id);
create index if not exists contracts_status_idx on public.contracts (status);

-- ---------- support_subscriptions ----------
create table if not exists public.support_subscriptions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  horse_id uuid not null references public.horses(id) on delete restrict,
  units numeric(6,2) not null check (units > 0),
  monthly_amount integer not null,
  stripe_subscription_item_id text,
  status contract_status not null default 'active',
  started_at timestamptz not null default now(),
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists supports_customer_idx on public.support_subscriptions (customer_id);
create index if not exists supports_horse_idx on public.support_subscriptions (horse_id);
create index if not exists supports_status_idx on public.support_subscriptions (status);

-- ---------- donations ----------
create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  donor_name text,
  donor_email citext,
  amount integer not null check (amount > 0),
  message text,
  stripe_payment_intent_id text unique,
  stripe_checkout_session_id text,
  status payment_status not null default 'succeeded',
  donated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists donations_customer_idx on public.donations (customer_id);
create index if not exists donations_date_idx on public.donations (donated_at desc);

-- ---------- events ----------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  type event_type not null,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  capacity integer not null default 0,
  location text,
  supporters_only boolean not null default false,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists events_type_idx on public.events (type);
create index if not exists events_starts_idx on public.events (starts_at);

-- ---------- bookings ----------
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  party_size integer not null default 1 check (party_size > 0),
  note text,
  status booking_status not null default 'reserved',
  booked_at timestamptz not null default now(),
  canceled_at timestamptz,
  unique (customer_id, event_id)
);
create index if not exists bookings_event_idx on public.bookings (event_id);
create index if not exists bookings_customer_idx on public.bookings (customer_id);

-- ---------- payments ----------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  contract_id uuid references public.contracts(id) on delete set null,
  donation_id uuid references public.donations(id) on delete set null,
  kind payment_kind not null,
  amount integer not null,
  currency text not null default 'jpy',
  status payment_status not null default 'pending',
  stripe_event_id text,
  stripe_invoice_id text,
  stripe_payment_intent_id text,
  failure_reason text,
  occurred_at timestamptz not null default now(),
  raw jsonb,
  created_at timestamptz not null default now()
);
create index if not exists payments_customer_idx on public.payments (customer_id);
create index if not exists payments_status_idx on public.payments (status);
create index if not exists payments_occurred_idx on public.payments (occurred_at desc);

-- ---------- admin memos ----------
create table if not exists public.admin_memos (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  slot smallint not null check (slot between 1 and 3),
  body text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (customer_id, slot)
);

-- ---------- audit logs ----------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_table text,
  target_id uuid,
  meta jsonb,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- updated_at triggers
-- =====================================================================
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'customers','membership_plans','horses','contracts',
    'support_subscriptions','events','profiles'
  ] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', t, t);
    execute format('create trigger %I_set_updated_at before update on public.%I
                    for each row execute procedure public.tg_set_updated_at()', t, t);
  end loop;
end $$;

-- =====================================================================
-- Helpers
-- =====================================================================
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin','staff')
  );
$$;

create or replace function public.current_customer_id()
returns uuid language sql stable as $$
  select customer_id from public.profiles where id = auth.uid();
$$;

-- =====================================================================
-- Row level security
-- =====================================================================
alter table public.customers enable row level security;
alter table public.profiles enable row level security;
alter table public.membership_plans enable row level security;
alter table public.horses enable row level security;
alter table public.contracts enable row level security;
alter table public.support_subscriptions enable row level security;
alter table public.donations enable row level security;
alter table public.events enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.admin_memos enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles
  for update using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles admin write" on public.profiles;
create policy "profiles admin write" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "customers self select" on public.customers;
create policy "customers self select" on public.customers
  for select using (id = public.current_customer_id() or public.is_admin());
drop policy if exists "customers self update" on public.customers;
create policy "customers self update" on public.customers
  for update using (id = public.current_customer_id() or public.is_admin())
  with check (id = public.current_customer_id() or public.is_admin());
drop policy if exists "customers admin all" on public.customers;
create policy "customers admin all" on public.customers
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "plans public read" on public.membership_plans;
create policy "plans public read" on public.membership_plans for select using (true);
drop policy if exists "plans admin write" on public.membership_plans;
create policy "plans admin write" on public.membership_plans
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "horses public read" on public.horses;
create policy "horses public read" on public.horses for select using (true);
drop policy if exists "horses admin write" on public.horses;
create policy "horses admin write" on public.horses
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "contracts scope" on public.contracts;
create policy "contracts scope" on public.contracts
  for select using (customer_id = public.current_customer_id() or public.is_admin());
drop policy if exists "contracts admin all" on public.contracts;
create policy "contracts admin all" on public.contracts
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "supports scope" on public.support_subscriptions;
create policy "supports scope" on public.support_subscriptions
  for select using (customer_id = public.current_customer_id() or public.is_admin());
drop policy if exists "supports admin all" on public.support_subscriptions;
create policy "supports admin all" on public.support_subscriptions
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "donations scope" on public.donations;
create policy "donations scope" on public.donations
  for select using (customer_id = public.current_customer_id() or public.is_admin());
drop policy if exists "donations admin all" on public.donations;
create policy "donations admin all" on public.donations
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "events public read" on public.events;
create policy "events public read" on public.events
  for select using (is_published = true or public.is_admin());
drop policy if exists "events admin write" on public.events;
create policy "events admin write" on public.events
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "bookings self read" on public.bookings;
create policy "bookings self read" on public.bookings
  for select using (customer_id = public.current_customer_id() or public.is_admin());
drop policy if exists "bookings self insert" on public.bookings;
create policy "bookings self insert" on public.bookings
  for insert with check (customer_id = public.current_customer_id() or public.is_admin());
drop policy if exists "bookings self update" on public.bookings;
create policy "bookings self update" on public.bookings
  for update using (customer_id = public.current_customer_id() or public.is_admin())
  with check (customer_id = public.current_customer_id() or public.is_admin());
drop policy if exists "bookings admin all" on public.bookings;
create policy "bookings admin all" on public.bookings
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "payments scope" on public.payments;
create policy "payments scope" on public.payments
  for select using (customer_id = public.current_customer_id() or public.is_admin());
drop policy if exists "payments admin all" on public.payments;
create policy "payments admin all" on public.payments
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "memos admin only" on public.admin_memos;
create policy "memos admin only" on public.admin_memos
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "audit admin only" on public.audit_logs;
create policy "audit admin only" on public.audit_logs
  for select using (public.is_admin());

-- =====================================================================
-- Customer summary view
-- =====================================================================
create or replace view public.v_customer_summary as
select
  c.id as customer_id,
  c.full_name,
  c.email,
  c.status,
  c.avatar_url,
  coalesce(primary_plan.plan_code, null) as primary_plan_code,
  coalesce(primary_plan.plan_name, null) as primary_plan_name,
  coalesce(support_agg.total_units, 0)  as total_support_units,
  coalesce(support_agg.horse_count, 0)  as total_support_horses,
  coalesce(support_agg.monthly_total, 0) as monthly_total,
  contract_agg.current_period_end as next_payment_at,
  contract_agg.contract_status as contract_status
from public.customers c
left join lateral (
  select mp.code as plan_code, mp.name as plan_name
  from public.contracts ct
  join public.membership_plans mp on mp.id = ct.plan_id
  where ct.customer_id = c.id and ct.status = 'active'
  order by ct.started_at desc limit 1
) primary_plan on true
left join lateral (
  select
    sum(ss.units) as total_units,
    count(distinct ss.horse_id) as horse_count,
    sum(ss.monthly_amount) as monthly_total
  from public.support_subscriptions ss
  where ss.customer_id = c.id and ss.status = 'active'
) support_agg on true
left join lateral (
  select current_period_end, status::text as contract_status
  from public.contracts ct
  where ct.customer_id = c.id
  order by current_period_end desc nulls last limit 1
) contract_agg on true;

-- =====================================================================
-- Seed data
-- =====================================================================
insert into public.membership_plans (code, name, monthly_amount, unit_amount, allow_with_support, allow_with_team, sort_order, description)
values
  ('A', 'A会員', 1800, null, false, true, 10, '月額1,800円の基本会員プラン'),
  ('B', 'B会員', 3600, null, false, true, 20, '月額3,600円のスタンダード会員プラン'),
  ('C', 'C会員', 7200, null, false, true, 30, '月額7,200円のプレミアム会員プラン'),
  ('SPECIAL_TEAM', '特別チーム会員', 1000, null, true, true, 40, '月額1,000円の特別チーム会員（他会員と併用可能）')
on conflict (code, name) do update
  set monthly_amount = excluded.monthly_amount,
      allow_with_support = excluded.allow_with_support,
      allow_with_team = excluded.allow_with_team,
      description = excluded.description,
      updated_at = now();

insert into public.membership_plans (code, name, monthly_amount, unit_amount, allow_with_support, allow_with_team, sort_order, description)
values
  ('SUPPORT', '半口支援', 6000, 6000, true, true, 50, '馬ごとの半口支援（月額6,000円/口）'),
  ('SUPPORT', '1口支援', 12000, 12000, true, true, 60, '馬ごとの1口支援（月額12,000円/口）')
on conflict (code, name) do update
  set monthly_amount = excluded.monthly_amount,
      unit_amount = excluded.unit_amount,
      description = excluded.description,
      updated_at = now();

insert into public.horses (name, name_kana, sex, birth_year, profile, is_supportable, sort_order)
select v.name, v.kana, v.sex, v.y, v.bio, true, v.ord
from (values
  ('サクラエース','サクラエース','牡',2012,'2017年引退。やさしい性格で高齢者にも人気。',10),
  ('ミドリノカゼ','ミドリノカゼ','牝',2014,'穏やかで見学会の看板馬。',20),
  ('ハヤテボーイ','ハヤテボーイ','牡',2011,'元重賞勝ち馬。現役時の活躍を語り継ぐ。',30)
) as v(name, kana, sex, y, bio, ord)
where not exists (select 1 from public.horses h where h.name = v.name);

insert into public.events (type, title, description, starts_at, ends_at, capacity, location, supporters_only, is_published)
select 'visit','定期見学会 6月','牧場での引退馬見学会。',
       (now() + interval '30 days')::date + time '10:00',
       (now() + interval '30 days')::date + time '12:00',
       20, '牧場本場', false, true
where not exists (select 1 from public.events e where e.title = '定期見学会 6月');

insert into public.events (type, title, description, starts_at, ends_at, capacity, location, supporters_only, is_published)
select 'private_visit','個別見学（支援者限定）','支援者の方のみ申込可能。',
       (now() + interval '45 days')::date + time '13:00',
       (now() + interval '45 days')::date + time '15:00',
       6, '牧場本場', true, true
where not exists (select 1 from public.events e where e.title = '個別見学（支援者限定）');

-- =====================================================================
-- Storage bucket for avatars (public read, authenticated write)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars authenticated upload" on storage.objects;
create policy "avatars authenticated upload" on storage.objects
  for insert with check (bucket_id = 'avatars');

drop policy if exists "avatars authenticated update" on storage.objects;
create policy "avatars authenticated update" on storage.objects
  for update using (bucket_id = 'avatars') with check (bucket_id = 'avatars');

drop policy if exists "avatars authenticated delete" on storage.objects;
create policy "avatars authenticated delete" on storage.objects
  for delete using (bucket_id = 'avatars');

-- =====================================================================
-- Seed admin account: admin@gmail.com / admin@gmail.com
--   - inserts into auth.users with bcrypt password (password == email)
--   - inserts into auth.identities (email provider)
--   - inserts into public.customers + public.profiles with role='admin'
-- =====================================================================
do $$
declare
  admin_email text := 'admin@gmail.com';
  admin_password text := 'admin@gmail.com';
  admin_uid uuid;
  admin_customer_id uuid;
begin
  -- 1) auth.users
  select id into admin_uid from auth.users where email = admin_email;
  if admin_uid is null then
    admin_uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, recovery_sent_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      admin_uid,
      'authenticated',
      'authenticated',
      admin_email,
      crypt(admin_password, gen_salt('bf')),
      now(), null, null,
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name','管理者'),
      now(), now(),
      '', '', '', ''
    );
  else
    update auth.users
      set encrypted_password = crypt(admin_password, gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          updated_at = now()
      where id = admin_uid;
  end if;

  -- 2) auth.identities (email provider)
  if not exists (
    select 1 from auth.identities
    where user_id = admin_uid and provider = 'email'
  ) then
    insert into auth.identities (
      id, user_id, provider, provider_id, identity_data,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      admin_uid,
      'email',
      admin_uid::text,
      jsonb_build_object('sub', admin_uid::text, 'email', admin_email, 'email_verified', true),
      now(), now(), now()
    );
  end if;

  -- 3) customers row for the admin
  select id into admin_customer_id from public.customers where email = admin_email;
  if admin_customer_id is null then
    insert into public.customers (auth_user_id, full_name, email, status)
    values (admin_uid, '管理者', admin_email, 'active')
    returning id into admin_customer_id;
  else
    update public.customers
      set auth_user_id = admin_uid, full_name = '管理者', status = 'active'
      where id = admin_customer_id;
  end if;

  -- 4) profile with admin role
  insert into public.profiles (id, role, customer_id)
  values (admin_uid, 'admin', admin_customer_id)
  on conflict (id) do update
    set role = 'admin',
        customer_id = excluded.customer_id,
        updated_at = now();
end $$;
