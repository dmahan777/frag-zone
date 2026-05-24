
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, name)
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY teams_select_auth ON public.teams
  FOR SELECT TO authenticated USING (true);

CREATE POLICY teams_insert_in_game ON public.teams
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.game_id = teams.game_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY teams_update_owner_or_host ON public.teams
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = created_by
    OR EXISTS (SELECT 1 FROM public.games g WHERE g.id = teams.game_id AND g.host_id = auth.uid())
  );

CREATE POLICY teams_delete_owner_or_host ON public.teams
  FOR DELETE TO authenticated
  USING (
    auth.uid() = created_by
    OR EXISTS (SELECT 1 FROM public.games g WHERE g.id = teams.game_id AND g.host_id = auth.uid())
  );

CREATE INDEX idx_teams_game ON public.teams(game_id);
