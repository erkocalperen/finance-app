-- profiles: 1-1 relation with auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  base_currency char(3) not null default 'TRY',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- accounts: kullanıcının nakit / banka / kredi kartı hesapları
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type public.account_type not null,
  currency char(3) not null default 'TRY',
  initial_balance numeric(14, 2) not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- categories: gelir/gider kategorileri (aynı isim farklı türde iki kez olabilir)
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type public.entry_type not null,
  color text not null default '#64748b',
  icon text,
  created_at timestamptz not null default now(),
  unique (user_id, name, type)
);

-- recurring_rules: düzenli tekrar eden işlem şablonları
create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  type public.entry_type not null,
  amount numeric(14, 2) not null check (amount > 0),
  currency char(3) not null default 'TRY',
  frequency public.recurrence_freq not null,
  interval_count int not null default 1 check (interval_count > 0),
  start_date date not null,
  end_date date,
  next_run_on date not null,
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

-- transactions: gerçekleşmiş gelir/gider hareketleri
-- Tasarım kararı: amount her zaman POZİTİF saklanır, yönü `type` belirler.
-- fx_rate işlem anında donar (tarihsel doğruluk), base_amount hesaplanır.
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  category_id uuid not null references public.categories(id) on delete restrict,
  recurring_rule_id uuid references public.recurring_rules(id) on delete set null,
  type public.entry_type not null,
  amount numeric(14, 2) not null check (amount > 0),
  currency char(3) not null default 'TRY',
  fx_rate numeric(14, 6) not null default 1 check (fx_rate > 0),
  base_amount numeric(16, 2) generated always as (round(amount * fx_rate, 2)) stored,
  occurred_on date not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- budgets: kategori bazlı aylık bütçe (month her zaman ayın ilk günü)
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  month date not null,
  amount numeric(14, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category_id, month),
  check (date_trunc('month', month)::date = month)
);
