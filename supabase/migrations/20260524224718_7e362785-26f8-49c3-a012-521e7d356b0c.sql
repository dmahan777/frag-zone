ALTER TABLE public.player_locations
  ADD COLUMN IF NOT EXISTS speed double precision,
  ADD COLUMN IF NOT EXISTS battery double precision;