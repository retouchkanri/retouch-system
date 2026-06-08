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
  create type member_plan_code as enum ('A','B','C','SPECIAL_TEAM','SUPPORT','RPT');
exception when duplicate_object then null; end $$;
-- Backfill the RPT value for installations created before it was added.
alter type member_plan_code add value if not exists 'RPT';

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
  role text not null default 'member' check (role in ('owner','admin','moderator','honorary_member','member','user')),
  customer_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reconcile the role check constraint on databases created before the
-- 6-role model existed. `create table if not exists` skips the inline
-- constraint above when the table already exists, so legacy databases keep
-- the old ('member','admin','staff') constraint and reject 'owner' etc.
-- Legacy 'staff' rows are migrated to 'admin' first so the new constraint
-- can be added without violating existing data.
update public.profiles set role = 'admin' where role = 'staff';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('owner','admin','moderator','honorary_member','member','user'));

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
  payment_method text not null default 'card' check (payment_method in ('card','bank_transfer')),
  confirmed_at timestamptz,
  note text,
  donated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
-- 既存DB向け（create table が既存テーブルをスキップした場合に備える）
alter table public.donations
  add column if not exists payment_method text not null default 'card';
alter table public.donations drop constraint if exists donations_payment_method_check;
alter table public.donations
  add constraint donations_payment_method_check check (payment_method in ('card','bank_transfer'));
alter table public.donations add column if not exists confirmed_at timestamptz;
alter table public.donations add column if not exists note text;
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
-- 見学会（千葉・大阪）申込フォームの追加項目（migrations/20260606_booking_visit_fields.sql）
alter table public.bookings add column if not exists pickup text;
alter table public.bookings add column if not exists riding boolean not null default false;
alter table public.bookings add column if not exists companions jsonb not null default '[]'::jsonb;

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
  stripe_charge_id text,
  failure_reason text,
  occurred_at timestamptz not null default now(),
  raw jsonb,
  created_at timestamptz not null default now()
);
-- 既存DB向け（create table が既存テーブルをスキップした場合に備える）
alter table public.payments add column if not exists stripe_charge_id text;
create index if not exists payments_customer_idx on public.payments (customer_id);
create index if not exists payments_status_idx on public.payments (status);
create index if not exists payments_occurred_idx on public.payments (occurred_at desc);
-- Stripe→DB 同期の冪等性キー（upsert onConflict 用）。
create unique index if not exists payments_stripe_charge_id_key on public.payments (stripe_charge_id);

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
-- SECURITY DEFINER is required: these helpers read public.profiles, and
-- profiles' own RLS policies call is_admin(). Without DEFINER the inner read
-- re-enters the policy and recurses ("stack depth limit exceeded"), which makes
-- every is_admin()-gated admin read return empty. DEFINER bypasses RLS inside
-- the function (it only reads the caller's own row via auth.uid()).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('owner','admin','moderator')
  );
$$;

create or replace function public.current_customer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
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
-- NOTE: v_customer_summary は special_team_memberships（team_name 含む）に
-- 依存するため、そのテーブル定義より後（ファイル末尾）で作成します。
-- 定義はこのファイルの末尾「Customer summary view (definition)」を参照。

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

-- RetouchPony【リタポ】メンバー (RPT): flat ¥3,000/month, combinable with all
-- other plans. Sign-ups are handled externally via Stripe; this row exists so
-- the plan is manageable in admin and assignable to contracts.
--
-- NOTE: Postgres forbids using an enum value in the same transaction that
-- ADDed it (error 55P04). On an EXISTING database the `alter type ... add
-- value 'RPT'` above is not yet committed when this seed runs, so the insert
-- is wrapped to skip cleanly; re-running this script (or the migration having
-- been applied earlier) lets the insert succeed. On a FRESH install the value
-- is part of `create type`, so it inserts on the first run.
do $$
begin
  insert into public.membership_plans (code, name, monthly_amount, unit_amount, allow_with_support, allow_with_team, sort_order, description)
  values
    ('RPT', 'RetouchPony【リタポ】メンバー', 3000, null, true, true, 45, '月額3,000円のRetouch Ponys Team（RPT）メンバー（他会員と併用可能）')
  on conflict (code, name) do update
    set monthly_amount = excluded.monthly_amount,
        allow_with_support = excluded.allow_with_support,
        allow_with_team = excluded.allow_with_team,
        description = excluded.description,
        updated_at = now();
