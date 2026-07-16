alter table public.transactions
  add column source text not null default 'manual',
  add column import_fingerprint text;

alter table public.transactions
  add constraint transactions_source_check
  check (source in ('manual', 'import'));

create index transactions_user_import_fingerprint_idx
  on public.transactions (user_id, import_fingerprint);

