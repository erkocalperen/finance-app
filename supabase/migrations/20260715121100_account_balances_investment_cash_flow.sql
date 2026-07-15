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
        where it.account_id = a.id
          and i.currency = a.currency
          and it.counts_as_cash_flow
      ), 0)
    as balance
from public.accounts a;
