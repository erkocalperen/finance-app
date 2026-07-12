-- Enum types
create type public.account_type as enum ('cash', 'bank', 'credit_card');
create type public.entry_type as enum ('income', 'expense');
create type public.recurrence_freq as enum ('daily', 'weekly', 'monthly', 'yearly');
