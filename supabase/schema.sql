-- ============================================================
-- Flowboard schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor).
-- Every table is scoped to auth.uid() via RLS; the anonymous
-- auth session provides the user identity.
-- ============================================================

-- ---------- team_members ----------
create table public.team_members (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 60),
  color      text not null default '#5b5bd6',
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------- tasks ----------
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 4000),
  status      text not null default 'todo'
              check (status in ('todo', 'in_progress', 'in_review', 'done')),
  priority    text not null default 'normal'
              check (priority in ('low', 'normal', 'high')),
  due_date    date,
  assignee_id uuid references public.team_members (id) on delete set null,
  sort_order  double precision not null default 1000,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ---------- labels ----------
create table public.labels (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 60),
  color      text not null default '#8b8d98',
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------- task_labels (join) ----------
create table public.task_labels (
  task_id  uuid not null references public.tasks (id) on delete cascade,
  label_id uuid not null references public.labels (id) on delete cascade,
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (task_id, label_id)
);

-- ---------- comments ----------
create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------- activity ----------
-- Written by triggers only (see below); the client never inserts
-- directly, so the log cannot drift from actual task changes.
create table public.activity (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  kind       text not null
             check (kind in ('created', 'status_changed', 'edited', 'assigned', 'unassigned', 'commented')),
  detail     jsonb not null default '{}',
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------- indexes ----------
create index tasks_user_status_idx on public.tasks (user_id, status, sort_order);
create index comments_task_idx on public.comments (task_id, created_at);
create index activity_task_idx on public.activity (task_id, created_at desc);
create index task_labels_label_idx on public.task_labels (label_id);
create index tasks_assignee_idx on public.tasks (assignee_id);

-- ============================================================
-- Row Level Security: each user can only touch their own rows.
-- ============================================================

alter table public.tasks        enable row level security;
alter table public.team_members enable row level security;
alter table public.labels       enable row level security;
alter table public.task_labels  enable row level security;
alter table public.comments     enable row level security;
alter table public.activity     enable row level security;

create policy "own tasks" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own team members" on public.team_members
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own labels" on public.labels
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own task labels" on public.task_labels
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own comments" on public.comments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Activity is read-only from the client; rows are inserted by
-- security-definer triggers.
create policy "read own activity" on public.activity
  for select using (auth.uid() = user_id);

-- ============================================================
-- Activity triggers
-- ============================================================

create or replace function public.log_task_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into activity (task_id, kind, detail, user_id)
    values (new.id, 'created', jsonb_build_object('status', new.status), new.user_id);
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into activity (task_id, kind, detail, user_id)
    values (new.id, 'status_changed',
            jsonb_build_object('from', old.status, 'to', new.status), new.user_id);
  end if;

  if new.assignee_id is distinct from old.assignee_id then
    insert into activity (task_id, kind, detail, user_id)
    values (new.id,
            case when new.assignee_id is null then 'unassigned' else 'assigned' end,
            jsonb_build_object('assignee_id', new.assignee_id), new.user_id);
  end if;

  if new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.priority is distinct from old.priority
     or new.due_date is distinct from old.due_date then
    insert into activity (task_id, kind, detail, user_id)
    values (new.id, 'edited', '{}', new.user_id);
  end if;

  return new;
end;
$$;

create trigger task_activity
  after insert or update on public.tasks
  for each row execute function public.log_task_activity();

create or replace function public.log_comment_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into activity (task_id, kind, detail, user_id)
  values (new.task_id, 'commented', '{}', new.user_id);
  return new;
end;
$$;

create trigger comment_activity
  after insert on public.comments
  for each row execute function public.log_comment_activity();
