-- Storage buckets
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('clips', 'clips', true)
on conflict (id) do nothing;

-- Avatars policies (file path prefixed with user id: <uid>/filename)
create policy "Avatars are publicly viewable"
on storage.objects for select
using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can update their own avatar"
on storage.objects for update
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can delete their own avatar"
on storage.objects for delete
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Clips storage policies (file path prefixed with user id: <uid>/filename)
create policy "Clips are publicly viewable"
on storage.objects for select
using (bucket_id = 'clips');

create policy "Users can upload their own clips"
on storage.objects for insert
with check (
  bucket_id = 'clips'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can update their own clips"
on storage.objects for update
using (
  bucket_id = 'clips'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can delete their own clips"
on storage.objects for delete
using (
  bucket_id = 'clips'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Clips metadata table
create table public.clips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  game_id uuid references public.games(id) on delete set null,
  video_url text not null,
  thumbnail_url text,
  caption text,
  likes integer not null default 0,
  created_at timestamp with time zone not null default now()
);

alter table public.clips enable row level security;

create policy "clips_select_auth"
on public.clips for select
to authenticated
using (true);

create policy "clips_insert_self"
on public.clips for insert
to authenticated
with check (auth.uid() = user_id);

create policy "clips_update_self"
on public.clips for update
to authenticated
using (auth.uid() = user_id);

create policy "clips_delete_self"
on public.clips for delete
to authenticated
using (auth.uid() = user_id);

create index clips_game_id_idx on public.clips(game_id);
create index clips_user_id_idx on public.clips(user_id);
create index clips_created_at_idx on public.clips(created_at desc);