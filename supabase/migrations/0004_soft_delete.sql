-- 0004_soft_delete.sql — timestamp-based soft deletion.
begin;

alter table branches add column if not exists deleted_at timestamptz;
alter table classes add column if not exists deleted_at timestamptz;

create index if not exists branches_visible_idx on branches(name) where deleted_at is null;
create index if not exists classes_visible_idx on classes(branch_id, title) where deleted_at is null;

create or replace function assert_branch_active()
returns trigger language plpgsql as $$
declare
  b_active boolean;
  b_deleted_at timestamptz;
  c_deleted_at timestamptz;
begin
  select br.is_active, br.deleted_at, c.deleted_at
    into b_active, b_deleted_at, c_deleted_at
    from classes c join branches br on br.id = c.branch_id
   where c.id = new.class_id;
  if not coalesce(b_active, false) or b_deleted_at is not null or c_deleted_at is not null then
    raise exception 'BRANCH_INACTIVE' using errcode = 'P0003';
  end if;
  return new;
end; $$;

commit;
