-- profiles ---------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select
  using ((select auth.uid()) = id);

create policy "profiles_insert_own" on public.profiles
  for insert
  with check ((select auth.uid()) = id);

create policy "profiles_update_own" on public.profiles
  for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- NOT: profiles için DELETE politikası YOK -> kullanıcı kendi profilini silemez.

-- accounts ---------------------------------------------------------------
alter table public.accounts enable row level security;

create policy "accounts_select_own" on public.accounts
  for select
  using ((select auth.uid()) = user_id);

create policy "accounts_insert_own" on public.accounts
  for insert
  with check ((select auth.uid()) = user_id);

create policy "accounts_update_own" on public.accounts
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "accounts_delete_own" on public.accounts
  for delete
  using ((select auth.uid()) = user_id);

-- categories -------------------------------------------------------------
alter table public.categories enable row level security;

create policy "categories_select_own" on public.categories
  for select
  using ((select auth.uid()) = user_id);

create policy "categories_insert_own" on public.categories
  for insert
  with check ((select auth.uid()) = user_id);

create policy "categories_update_own" on public.categories
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "categories_delete_own" on public.categories
  for delete
  using ((select auth.uid()) = user_id);

-- recurring_rules --------------------------------------------------------
alter table public.recurring_rules enable row level security;

create policy "recurring_rules_select_own" on public.recurring_rules
  for select
  using ((select auth.uid()) = user_id);

create policy "recurring_rules_insert_own" on public.recurring_rules
  for insert
  with check ((select auth.uid()) = user_id);

create policy "recurring_rules_update_own" on public.recurring_rules
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "recurring_rules_delete_own" on public.recurring_rules
  for delete
  using ((select auth.uid()) = user_id);

-- transactions -----------------------------------------------------------
alter table public.transactions enable row level security;

create policy "transactions_select_own" on public.transactions
  for select
  using ((select auth.uid()) = user_id);

create policy "transactions_insert_own" on public.transactions
  for insert
  with check ((select auth.uid()) = user_id);

create policy "transactions_update_own" on public.transactions
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "transactions_delete_own" on public.transactions
  for delete
  using ((select auth.uid()) = user_id);

-- budgets ----------------------------------------------------------------
alter table public.budgets enable row level security;

create policy "budgets_select_own" on public.budgets
  for select
  using ((select auth.uid()) = user_id);

create policy "budgets_insert_own" on public.budgets
  for insert
  with check ((select auth.uid()) = user_id);

create policy "budgets_update_own" on public.budgets
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "budgets_delete_own" on public.budgets
  for delete
  using ((select auth.uid()) = user_id);
