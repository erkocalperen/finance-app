-- SECURITY DEFINER fonksiyonların doğrudan RPC ile çağrılmasını engelle.
-- Postgres public şemasındaki fonksiyonlara varsayılan olarak PUBLIC'e
-- EXECUTE verir; SECURITY DEFINER olanlarda bu gevşeklik istenmez.
--
-- Trigger fonksiyonları için REVOKE güvenlidir: trigger'lar tablo sahibi
-- bağlamında çalışır ve çağıranın EXECUTE yetkisini aramaz.

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;

revoke execute on function public.set_updated_at() from public;
revoke execute on function public.set_updated_at() from anon;
revoke execute on function public.set_updated_at() from authenticated;
