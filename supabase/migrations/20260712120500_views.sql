-- security_invoker = true KRİTİK: view çağıran kullanıcının RLS'i uygulansın.
-- Aksi halde view, tablonun RLS'ini bypass eden bir arka kapıya döner.

-- account_balances: her hesabın kendi para birimindeki güncel bakiyesi
create view public.account_balances
with (security_invoker = true) as
select
  a.id as account_id,
  a.user_id,
  a.name,
  a.type,
  a.currency,
  a.initial_balance
    + coalesce(sum(
        case
          when t.type = 'income' then t.amount
          when t.type = 'expense' then -t.amount
        end
      ), 0) as balance
from public.accounts a
left join public.transactions t
  on t.account_id = a.id
  and t.currency = a.currency
group by a.id, a.user_id, a.name, a.type, a.currency, a.initial_balance;

-- monthly_summary: kullanıcının base_currency'sinde aylık gelir/gider/net
create view public.monthly_summary
with (security_invoker = true) as
select
  user_id,
  date_trunc('month', occurred_on)::date as month,
  coalesce(sum(case when type = 'income'  then base_amount else 0 end), 0) as total_income,
  coalesce(sum(case when type = 'expense' then base_amount else 0 end), 0) as total_expense,
  coalesce(
    sum(case when type = 'income' then base_amount else -base_amount end),
    0
  ) as net
from public.transactions
group by user_id, date_trunc('month', occurred_on);

-- category_spending: aylık kategori dağılımı (base_currency üzerinden)
create view public.category_spending
with (security_invoker = true) as
select
  t.user_id,
  date_trunc('month', t.occurred_on)::date as month,
  c.id as category_id,
  c.name as category_name,
  c.color,
  c.type,
  sum(t.base_amount) as total
from public.transactions t
join public.categories c on c.id = t.category_id
group by
  t.user_id,
  date_trunc('month', t.occurred_on),
  c.id,
  c.name,
  c.color,
  c.type;
