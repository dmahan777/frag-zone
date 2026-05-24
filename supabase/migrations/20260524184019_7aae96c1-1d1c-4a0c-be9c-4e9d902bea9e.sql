
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  photo_url text,
  school text,
  phone text,
  stats jsonb not null default '{"kills":0,"gamesWon":0,"gamesPlayed":0,"totalSurvivalDays":0,"currentStreak":0}'::jsonb,
  badges text[] not null default '{}',
  is_premium boolean not null default false,
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

-- Games
create table public.games (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  host_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'solo' check (mode in ('solo','teams')),
  status text not null default 'lobby' check (status in ('lobby','active','ended')),
  current_round int not null default 0,
  total_rounds int not null default 1,
  revive_enabled boolean not null default false,
  safe_zones jsonb not null default '[]'::jsonb,
  round_ends_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.games(code);

-- Players
create table public.players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','eliminated','safe','revived')),
  target_id uuid references auth.users(id) on delete set null,
  kills int not null default 0,
  survival_days int not null default 0,
  team_id text,
  power_ups jsonb not null default '{"shield":false,"shieldExpiresAt":null,"doublePoints":false,"radarPing":false,"reviveToken":0}'::jsonb,
  rank int,
  joined_at timestamptz not null default now(),
  unique(game_id, user_id)
);
create index on public.players(game_id);
create index on public.players(user_id);

-- Eliminations
create table public.eliminations (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  eliminator_id uuid not null references auth.users(id) on delete cascade,
  eliminated_id uuid not null references auth.users(id) on delete cascade,
  proof_url text,
  status text not null default 'pending' check (status in ('pending','confirmed','disputed')),
  points_awarded int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.eliminations(game_id);

-- Events feed
create table public.events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  type text not null check (type in ('announcement','powerup','challenge','elimination','system')),
  message text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.events(game_id, created_at desc);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.players enable row level security;
alter table public.eliminations enable row level security;
alter table public.events enable row level security;

-- Profiles policies
create policy "profiles_select_all" on public.profiles for select to authenticated using (true);
create policy "profiles_insert_self" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_self" on public.profiles for update to authenticated using (auth.uid() = id);

-- Games policies
create policy "games_select_auth" on public.games for select to authenticated using (true);
create policy "games_insert_host" on public.games for insert to authenticated with check (auth.uid() = host_id);
create policy "games_update_host" on public.games for update to authenticated using (auth.uid() = host_id);
create policy "games_delete_host" on public.games for delete to authenticated using (auth.uid() = host_id);

-- Players policies
create policy "players_select_auth" on public.players for select to authenticated using (true);
create policy "players_insert_self" on public.players for insert to authenticated with check (auth.uid() = user_id);
create policy "players_update_self_or_host" on public.players for update to authenticated using (
  auth.uid() = user_id or exists (select 1 from public.games g where g.id = game_id and g.host_id = auth.uid())
);
create policy "players_delete_host" on public.players for delete to authenticated using (
  exists (select 1 from public.games g where g.id = game_id and g.host_id = auth.uid())
);

-- Eliminations policies
create policy "elims_select_auth" on public.eliminations for select to authenticated using (true);
create policy "elims_insert_eliminator" on public.eliminations for insert to authenticated with check (auth.uid() = eliminator_id);
create policy "elims_update_host" on public.eliminations for update to authenticated using (
  exists (select 1 from public.games g where g.id = game_id and g.host_id = auth.uid())
);

-- Events policies
create policy "events_select_auth" on public.events for select to authenticated using (true);
create policy "events_insert_in_game" on public.events for insert to authenticated with check (
  exists (select 1 from public.players p where p.game_id = events.game_id and p.user_id = auth.uid())
  or exists (select 1 from public.games g where g.id = events.game_id and g.host_id = auth.uid())
);

-- Realtime
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.eliminations;
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.games;

-- Trigger to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
