-- Generic updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- updated_at kolonu olan tüm tablolara bağla (categories'de yok)
create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

create trigger set_updated_at
  before update on public.recurring_rules
  for each row execute function public.set_updated_at();

create trigger set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

create trigger set_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

-- Yeni kullanıcı: profil satırı + varsayılan kategorileri seed'le.
-- SECURITY DEFINER + boş search_path (Supabase güvenlik linter'ı için).
-- Tüm nesneleri tam nitelenmiş isimle çağır.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);

  insert into public.categories (user_id, name, type, color) values
    (new.id, 'Market',          'expense'::public.entry_type, '#ef4444'),
    (new.id, 'Kira',            'expense'::public.entry_type, '#f97316'),
    (new.id, 'Faturalar',       'expense'::public.entry_type, '#f59e0b'),
    (new.id, 'Ulaşım',          'expense'::public.entry_type, '#eab308'),
    (new.id, 'Yeme-İçme',       'expense'::public.entry_type, '#84cc16'),
    (new.id, 'Sağlık',          'expense'::public.entry_type, '#14b8a6'),
    (new.id, 'Giyim',           'expense'::public.entry_type, '#06b6d4'),
    (new.id, 'Eğlence',         'expense'::public.entry_type, '#8b5cf6'),
    (new.id, 'Abonelikler',     'expense'::public.entry_type, '#d946ef'),
    (new.id, 'Diğer',           'expense'::public.entry_type, '#64748b'),
    (new.id, 'Maaş',            'income'::public.entry_type,  '#10b981'),
    (new.id, 'Ek Gelir',        'income'::public.entry_type,  '#3b82f6'),
    (new.id, 'Yatırım Getirisi','income'::public.entry_type,  '#a855f7'),
    (new.id, 'Diğer',           'income'::public.entry_type,  '#22c55e');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
