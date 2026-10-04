-- Photo uploads for avatars and memories.
-- Run this once in the Supabase SQL editor, after partner_access.sql
-- if that file has not been run yet.
-- Buckets are public-read so saved image URLs keep working.
-- Only a signed-in member can upload.

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

revoke all on function public.is_member_of(uuid) from public;
grant execute on function public.is_member_of(uuid) to anon, authenticated, service_role;

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('memories', 'memories', true)
on conflict (id) do update set public = true;

drop policy if exists "Users upload their own avatar" on storage.objects;
create policy "Users upload their own avatar"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users update their own avatar" on storage.objects;
create policy "Users update their own avatar"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Members upload memory photos" on storage.objects;
create policy "Members upload memory photos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'memories'
    and public.is_member_of(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "Anyone can view sayen photos" on storage.objects;
create policy "Anyone can view sayen photos"
  on storage.objects
  for select
  to public
  using (bucket_id in ('avatars', 'memories'));
