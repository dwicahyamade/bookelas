-- 0001_init.sql — Bookelas schema + approve_booking RPC.
create extension if not exists "pgcrypto";

create table if not exists studios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  wa_number text not null,
  bank_info text not null,
  created_at timestamptz default now()
);

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid references studios(id) on delete cascade,
  title text not null,
  description text,
  capacity int not null default 10,
  price numeric(12, 2) not null,
  created_at timestamptz default now()
);

create table if not exists class_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  magic_token uuid unique default gen_random_uuid(),
  status text check (status in ('SCHEDULED', 'COMPLETED', 'CANCELLED')) default 'SCHEDULED',
  created_at timestamptz default now()
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references class_sessions(id) on delete cascade,
  customer_name text not null,
  customer_wa text not null,
  customer_email text not null,
  payment_proof_url text not null,
  status text check (status in ('PENDING', 'APPROVED', 'REJECTED')) default 'PENDING',
  created_at timestamptz default now()
);

create index if not exists idx_sessions_magic_token on class_sessions(magic_token);
create index if not exists idx_bookings_session_status on bookings(session_id, status);

create or replace function approve_booking(p_booking_id uuid)
returns bookings language plpgsql as $$
declare
  b bookings%rowtype;
  s class_sessions%rowtype;
  cap int;
  approved int;
begin
  select * into b from bookings where id = p_booking_id;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002'; end if;
  if b.status <> 'PENDING' then return b; end if;

  -- Lock the SESSION row so concurrent approvals for the same session serialize.
  select * into s from class_sessions where id = b.session_id for update;

  select c.capacity into cap
    from class_sessions cs join classes c on c.id = cs.class_id
   where cs.id = b.session_id;
  select count(*) into approved
    from bookings
   where session_id = b.session_id and status = 'APPROVED';

  if approved >= cap then
    raise exception 'CLASS_FULL' using errcode = 'P0003';
  end if;

  update bookings set status = 'APPROVED' where id = p_booking_id returning * into b;
  return b;
end; $$;
