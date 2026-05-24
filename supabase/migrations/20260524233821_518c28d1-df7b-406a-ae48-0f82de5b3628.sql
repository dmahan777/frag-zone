
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS powerup_shield boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS powerup_radar_ping boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS powerup_double_points boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS powerup_revive_token boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS purge_length_hours integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS round_starts_at timestamptz NULL;
