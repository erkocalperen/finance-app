create policy "instruments_insert_authenticated" on public.instruments
  for insert
  to authenticated
  with check (true);
