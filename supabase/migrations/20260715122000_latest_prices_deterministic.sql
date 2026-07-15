create or replace view public.latest_instrument_prices
with (security_invoker = true) as
select distinct on (instrument_id)
  instrument_id,
  price,
  as_of,
  source
from public.instrument_prices
order by
  instrument_id,
  as_of desc,
  created_at desc,
  case when source = 'manual' then 0 else 1 end;
