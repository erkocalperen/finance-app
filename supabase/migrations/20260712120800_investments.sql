-- Yatırım portföyü çekirdek şeması.
--
-- Muhasebe: investment_trades transactions'a DOKUNMAZ. Yatırım alımı
-- gider, satışı gelir DEĞİLDİR — sadece TL <-> varlık dönüşümü.
-- account_balances view'ına dahil edilir; monthly_summary /
-- category_spending'e ise dokunulmaz.

create type public.instrument_kind as enum ('gold', 'silver', 'stock');
create type public.trade_side      as enum ('buy', 'sell');

-- instruments: global katalog (user_id yok, herkes aynı listeyi kullanır)
create table public.instruments (
  id uuid primary key default gen_random_uuid(),
  kind public.instrument_kind not null,
  symbol text not null unique,
  name text not null,
  unit text not null,
  currency char(3) not null default 'TRY',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.instruments enable row level security;

-- Yalnızca SELECT — INSERT/UPDATE/DELETE politikası YOK, katalog migration ile yönetilir.
create policy "instruments_select_all" on public.instruments
  for select
  to authenticated
  using (true);

insert into public.instruments (kind, symbol, name, unit, currency) values
  ('gold',   'XAU_GRAM',        'Gram Altın',         'gram', 'TRY'),
  ('gold',   'XAU_CEYREK',      'Çeyrek Altın',       'adet', 'TRY'),
  ('gold',   'XAU_YARIM',       'Yarım Altın',        'adet', 'TRY'),
  ('gold',   'XAU_TAM',         'Tam Altın',          'adet', 'TRY'),
  ('gold',   'XAU_CUMHURIYET',  'Cumhuriyet Altını',  'adet', 'TRY'),
  ('gold',   'XAU_ONS',         'Ons Altın',          'ons',  'USD'),
  ('silver', 'XAG_GRAM',        'Gram Gümüş',         'gram', 'TRY'),
  ('stock',  'THYAO',           'Türk Hava Yolları',  'adet', 'TRY'),
  ('stock',  'GARAN',           'Garanti BBVA',       'adet', 'TRY'),
  ('stock',  'ASELS',           'Aselsan',            'adet', 'TRY'),
  ('stock',  'TUPRS',           'Tüpraş',             'adet', 'TRY'),
  ('stock',  'SISE',            'Şişecam',            'adet', 'TRY'),
  ('stock',  'AKBNK',           'Akbank',             'adet', 'TRY'),
  ('stock',  'KCHOL',           'Koç Holding',        'adet', 'TRY'),
  ('stock',  'EREGL',           'Ereğli Demir Çelik', 'adet', 'TRY');

-- investment_trades: kullanıcının alım/satım kayıtları
create table public.investment_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references public.instruments(id) on delete restrict,
  account_id uuid not null references public.accounts(id) on delete restrict,
  side public.trade_side not null,
  -- Ondalık miktar zorunlu (2.5 gram altın gibi).
  quantity numeric(18, 6) not null check (quantity > 0),
  unit_price numeric(18, 6) not null check (unit_price > 0),
  fee numeric(14, 2) not null default 0 check (fee >= 0),
  occurred_on date not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index investment_trades_user_occurred_idx
  on public.investment_trades (user_id, occurred_on desc);
create index investment_trades_instrument_idx
  on public.investment_trades (instrument_id);

create trigger set_updated_at
  before update on public.investment_trades
  for each row execute function public.set_updated_at();

alter table public.investment_trades enable row level security;

create policy "investment_trades_select_own" on public.investment_trades
  for select using ((select auth.uid()) = user_id);

create policy "investment_trades_insert_own" on public.investment_trades
  for insert with check ((select auth.uid()) = user_id);

create policy "investment_trades_update_own" on public.investment_trades
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "investment_trades_delete_own" on public.investment_trades
  for delete using ((select auth.uid()) = user_id);

-- instrument_prices: manuel fiyat girişleri (bu faz), ilerde otomatik kaynak.
-- Global — gram altının fiyatı herkes için aynı.
create table public.instrument_prices (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  price numeric(18, 6) not null check (price > 0),
  as_of timestamptz not null default now(),
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

create index instrument_prices_instrument_asof_idx
  on public.instrument_prices (instrument_id, as_of desc);

alter table public.instrument_prices enable row level security;

create policy "instrument_prices_select_all" on public.instrument_prices
  for select to authenticated using (true);

create policy "instrument_prices_insert_all" on public.instrument_prices
  for insert to authenticated with check (true);

-- UPDATE / DELETE politikası YOK — geçmiş fiyatlar immutable.

-- ============================================================================
-- View: latest_instrument_prices
-- Her instrument için as_of'u en yeni tek satır.
-- ============================================================================
create view public.latest_instrument_prices
with (security_invoker = true) as
select distinct on (instrument_id)
  instrument_id,
  price,
  as_of,
  source
from public.instrument_prices
order by instrument_id, as_of desc;

-- ============================================================================
-- View: portfolio_holdings
-- Aktif pozisyonlar + ağırlıklı ortalama maliyet + K/Z hesabı.
-- Kritik: quantity = 0 filtrelendi, current_price NULL olabilir (view çökmez).
-- ============================================================================
create view public.portfolio_holdings
with (security_invoker = true) as
select
  h.user_id,
  h.instrument_id,
  i.symbol,
  i.name,
  i.kind,
  i.unit,
  i.currency,
  h.quantity,
  h.avg_cost,
  h.quantity * h.avg_cost as total_cost,
  lp.price as current_price,
  lp.as_of as price_as_of,
  case when lp.price is not null then h.quantity * lp.price end as market_value,
  case when lp.price is not null then h.quantity * lp.price - (h.quantity * h.avg_cost) end as pnl,
  case
    when lp.price is not null and (h.quantity * h.avg_cost) > 0
    then (h.quantity * lp.price - (h.quantity * h.avg_cost)) / (h.quantity * h.avg_cost) * 100
  end as pnl_pct
from (
  select
    it.user_id,
    it.instrument_id,
    sum(case when it.side = 'buy'  then it.quantity else 0 end)
      - sum(case when it.side = 'sell' then it.quantity else 0 end) as quantity,
    -- Ağırlıklı ortalama maliyet SADECE alımlar üzerinden.
    -- fee'yi de dahil ediyoruz — gerçek edinim maliyeti bu.
    case
      when sum(case when it.side = 'buy' then it.quantity else 0 end) > 0
      then sum(case when it.side = 'buy' then it.quantity * it.unit_price + it.fee else 0 end)
        / sum(case when it.side = 'buy' then it.quantity else 0 end)
    end as avg_cost
  from public.investment_trades it
  group by it.user_id, it.instrument_id
) h
join public.instruments i on i.id = h.instrument_id
left join public.latest_instrument_prices lp on lp.instrument_id = h.instrument_id
where h.quantity > 0;

-- ============================================================================
-- account_balances view'ını yatırım işlemlerini de sayacak şekilde güncelle.
-- Alım (buy): hesaptan quantity*unit_price+fee çıkar.
-- Satış (sell): hesaba quantity*unit_price-fee gelir.
-- Aynı-para-birimi invariant'ı: i.currency = a.currency (server action zorlar).
-- ============================================================================
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
    + coalesce((
        select
          sum(case when it.side = 'sell' then it.quantity * it.unit_price - it.fee else 0 end)
          - sum(case when it.side = 'buy'  then it.quantity * it.unit_price + it.fee else 0 end)
        from public.investment_trades it
        join public.instruments i on i.id = it.instrument_id
        where it.account_id = a.id and i.currency = a.currency
      ), 0)
    as balance
from public.accounts a;
