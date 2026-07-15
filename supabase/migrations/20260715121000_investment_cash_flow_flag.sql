alter table public.investment_trades
  add column counts_as_cash_flow boolean not null default true;
