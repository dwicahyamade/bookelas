-- 0003_branches_and_admins.sql — multi-branch + admin users.
begin;

create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists branches_slug_key on branches(slug);

create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  branch_id uuid not null references branches(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists admin_users_username_key on admin_users(lower(username));

insert into branches (name, slug)
select 'Main Branch', 'main'
where not exists (select 1 from branches where slug = 'main');

alter table classes drop constraint if exists classes_studio_id_fkey;
alter table classes add column if not exists branch_id uuid references branches(id) on delete restrict;

update classes
   set branch_id = (select id from branches where slug = 'main')
 where branch_id is null;

alter table classes alter column branch_id set not null;

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_branches_updated on branches;
create trigger trg_branches_updated before update on branches
  for each row execute function set_updated_at();

drop trigger if exists trg_admin_users_updated on admin_users;
create trigger trg_admin_users_updated before update on admin_users
  for each row execute function set_updated_at();

create or replace function assert_branch_active()
returns trigger language plpgsql as $$
declare
  b_active boolean;
begin
  select br.is_active into b_active
    from classes c join branches br on br.id = c.branch_id
   where c.id = new.class_id;
  if not coalesce(b_active, false) then
    raise exception 'BRANCH_INACTIVE' using errcode = 'P0003';
  end if;
  return new;
end; $$;

drop trigger if exists trg_session_branch_active on class_sessions;
create trigger trg_session_branch_active before insert on class_sessions
  for each row execute function assert_branch_active();

alter table classes drop column if exists studio_id;

commit;
