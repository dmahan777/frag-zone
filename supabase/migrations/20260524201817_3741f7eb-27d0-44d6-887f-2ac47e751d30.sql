CREATE TABLE public.player_locations (
  user_id UUID NOT NULL,
  game_id UUID NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_id)
);

ALTER TABLE public.player_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loc_select_same_game"
ON public.player_locations FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.players p WHERE p.game_id = player_locations.game_id AND p.user_id = auth.uid()));

CREATE POLICY "loc_insert_self"
ON public.player_locations FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "loc_update_self"
ON public.player_locations FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "loc_delete_self"
ON public.player_locations FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_player_locations_game ON public.player_locations(game_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.player_locations;
ALTER TABLE public.player_locations REPLICA IDENTITY FULL;