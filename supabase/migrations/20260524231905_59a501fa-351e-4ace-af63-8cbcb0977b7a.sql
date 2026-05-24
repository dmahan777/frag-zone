
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS rules text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS purge_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS purge_interval_minutes integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS map_center_lat double precision,
  ADD COLUMN IF NOT EXISTS map_center_lng double precision,
  ADD COLUMN IF NOT EXISTS map_radius_m integer;

CREATE OR REPLACE FUNCTION public.delete_empty_teams()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_team uuid;
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    IF NEW.team_id IS NOT DISTINCT FROM OLD.team_id THEN
      RETURN NEW;
    END IF;
    old_team := OLD.team_id::uuid;
  ELSIF (TG_OP = 'DELETE') THEN
    old_team := OLD.team_id::uuid;
  END IF;

  IF old_team IS NOT NULL THEN
    DELETE FROM public.teams t
    WHERE t.id = old_team
      AND NOT EXISTS (
        SELECT 1 FROM public.players p WHERE p.team_id = old_team::text
      );
  END IF;

  IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_delete_empty_teams_upd ON public.players;
DROP TRIGGER IF EXISTS trg_delete_empty_teams_del ON public.players;

CREATE TRIGGER trg_delete_empty_teams_upd
AFTER UPDATE OF team_id ON public.players
FOR EACH ROW EXECUTE FUNCTION public.delete_empty_teams();

CREATE TRIGGER trg_delete_empty_teams_del
AFTER DELETE ON public.players
FOR EACH ROW EXECUTE FUNCTION public.delete_empty_teams();