exception when others then
  raise notice 'RPT plan seed skipped (enum value not yet committed — re-run this script once more): %', sqlerrm;
end $$;

-- 重複プランの自動整理（要件 #5）。会員名変更後にこのseedが再実行されると
-- 旧名称（A会員 等）が空の重複として再作成されるため、契約0件かつ「契約ありの
-- 同コード兄弟」が存在するプランのみ無効化する。契約が紐づくプランは残す。
-- 新規インストール（契約0件）では何も無効化されない。削除はしない。
update public.membership_plans mp
set is_active = false, updated_at = now()
where mp.is_active = true
  and not exists (select 1 from public.contracts c where c.plan_id = mp.id)
  and exists (
    select 1
    from public.membership_plans sib
    join public.contracts c2 on c2.plan_id = sib.id
    where sib.code = mp.code and sib.id <> mp.id
  );

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
-- Seed login accounts (password == email for these bootstrap logins):
--   owner     = 野口 佳槻 (bagunet21@yahoo.co.jp)
--   admin     = admin@gmail.com         (the sole administrator)
--   moderator = horse@gamil.com
-- Each call creates/updates auth.users (bcrypt password) + auth.identities +
-- public.customers + public.profiles. full_name is only set on INSERT, so
-- real customer names are never overwritten on re-run.
-- =====================================================================
create or replace function public.seed_login_account(
  p_email text, p_password text, p_name text, p_role text
) returns void language plpgsql as $$
declare
  v_uid uuid;
  v_customer_id uuid;
