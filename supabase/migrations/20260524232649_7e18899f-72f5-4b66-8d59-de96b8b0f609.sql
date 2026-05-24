
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS max_teams integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS open_registration boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS players_per_team integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS elimination_approval boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS inherit_targets boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS full_team_elimination boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS random_purge boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS daily_purge_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS daily_purge_time time NULL;

ALTER TABLE public.games
  DROP COLUMN IF EXISTS map_center_lat,
  DROP COLUMN IF EXISTS map_center_lng,
  DROP COLUMN IF EXISTS map_radius_m;
