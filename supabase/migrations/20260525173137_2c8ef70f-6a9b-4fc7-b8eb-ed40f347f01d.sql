
-- 1) Move phone to private table
CREATE TABLE IF NOT EXISTS public.profiles_private (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.profiles_private (id, phone)
  SELECT id, phone FROM public.profiles WHERE phone IS NOT NULL
  ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone;
ALTER TABLE public.profiles_private ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pp_select_self ON public.profiles_private;
DROP POLICY IF EXISTS pp_insert_self ON public.profiles_private;
DROP POLICY IF EXISTS pp_update_self ON public.profiles_private;
CREATE POLICY pp_select_self ON public.profiles_private FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY pp_insert_self ON public.profiles_private FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY pp_update_self ON public.profiles_private FOR UPDATE TO authenticated USING (auth.uid() = id);

-- 2) Players SELECT: same game or host only
DROP POLICY IF EXISTS players_select_auth ON public.players;
CREATE POLICY players_select_same_game ON public.players FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.players p2 WHERE p2.game_id = players.game_id AND p2.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.games g WHERE g.id = players.game_id AND g.host_id = auth.uid())
);

-- 3) Eliminations SELECT: participants or host
DROP POLICY IF EXISTS elims_select_auth ON public.eliminations;
CREATE POLICY elims_select_in_game ON public.eliminations FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.players p WHERE p.game_id = eliminations.game_id AND p.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.games g WHERE g.id = eliminations.game_id AND g.host_id = auth.uid())
);

-- 4) Events SELECT: participants or host
DROP POLICY IF EXISTS events_select_auth ON public.events;
CREATE POLICY events_select_in_game ON public.events FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.players p WHERE p.game_id = events.game_id AND p.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.games g WHERE g.id = events.game_id AND g.host_id = auth.uid())
);

-- 5) Player locations: hide eliminated + ghost-mode players (host sees all, self sees self)
DROP POLICY IF EXISTS loc_select_same_game ON public.player_locations;
CREATE POLICY loc_select_visible ON public.player_locations FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.games g WHERE g.id = player_locations.game_id AND g.host_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.players viewer
    JOIN public.players target
      ON target.game_id = viewer.game_id AND target.user_id = player_locations.user_id
    WHERE viewer.game_id = player_locations.game_id
      AND viewer.user_id = auth.uid()
      AND target.status = 'active'
      AND COALESCE((target.powerup_active->'ghostMode'->>'active')::boolean, false) = false
  )
);

-- 6) Storage: restrict listing to owners (public URLs unaffected)
DROP POLICY IF EXISTS "Avatars are publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "Clips are publicly viewable" ON storage.objects;
CREATE POLICY "Avatars listable by owner" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "Clips listable by owner" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'clips' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- 7) Realtime: require authentication to subscribe to any topic
DROP POLICY IF EXISTS realtime_authenticated_only ON realtime.messages;
CREATE POLICY realtime_authenticated_only ON realtime.messages FOR SELECT TO authenticated
USING (auth.role() = 'authenticated');
