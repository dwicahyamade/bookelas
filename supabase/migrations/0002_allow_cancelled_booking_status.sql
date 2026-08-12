do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.bookings'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%status%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.bookings drop constraint %I', constraint_name);
  end if;

  alter table public.bookings add constraint bookings_status_check
    check (status in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'));
end $$;
