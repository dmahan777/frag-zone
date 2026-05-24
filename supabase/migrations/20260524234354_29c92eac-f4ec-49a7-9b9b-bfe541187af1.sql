ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS powerup_map_spawn boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS powerup_spawn_radius_m integer NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS powerup_spawn_frequency text NOT NULL DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS powerup_spawn_count integer NOT NULL DEFAULT 3;