begin
  select id into v_uid from auth.users where email = p_email;
  if v_uid is null then
    v_uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, recovery_sent_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      p_email, crypt(p_password, gen_salt('bf')),
      now(), null, null,
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', p_name),
      now(), now(), '', '', '', ''
    );
  else
    update auth.users
      set encrypted_password = crypt(p_password, gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          updated_at = now()
      where id = v_uid;
  end if;

  if not exists (select 1 from auth.identities where user_id = v_uid and provider = 'email') then
    insert into auth.identities (
      id, user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_uid, 'email', v_uid::text,
      jsonb_build_object('sub', v_uid::text, 'email', p_email, 'email_verified', true),
      now(), now(), now()
    );
  end if;

  select id into v_customer_id from public.customers where email = p_email;
  if v_customer_id is null then
    insert into public.customers (auth_user_id, full_name, email, status)
    values (v_uid, p_name, p_email, 'active')
    returning id into v_customer_id;
  else
    update public.customers set auth_user_id = v_uid, status = 'active' where id = v_customer_id;
  end if;

  insert into public.profiles (id, role, customer_id)
  values (v_uid, p_role, v_customer_id)
  on conflict (id) do update
    set role = excluded.role, customer_id = excluded.customer_id, updated_at = now();
end $$;

select public.seed_login_account('bagunet21@yahoo.co.jp', 'bagunet21@yahoo.co.jp', '野口 佳槻',   'owner');
select public.seed_login_account('admin@gmail.com',       'admin@gmail.com',       '管理者',       'admin');
select public.seed_login_account('horse@gamil.com',       'horse@gamil.com',       'モデレーター', 'moderator');

-- =====================================================================
-- News table (homepage carousel)
-- =====================================================================
create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  tag text not null default 'お知らせ',
  tag_color text not null default 'bg-brand-50 text-brand-dark',
  image_url text,
  published_at timestamptz not null default now(),
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_news_published on public.news (is_published, published_at desc);

alter table public.news enable row level security;

drop policy if exists "news public read" on public.news;
create policy "news public read" on public.news
  for select using (is_published = true or public.is_admin());
drop policy if exists "news admin write" on public.news;
create policy "news admin write" on public.news
  for all using (public.is_admin()) with check (public.is_admin());

-- updated_at trigger for news
drop trigger if exists news_set_updated_at on public.news;
create trigger news_set_updated_at before update on public.news
  for each row execute procedure public.tg_set_updated_at();

-- Seed news
insert into public.news (title, body, tag, tag_color, image_url, published_at, sort_order)
select v.title, v.body, v.tag, v.tag_color, v.image_url, v.published_at::timestamptz, v.sort_order
from (values
  ('新しい支援馬「コスモブライト」を追加しました','2024年引退のコスモブライトが牧場に到着しました。支援の受付を開始します。','お知らせ','bg-brand-50 text-brand-dark','https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=600&h=300&fit=crop','2026-05-20T00:00:00Z',1),
  ('6月牧場見学会のお申込み受付開始','6月14日（日）開催の牧場見学会の予約受付を開始いたしました。定員20名。','イベント','bg-amber-50 text-amber-800','https://images.unsplash.com/photo-1563830283-12f0a3ec7bf3?w=600&h=300&fit=crop','2026-05-10T00:00:00Z',2),
  ('メンバーズサイトをリニューアルしました','UI/UXを刷新し、支援状況の確認や口数変更がより簡単になりました。','リリース','bg-blue-50 text-blue-700','https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=300&fit=crop','2026-04-28T00:00:00Z',3),
  ('日本経済新聞で活動が紹介されました','引退馬支援の取り組みが日経朝刊の社会面で取り上げられました。','メディア','bg-purple-50 text-purple-700','https://images.unsplash.com/photo-1495020689067-958852a7765e?w=600&h=300&fit=crop','2026-04-15T00:00:00Z',4),
  ('年次活動報告書を公開しました','2025年度の支援実績・会計報告をまとめた年次報告書をPDFで公開しています。','お知らせ','bg-brand-50 text-brand-dark','https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&h=300&fit=crop','2026-03-30T00:00:00Z',5),
  ('春の感謝イベントを開催しました','会員80名が参加。牧場でのBBQと馬とのふれあいを楽しんでいただきました。','イベント','bg-amber-50 text-amber-800','https://images.unsplash.com/photo-1530092285049-1c42085fd395?w=600&h=300&fit=crop','2026-03-12T00:00:00Z',6),
  ('冬季の馬たちの健康レポート','獣医チームによる冬季健康診断の結果をご報告します。全頭健康状態良好です。','お知らせ','bg-brand-50 text-brand-dark','https://images.unsplash.com/photo-1598974357801-cbca100e65d3?w=600&h=300&fit=crop','2026-02-20T00:00:00Z',7),
  ('新年のご挨拶と2026年の活動計画','新年あけましておめでとうございます。本年の活動計画をお知らせいたします。','お知らせ','bg-brand-50 text-brand-dark','https://images.unsplash.com/photo-1504208434388-831e4f559ceb?w=600&h=300&fit=crop','2026-01-05T00:00:00Z',8),
  ('Stripe決済システムをアップデートしました','より安全で迅速な決済処理を実現するため、決済基盤を更新しました。','リリース','bg-blue-50 text-blue-700','https://images.unsplash.com/photo-1556742031-c6961e8560b0?w=600&h=300&fit=crop','2025-12-15T00:00:00Z',9),
  ('年末年始の事務局休業のお知らせ','12月29日〜1月3日まで事務局はお休みとなります。お問い合わせへのご返信は1月4日以降となります。','お知らせ','bg-brand-50 text-brand-dark','https://images.unsplash.com/photo-1482517967863-00e15c9b44be?w=600&h=300&fit=crop','2025-12-10T00:00:00Z',10),
  ('ホースセラピー体験プログラム開始','引退馬と触れ合うホースセラピー体験プログラムの受付を開始しました。','イベント','bg-amber-50 text-amber-800','https://images.unsplash.com/photo-1450052590821-8bf91254a353?w=600&h=300&fit=crop','2025-11-20T00:00:00Z',11),
  ('支援者数600名を突破しました','皆さまのおかげで支援者数が600名を超えました。心より感謝申し上げます。','お知らせ','bg-brand-50 text-brand-dark','https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&h=300&fit=crop','2025-11-01T00:00:00Z',12)
) as v(title, body, tag, tag_color, image_url, published_at, sort_order)
where not exists (select 1 from public.news n where n.title = v.title);

-- =====================================================================
-- Special Team membership (特別チーム会員)
--   - Per-horse, fixed 1,000円/month.
--   - Combinable with ALL other plans (A/B/C and 支援会員).
--   - Isolated table so it never interferes with contracts /
--     support_subscriptions queries.
-- =====================================================================
create table if not exists public.special_team_memberships (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  horse_id uuid not null references public.horses(id) on delete restrict,
  monthly_amount integer not null default 1000,
  stripe_subscription_id text,
  stripe_subscription_item_id text,
  status contract_status not null default 'active',
  team_name text,
  started_at timestamptz not null default now(),
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- 既存DB向け（create table が既存テーブルをスキップした場合に備える）
alter table public.special_team_memberships
  add column if not exists team_name text;
create index if not exists special_team_customer_idx on public.special_team_memberships (customer_id);
create index if not exists special_team_horse_idx on public.special_team_memberships (horse_id);
create index if not exists special_team_status_idx on public.special_team_memberships (status);
create index if not exists special_team_sub_idx on public.special_team_memberships (stripe_subscription_id);

alter table public.special_team_memberships enable row level security;

drop policy if exists "special_team scope" on public.special_team_memberships;
create policy "special_team scope" on public.special_team_memberships
  for select using (customer_id = public.current_customer_id() or public.is_admin());
drop policy if exists "special_team admin all" on public.special_team_memberships;
create policy "special_team admin all" on public.special_team_memberships
  for all using (public.is_admin()) with check (public.is_admin());

drop trigger if exists special_team_set_updated_at on public.special_team_memberships;
create trigger special_team_set_updated_at before update on public.special_team_memberships
  for each row execute procedure public.tg_set_updated_at();

-- =====================================================================
-- Customer summary view (definition)
-- =====================================================================
-- 会員種別 / 支援数 / 特別参加 の3区分を返す（要件 #2）。
-- special_team_memberships.team_name を参照するため、同テーブル定義の後で作成。
-- 詳細は migrations/20260601_member_classification.sql を参照。
-- 列の追加・並び替えを伴うため create or replace では置換できない（42P16）。
-- 一旦 drop してから作り直す。
drop view if exists public.v_customer_summary;
create view public.v_customer_summary as
select
  c.id as customer_id,
  c.full_name,
  c.email,
  c.status,
  c.avatar_url,
  -- 基本会員区分（A/B/C のみ。RPT・特別チームは含めない）
  basic_plan.plan_code as primary_plan_code,
  basic_plan.plan_name as primary_plan_name,
  -- 会員種別コード: 基本契約(A/B/C) > 無ければ支援(SUPPORT) > 無ければ null
  coalesce(
    basic_plan.plan_code::text,
    case when coalesce(support_agg.horse_count, 0) > 0 then 'SUPPORT' end
  ) as member_class_code,
  coalesce(support_agg.total_units, 0)  as total_support_units,
  coalesce(support_agg.horse_count, 0)  as total_support_horses,
  -- 月額合計 = 馬ごとの支援額合計 + 基本会費(A/B/C)。
  -- 詳細は migrations/20260608_monthly_total_include_basic.sql を参照。
  coalesce(support_agg.monthly_total, 0) + coalesce(basic_plan.plan_monthly, 0) as monthly_total,
  contract_agg.current_period_end as next_payment_at,
  contract_agg.contract_status as contract_status,
  -- 特別参加
  coalesce(rpt_agg.active, false) as rpt_active,
  coalesce(team_agg.team_count, 0) as special_team_count,
  team_agg.team_names as special_team_names
from public.customers c
left join lateral (
  select mp.code as plan_code, mp.name as plan_name, mp.monthly_amount as plan_monthly
  from public.contracts ct
  join public.membership_plans mp on mp.id = ct.plan_id
  where ct.customer_id = c.id and ct.status = 'active'
    and mp.code in ('A', 'B', 'C')
  order by ct.started_at desc limit 1
) basic_plan on true
left join lateral (
  select
    sum(ss.units) as total_units,
    count(distinct ss.horse_id) as horse_count,
    sum(ss.monthly_amount) as monthly_total
  from public.support_subscriptions ss
  where ss.customer_id = c.id and ss.status = 'active'
) support_agg on true
left join lateral (
  select bool_or(ct.status = 'active') as active
  from public.contracts ct
  join public.membership_plans mp on mp.id = ct.plan_id
  where ct.customer_id = c.id and ct.status = 'active' and mp.code = 'RPT'
) rpt_agg on true
left join lateral (
  select
    count(*) as team_count,
    array_agg(distinct coalesce(nullif(st.team_name, ''), h.name))
      filter (where st.horse_id is not null or st.team_name is not null) as team_names
  from public.special_team_memberships st
  left join public.horses h on h.id = st.horse_id
  where st.customer_id = c.id and st.status = 'active'
) team_agg on true
left join lateral (
  select current_period_end, status::text as contract_status
  from public.contracts ct
  where ct.customer_id = c.id
  order by current_period_end desc nulls last limit 1
) contract_agg on true;

-- =====================================================================
-- Audit-log full-text search RPC
-- =====================================================================
-- audit_logs.meta is jsonb, which PostgREST's .or(ilike) can't body-search.
-- This function searches action / target_table / the meta JSON body / the
-- actor's name+email server-side, and returns the requested page plus the
-- total match count. SECURITY INVOKER (default) → the "audit admin only" RLS
-- policy still applies (non-admins get 0 rows).
create or replace function public.search_audit_logs(
  p_q text default null,
  p_action text default null,
  p_table text default null,
  p_limit int default 100,
  p_offset int default 0
)
returns table (
  id uuid,
  actor_id uuid,
  action text,
  target_table text,
  target_id uuid,
  meta jsonb,
  created_at timestamptz,
  total_count bigint
)
language sql
stable
as $$
  with filtered as (
    select a.*
    from public.audit_logs a
    where (p_action is null or p_action = '' or a.action = p_action)
      and (p_table is null or p_table = '' or a.target_table = p_table)
      and (
        p_q is null or p_q = ''
        or a.action ilike '%' || p_q || '%'
        or coalesce(a.target_table, '') ilike '%' || p_q || '%'
        or a.meta::text ilike '%' || p_q || '%'
        or exists (
          select 1
          from public.profiles p
          join public.customers c on c.id = p.customer_id
          where p.id = a.actor_id
            and (
              coalesce(c.full_name, '') ilike '%' || p_q || '%'
              or coalesce(c.email::text, '') ilike '%' || p_q || '%'
            )
        )
      )
  )
  select
    f.id, f.actor_id, f.action, f.target_table, f.target_id, f.meta, f.created_at,
    count(*) over () as total_count
  from filtered f
  order by f.created_at desc
  offset greatest(p_offset, 0)
  limit greatest(p_limit, 1);
$$;

grant execute on function public.search_audit_logs(text, text, text, int, int) to authenticated;
