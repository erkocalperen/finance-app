alter table public.transfers
  add column counts_as_expense boolean not null default false;
