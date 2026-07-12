-- Ana listeleme sorgusu: kullanıcının işlemlerini tarih sırasıyla getir
create index transactions_user_occurred_idx
  on public.transactions (user_id, occurred_on desc);

-- Kategoriye göre filtreli listeleme + rapor
create index transactions_user_category_occurred_idx
  on public.transactions (user_id, category_id, occurred_on);

-- Hesap bakiye / hesap bazlı ekran
create index transactions_account_idx
  on public.transactions (account_id);

-- Bütçe ekranı: kullanıcının bir aya ait bütçelerini getir
create index budgets_user_month_idx
  on public.budgets (user_id, month);

-- Zamanlayıcı: bugün çalıştırılacak aktif kuralları bul
create index recurring_rules_user_next_run_idx
  on public.recurring_rules (user_id, next_run_on)
  where is_active;
