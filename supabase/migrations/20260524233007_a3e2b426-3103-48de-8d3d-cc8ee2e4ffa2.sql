
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS unlimited_rounds boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS round_length_days integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS purge_length_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS random_purge_frequency text NOT NULL DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS daily_purge_day_of_week smallint NULL;

ALTER TABLE public.games
  DROP COLUMN IF EXISTS purge_interval_minutes;
