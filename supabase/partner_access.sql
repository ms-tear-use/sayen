-- Re-run this whole file in the Supabase SQL editor.
-- It lets the two people in a space read each other's profiles
-- without locking them out of their own space.

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

grant select, insert, update, delete on table
  public.profiles,
  public.spaces,
  public.space_members,
  public.daily_checkins,
  public.memories,
  public.open_when_letters,
  public.important_dates,
  public.shared_goals,
  public.games,
  public.game_answers
to authenticated;

drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner"
  on public.profiles
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Profiles can be inserted by user" on public.profiles;
create policy "Profiles can be inserted by user"
  on public.profiles
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Profiles can be updated by owner" on public.profiles;
create policy "Profiles can be updated by owner"
  on public.profiles
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Space members can view profiles in their space" on public.profiles;
create policy "Space members can view profiles in their space"
  on public.profiles
  for select
  to authenticated
  using (public.shares_space_with(user_id));

drop policy if exists "Members can read memberships for their spaces" on public.space_members;
drop policy if exists "Members read own membership" on public.space_members;
drop policy if exists "Members read co-members" on public.space_members;

create policy "Members read own membership"
  on public.space_members
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Members read co-members"
  on public.space_members
  for select
  to authenticated
  using (public.is_member_of(space_id));

drop policy if exists "Spaces visible to members" on public.spaces;
create policy "Spaces visible to members"
  on public.spaces
  for select
  to authenticated
  using (public.is_member_of(id));

drop policy if exists "Your spaces can be updated by members" on public.spaces;
create policy "Your spaces can be updated by members"
  on public.spaces
  for update
  to authenticated
  using (public.is_member_of(id))
  with check (public.is_member_of(id));
