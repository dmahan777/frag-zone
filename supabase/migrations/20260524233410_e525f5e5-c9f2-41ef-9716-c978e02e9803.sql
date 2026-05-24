
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS random_purge_length_minutes integer NOT NULL DEFAULT 30;
