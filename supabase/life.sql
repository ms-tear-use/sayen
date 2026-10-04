-- Shared life features: status, schedules, date photos, memory photos, and goal folders.
-- Run this whole file once in the Supabase SQL editor, after partner_access.sql.
-- It only adds columns and tables. It does not drop existing data.

alter table public.important_dates
  add column if not exists recurrence text not null default 'none';

alter table public.important_dates
  add column if not exists reminder boolean not null default false;

update public.important_dates
set recurrence = 'monthly'
where recurrence = 'none'
  and title ~* 'monthsary';

update public.important_dates
set recurrence = 'yearly'
where recurrence = 'none'
  and title ~* 'birthday|anniversary';

create table if not exists public.member_statuses (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  label text not null,
  ends_at time,
  updated_at timestamptz not null default now()
);

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  title text not null,
  days smallint[] not null,
  starts_at time not null,
  ends_at time not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_schedules_space on public.schedules(space_id);

create table if not exists public.important_date_photos (
  id uuid primary key default gen_random_uuid(),
  date_id uuid not null references public.important_dates(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  image_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_date_photos_date on public.important_date_photos(date_id);

create table if not exists public.memory_photos (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  image_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_memory_photos_memory on public.memory_photos(memory_id);

create table if not exists public.goal_categories (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (space_id, name)
);

create table if not exists public.goal_subcategories (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  category_id uuid not null references public.goal_categories(id) on delete cascade,
  name text not null,
  target_date date,
  completed_on date,
  complete boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_goal_subcategories_category on public.goal_subcategories(category_id);

alter table public.shared_goals
  add column if not exists subcategory_id uuid;

alter table public.shared_goals
  add column if not exists target_date date;

alter table public.shared_goals
  add column if not exists completed_on date;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'shared_goals_subcategory_id_fkey'
  ) then
    alter table public.shared_goals
      add constraint shared_goals_subcategory_id_fkey
      foreign key (subcategory_id)
      references public.goal_subcategories(id)
      on delete cascade;
  end if;
end $$;

alter table public.member_statuses enable row level security;
alter table public.schedules enable row level security;
alter table public.important_date_photos enable row level security;
alter table public.memory_photos enable row level security;
alter table public.goal_categories enable row level security;
alter table public.goal_subcategories enable row level security;

grant select, insert, update, delete on table
  public.member_statuses,
  public.schedules,
  public.important_date_photos,
  public.memory_photos,
  public.goal_categories,
  public.goal_subcategories,
  public.shared_goals,
  public.important_dates
to authenticated;

drop policy if exists "Members read statuses" on public.member_statuses;
create policy "Members read statuses"
  on public.member_statuses for select to authenticated
  using (public.is_member_of(space_id));

drop policy if exists "Members write their status" on public.member_statuses;
create policy "Members write their status"
  on public.member_statuses for insert to authenticated
  with check (user_id = auth.uid() and public.is_member_of(space_id));

drop policy if exists "Members update their status" on public.member_statuses;
create policy "Members update their status"
  on public.member_statuses for update to authenticated
  using (user_id = auth.uid() and public.is_member_of(space_id))
  with check (user_id = auth.uid() and public.is_member_of(space_id));

drop policy if exists "Members delete their status" on public.member_statuses;
create policy "Members delete their status"
  on public.member_statuses for delete to authenticated
  using (user_id = auth.uid() and public.is_member_of(space_id));

drop policy if exists "Members read schedules" on public.schedules;
create policy "Members read schedules"
  on public.schedules for select to authenticated
  using (public.is_member_of(space_id));

drop policy if exists "Members write their schedule" on public.schedules;
create policy "Members write their schedule"
  on public.schedules for insert to authenticated
  with check (user_id = auth.uid() and public.is_member_of(space_id));

drop policy if exists "Members update their schedule" on public.schedules;
create policy "Members update their schedule"
  on public.schedules for update to authenticated
  using (user_id = auth.uid() and public.is_member_of(space_id))
  with check (user_id = auth.uid() and public.is_member_of(space_id));

drop policy if exists "Members delete their schedule" on public.schedules;
create policy "Members delete their schedule"
  on public.schedules for delete to authenticated
  using (user_id = auth.uid() and public.is_member_of(space_id));

drop policy if exists "Members read date photos" on public.important_date_photos;
create policy "Members read date photos"
  on public.important_date_photos for select to authenticated
  using (public.is_member_of(space_id));

drop policy if exists "Members add date photos" on public.important_date_photos;
create policy "Members add date photos"
  on public.important_date_photos for insert to authenticated
  with check (public.is_member_of(space_id));

drop policy if exists "Members delete date photos" on public.important_date_photos;
create policy "Members delete date photos"
  on public.important_date_photos for delete to authenticated
  using (public.is_member_of(space_id));

drop policy if exists "Members read memory photos" on public.memory_photos;
create policy "Members read memory photos"
  on public.memory_photos for select to authenticated
  using (public.is_member_of(space_id));

drop policy if exists "Members add memory photos" on public.memory_photos;
create policy "Members add memory photos"
  on public.memory_photos for insert to authenticated
  with check (public.is_member_of(space_id));

drop policy if exists "Members delete memory photos" on public.memory_photos;
create policy "Members delete memory photos"
  on public.memory_photos for delete to authenticated
  using (public.is_member_of(space_id));

drop policy if exists "Members read goal categories" on public.goal_categories;
create policy "Members read goal categories"
  on public.goal_categories for select to authenticated
  using (public.is_member_of(space_id));

drop policy if exists "Members add goal categories" on public.goal_categories;
create policy "Members add goal categories"
  on public.goal_categories for insert to authenticated
  with check (public.is_member_of(space_id));

drop policy if exists "Members update goal categories" on public.goal_categories;
create policy "Members update goal categories"
  on public.goal_categories for update to authenticated
  using (public.is_member_of(space_id))
  with check (public.is_member_of(space_id));

drop policy if exists "Members delete goal categories" on public.goal_categories;
create policy "Members delete goal categories"
  on public.goal_categories for delete to authenticated
  using (public.is_member_of(space_id));

drop policy if exists "Members read goal subcategories" on public.goal_subcategories;
create policy "Members read goal subcategories"
  on public.goal_subcategories for select to authenticated
  using (public.is_member_of(space_id));

drop policy if exists "Members add goal subcategories" on public.goal_subcategories;
create policy "Members add goal subcategories"
  on public.goal_subcategories for insert to authenticated
  with check (public.is_member_of(space_id));

drop policy if exists "Members update goal subcategories" on public.goal_subcategories;
create policy "Members update goal subcategories"
  on public.goal_subcategories for update to authenticated
  using (public.is_member_of(space_id))
  with check (public.is_member_of(space_id));

drop policy if exists "Members delete goal subcategories" on public.goal_subcategories;
create policy "Members delete goal subcategories"
  on public.goal_subcategories for delete to authenticated
  using (public.is_member_of(space_id));

alter table public.daily_checkins
  add column if not exists media_url text,
  add column if not exists media_kind text;

alter table public.daily_checkins
  drop constraint if exists daily_checkins_media_kind_check;

alter table public.daily_checkins
  add constraint daily_checkins_media_kind_check
  check (media_kind is null or media_kind in ('photo', 'video'));

grant update, delete on table public.daily_checkins to authenticated;

drop policy if exists "Users can update their own check-ins" on public.daily_checkins;
create policy "Users can update their own check-ins"
  on public.daily_checkins for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their own check-ins" on public.daily_checkins;
create policy "Users can delete their own check-ins"
  on public.daily_checkins for delete to authenticated
  using (user_id = auth.uid());

alter table public.profiles
  add column if not exists country text,
  add column if not exists city text;

alter table public.daily_checkins
  add column if not exists title text;

alter table public.daily_checkins
  alter column mood drop not null;

alter table public.daily_checkins
  alter column need drop not null;

do $$
declare
  item record;
begin
  for item in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'daily_checkins'
      and con.contype = 'c'
      and (
        pg_get_constraintdef(con.oid) ilike '%mood%'
        or pg_get_constraintdef(con.oid) ilike '%need%'
      )
      and pg_get_constraintdef(con.oid) not ilike '%media_kind%'
  loop
    execute format('alter table public.daily_checkins drop constraint %I', item.conname);
  end loop;
end $$;

-- Calendar events and reminders. Run this file again in the SQL editor.
-- It only adds columns and tables.

alter table public.important_dates add column if not exists event_type text;
alter table public.important_dates add column if not exists start_time time;
alter table public.important_dates add column if not exists end_time time;
alter table public.important_dates add column if not exists reminder_when text;
alter table public.important_dates add column if not exists count_milestones boolean;
alter table public.important_dates add column if not exists subject_user_id uuid;
alter table public.important_dates add column if not exists recurrence_days text;
alter table public.important_dates add column if not exists created_by uuid;
alter table public.important_dates add column if not exists series_id uuid;
alter table public.important_dates add column if not exists occurrence_date date;
alter table public.important_dates add column if not exists excluded_dates date[] not null default '{}';
alter table public.important_dates add column if not exists recurrence_until date;
alter table public.important_dates add column if not exists time_zone text;

update public.important_dates
set event_type = case
  when title ~* 'birthday' then 'birthday'
  when title ~* 'monthsary|anniversary' then 'anniversary'
  else coalesce(event_type, 'important')
end
where event_type is null;

update public.important_dates
set reminder_when = '1d'
where reminder is true and reminder_when is null;

alter table public.important_dates add column if not exists emoji text;
alter table public.important_dates add column if not exists count_years boolean;
alter table public.important_dates add column if not exists count_months boolean;
alter table public.important_dates add column if not exists person_name text;

update public.important_dates
set event_type = 'milestone'
where event_type = 'anniversary';

update public.important_dates
set event_type = 'important'
where event_type = 'reminder';

update public.important_dates
set count_years = true
where event_type = 'milestone'
  and count_milestones is true
  and count_years is null
  and title !~* 'monthsary';

update public.important_dates
set count_months = true
where event_type = 'milestone'
  and count_milestones is true
  and count_months is null
  and (title ~* 'monthsary' or recurrence = 'monthly');

update public.important_dates
set person_name = substring(title from '^(.+)[''’]s Birthday$')
where event_type = 'birthday'
  and person_name is null
  and title ~* '[''’]s Birthday$';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'important_dates_series_id_fkey') then
    alter table public.important_dates
      add constraint important_dates_series_id_fkey
      foreign key (series_id) references public.important_dates(id) on delete cascade;
  end if;
end $$;

create table if not exists public.notification_settings (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  event_reminders boolean not null default true,
  schedule_reminders boolean not null default true,
  checkin_reminders boolean not null default true
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  dedupe_key text not null,
  title text not null,
  body text,
  href text,
  fire_at timestamptz not null default now(),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

alter table public.notification_settings enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notifications enable row level security;

grant select, insert, update, delete on table
  public.notification_settings,
  public.push_subscriptions,
  public.notifications,
  public.important_dates
to authenticated;

drop policy if exists "Users read notification settings" on public.notification_settings;
create policy "Users read notification settings"
  on public.notification_settings for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users write notification settings" on public.notification_settings;
create policy "Users write notification settings"
  on public.notification_settings for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users update notification settings" on public.notification_settings;
create policy "Users update notification settings"
  on public.notification_settings for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users read push subscriptions" on public.push_subscriptions;
create policy "Users read push subscriptions"
  on public.push_subscriptions for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users write push subscriptions" on public.push_subscriptions;
create policy "Users write push subscriptions"
  on public.push_subscriptions for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users update push subscriptions" on public.push_subscriptions;
create policy "Users update push subscriptions"
  on public.push_subscriptions for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users delete push subscriptions" on public.push_subscriptions;
create policy "Users delete push subscriptions"
  on public.push_subscriptions for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users read notifications" on public.notifications;
create policy "Users read notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users update notifications" on public.notifications;
create policy "Users update notifications"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users delete notifications" on public.notifications;
create policy "Users delete notifications"
  on public.notifications for delete to authenticated
  using (user_id = auth.uid());

-- A memory can optionally belong to one milestone. Deleting the milestone keeps the memory.
alter table public.memories add column if not exists milestone_id uuid;
alter table public.memories add column if not exists emoji text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'memories_milestone_id_fkey') then
    alter table public.memories
      add constraint memories_milestone_id_fkey
      foreign key (milestone_id) references public.important_dates(id) on delete set null;
  end if;
end $$;

create index if not exists idx_memories_milestone on public.memories(milestone_id);

-- Shared journey: a name, a start date, and an optional milestone to follow.
alter table public.spaces add column if not exists journey_name text;
alter table public.spaces add column if not exists journey_started_on date;
alter table public.spaces add column if not exists journey_date_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'spaces_journey_date_id_fkey') then
    alter table public.spaces
      add constraint spaces_journey_date_id_fkey
      foreign key (journey_date_id) references public.important_dates(id) on delete set null;
  end if;
end $$;

-- Reminders are sent by supabase/functions/send-reminders.
-- Deploy that function, then schedule it every 5 minutes.
-- Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@email.com)
-- Use the same public key as VITE_VAPID_PUBLIC_KEY in the app.
