-- Notifications table and triggers for bumps/comments

-- Table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade, -- recipient
  actor_id uuid not null references public.users(id) on delete cascade, -- who caused it
  type text not null check (type in ('bump','comment')),
  log_id uuid references public.climb_logs(id) on delete cascade,
  bump_id uuid references public.bumps(id) on delete cascade,
  comment_id uuid references public.climb_comments(id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table public.notifications enable row level security;

-- RLS policies
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='notifications are readable by recipient'
  ) then
    create policy "notifications are readable by recipient" on public.notifications
      for select using (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='recipient can mark read'
  ) then
    create policy "recipient can mark read" on public.notifications
      for update using (user_id = auth.uid());
  end if;
end $$;

create index if not exists idx_notifications_user_unread on public.notifications(user_id, read_at);
create index if not exists idx_notifications_log on public.notifications(log_id);

-- Trigger: on bump insert -> notify log owner
create or replace function public.fn_notify_on_bump()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
  ntype text;
begin
  select cl.user_id into owner from public.climb_logs cl where cl.id = new.log_id;
  if owner is null or owner = new.user_id then
    return new; -- no self notifications
  end if;
  if new.comment is not null then
    ntype := 'comment';
  else
    ntype := 'bump';
  end if;
  insert into public.notifications(user_id, actor_id, type, log_id, bump_id, metadata)
  values (owner, new.user_id, ntype, new.log_id, new.id, json_build_object('text', new.comment));
  return new;
end;
$$;

drop trigger if exists trg_notify_bump_insert on public.bumps;
create trigger trg_notify_bump_insert
after insert on public.bumps
for each row execute function public.fn_notify_on_bump();

-- Trigger: when a bump gets a new comment -> notify owner
create or replace function public.fn_notify_on_bump_comment_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
begin
  if coalesce(old.comment,'') = coalesce(new.comment,'') or new.comment is null then
    return new; -- no change or still empty
  end if;
  select cl.user_id into owner from public.climb_logs cl where cl.id = new.log_id;
  if owner is null or owner = new.user_id then
    return new;
  end if;
  insert into public.notifications(user_id, actor_id, type, log_id, bump_id, metadata)
  values (owner, new.user_id, 'comment', new.log_id, new.id, json_build_object('text', new.comment));
  return new;
end;
$$;

drop trigger if exists trg_notify_bump_comment_update on public.bumps;
create trigger trg_notify_bump_comment_update
after update of comment on public.bumps
for each row execute function public.fn_notify_on_bump_comment_update();

