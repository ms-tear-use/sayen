-- sayen schema for Supabase

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  timezone text not null default 'UTC',
  theme_mode text not null default 'system' check (theme_mode in ('light', 'dark', 'system')),
  accent_color text not null default 'purple',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  connection_type text not null check (connection_type in ('couple', 'friends', 'other')),
  invite_code text not null unique,
  space_theme_mode text not null default 'system' check (space_theme_mode in ('light','dark','system')),
  space_accent_color text not null default 'purple',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.space_members (
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

create index if not exists idx_space_members_user_id on public.space_members(user_id);
create index if not exists idx_space_members_space_id on public.space_members(space_id);

create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  mood text not null check (mood in ('great', 'good', 'okay', 'not great', 'rough')),
  message text,
  need text not null check (need in ('talk', 'reassurance', 'distraction', 'attention', 'space')),
  created_at timestamptz not null default now()
);

create index if not exists idx_daily_checkins_space on public.daily_checkins(space_id);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  title text not null,
  caption text,
  location text,
  date date,
  image_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_memories_space on public.memories(space_id);

create table if not exists public.open_when_letters (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  title text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_open_when_letters_space on public.open_when_letters(space_id);

create table if not exists public.important_dates (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  title text not null,
  event_date date,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists idx_important_dates_space on public.important_dates(space_id);

create table if not exists public.shared_goals (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid references public.profiles(user_id) on delete set null,
  title text not null,
  complete boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_shared_goals_space on public.shared_goals(space_id);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  name text not null,
  prompt text,
  created_at timestamptz not null default now()
);

create table if not exists public.game_answers (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  answer text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_game_answers_game on public.game_answers(game_id);

alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.daily_checkins enable row level security;
alter table public.memories enable row level security;
alter table public.open_when_letters enable row level security;
alter table public.important_dates enable row level security;
alter table public.shared_goals enable row level security;
alter table public.games enable row level security;
alter table public.game_answers enable row level security;

create policy "Profiles are viewable by owner" on public.profiles
  for select using (auth.uid() = user_id);

create policy "Profiles can be updated by owner" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Profiles can be inserted by user" on public.profiles
  for insert with check (auth.uid() = user_id);

create policy "Spaces visible to members" on public.spaces
  for select using (
    exists (
      select 1 from public.space_members sm
      where sm.space_id = public.spaces.id and sm.user_id = auth.uid()
    )
  );

create policy "Your spaces can be updated by members" on public.spaces
  for update using (
    exists (
      select 1 from public.space_members sm
      where sm.space_id = public.spaces.id and sm.user_id = auth.uid()
    )
  );

create policy "Members can create membership rows" on public.space_members
  for insert with check (auth.uid() = user_id);

create policy "Members can read memberships for their spaces" on public.space_members
  for select using (
    auth.uid() = user_id or exists (
      select 1 from public.space_members current
      where current.space_id = public.space_members.space_id and current.user_id = auth.uid()
    )
  );

create policy "Members can leave their own membership" on public.space_members
  for delete using (auth.uid() = user_id);

create policy "Shared content is readable by space members" on public.daily_checkins
  for select using (
    exists (
      select 1 from public.space_members sm
      where sm.space_id = public.daily_checkins.space_id and sm.user_id = auth.uid()
    )
  );

create policy "Users can create their own check-ins" on public.daily_checkins
  for insert with check (auth.uid() = user_id);

create policy "Members can read memories in their spaces" on public.memories
  for select using (
    exists (
      select 1 from public.space_members sm
      where sm.space_id = public.memories.space_id and sm.user_id = auth.uid()
    )
  );

create policy "Members can create memories in their spaces" on public.memories
  for insert with check (
    auth.uid() = user_id and exists (
      select 1 from public.space_members sm
      where sm.space_id = public.memories.space_id and sm.user_id = auth.uid()
    )
  );

create policy "Members can read open when letters in their spaces" on public.open_when_letters
  for select using (
    exists (
      select 1 from public.space_members sm
      where sm.space_id = public.open_when_letters.space_id and sm.user_id = auth.uid()
    )
  );

create policy "Users can create open when letters in their spaces" on public.open_when_letters
  for insert with check (
    auth.uid() = user_id and exists (
      select 1 from public.space_members sm
      where sm.space_id = public.open_when_letters.space_id and sm.user_id = auth.uid()
    )
  );

create policy "Space members can read shared dates" on public.important_dates
  for select using (
    exists (
      select 1 from public.space_members sm
      where sm.space_id = public.important_dates.space_id and sm.user_id = auth.uid()
    )
  );

create policy "Members can manage shared dates" on public.important_dates
  for all using (
    exists (
      select 1 from public.space_members sm
      where sm.space_id = public.important_dates.space_id and sm.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.space_members sm
      where sm.space_id = public.important_dates.space_id and sm.user_id = auth.uid()
    )
  );

create policy "Space members can read shared goals" on public.shared_goals
  for select using (
    exists (
      select 1 from public.space_members sm
      where sm.space_id = public.shared_goals.space_id and sm.user_id = auth.uid()
    )
  );

create policy "Members can manage shared goals" on public.shared_goals
  for all using (
    exists (
      select 1 from public.space_members sm
      where sm.space_id = public.shared_goals.space_id and sm.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.space_members sm
      where sm.space_id = public.shared_goals.space_id and sm.user_id = auth.uid()
    )
  );

create policy "Members can read games in their spaces" on public.games
  for select using (
    exists (
      select 1 from public.space_members sm
      where sm.space_id = public.games.space_id and sm.user_id = auth.uid()
    )
  );

create policy "Members can create games in their spaces" on public.games
  for insert with check (
    exists (
      select 1 from public.space_members sm
      where sm.space_id = public.games.space_id and sm.user_id = auth.uid()
    )
  );

create policy "Members can read game answers in their spaces" on public.game_answers
  for select using (
    exists (
      select 1 from public.space_members sm
      join public.games g on g.id = public.game_answers.game_id
      where sm.space_id = g.space_id and sm.user_id = auth.uid()
    )
  );

create policy "Users can add answers to games" on public.game_answers
  for insert with check (
    auth.uid() = user_id and exists (
      select 1 from public.space_members sm
      join public.games g on g.id = public.game_answers.game_id
      where sm.space_id = g.space_id and sm.user_id = auth.uid()
    )
  );

-- The two people in a space can read each other's profiles.
-- See supabase/partner_access.sql for an existing database.

create or replace function public.is_member_of(target_space uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.space_members
    where space_id = target_space
      and user_id = auth.uid()
  );
end;
$$;

create or replace function public.shares_space_with(target_user uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.space_members mine
    join public.space_members theirs
      on theirs.space_id = mine.space_id
    where mine.user_id = auth.uid()
      and theirs.user_id = target_user
  );
end;
$$;

revoke all on function public.is_member_of(uuid) from public;
revoke all on function public.shares_space_with(uuid) from public;
grant execute on function public.is_member_of(uuid) to anon, authenticated, service_role;
grant execute on function public.shares_space_with(uuid) to anon, authenticated, service_role;

create policy "Space members can view profiles in their space" on public.profiles
  for select using (public.shares_space_with(user_id));
