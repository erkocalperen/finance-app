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
  created_at desc,
  as_of desc;
