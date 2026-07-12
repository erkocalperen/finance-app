-- transfers: hesaplar arası para transferi.
-- Bilinçli tasarım: transactions'a AYRI bir tablo, gelir/gider raporlarına
-- dahil değil. monthly_summary / category_spending view'ları transfers'i
-- GÖRMEZ. Sadece account_balances etkilenir.

create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_account_id uuid not null references public.accounts(id) on delete restrict,
  to_account_id uuid not null references public.accounts(id) on delete restrict,
  amount numeric(14, 2) not null check (amount > 0),
  currency char(3) not null default 'TRY',
  -- Farklı para birimli hesaplar arası transfer için karşı tarafa
  -- ULAŞAN tutar. Aynı para biriminde ise amount ile eşit olur.
  received_amount numeric(14, 2) not null check (received_amount > 0),
  occurred_on date not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transfers_different_accounts
    check (from_account_id <> to_account_id)
);

create index transfers_user_occurred_idx
  on public.transfers (user_id, occurred_on desc);
create index transfers_from_account_idx
  on public.transfers (from_account_id);
create index transfers_to_account_idx
  on public.transfers (to_account_id);

create trigger set_updated_at
  before update on public.transfers
  for each row execute function public.set_updated_at();

-- RLS
alter table public.transfers enable row level security;

create policy "transfers_select_own" on public.transfers
  for select
  using ((select auth.uid()) = user_id);

create policy "transfers_insert_own" on public.transfers
  for insert
  with check ((select auth.uid()) = user_id);

create policy "transfers_update_own" on public.transfers
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "transfers_delete_own" on public.transfers
  for delete
  using ((select auth.uid()) = user_id);

-- account_balances view'ını transfers'i de içerecek şekilde güncelle.
-- monthly_summary ve category_spending'e DOKUNMUYORUZ — transfers oralarda
-- görünmemeli (bu tasarımın tamamının amacı).
--
-- Hesap için delta:
--   + transactions (income)
--   - transactions (expense)
--   + gelen transferler (received_amount, to_account_id = a.id)
--   - giden transferler (amount, from_account_id = a.id)
--
-- transactions için önceki join'in `t.currency = a.currency` kısıtı korunur.
-- Transfers için: outgoing tarafında `currency = a.currency` invariant'ı
-- kod tarafında sağlanır; view formülü received_amount'ın destination'ın
-- para biriminde olduğunu varsayar (form kontratı).
create or replace view public.account_balances
with (security_invoker = true) as
select
  a.id as account_id,
  a.user_id,
  a.name,
  a.type,
  a.currency,
  a.initial_balance
    + coalesce((
        select sum(
          case
            when t.type = 'income'  then t.amount
            when t.type = 'expense' then -t.amount
          end
        )
        from public.transactions t
        where t.account_id = a.id and t.currency = a.currency
      ), 0)
    + coalesce((
        select
          sum(case when tr.to_account_id   = a.id then tr.received_amount else 0 end)
          - sum(case when tr.from_account_id = a.id then tr.amount           else 0 end)
        from public.transfers tr
        where tr.from_account_id = a.id or tr.to_account_id = a.id
      ), 0)
    as balance
from public.accounts a;
