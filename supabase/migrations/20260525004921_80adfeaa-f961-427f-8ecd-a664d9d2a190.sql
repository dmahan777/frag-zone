ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS team_id text;
CREATE INDEX IF NOT EXISTS idx_messages_game_team ON public.messages(game_id, team_id, created_at);

-- Tighten insert policy so team chats are only writable by team members
DROP POLICY IF EXISTS messages_insert_self_in_game ON public.messages;
CREATE POLICY messages_insert_self_in_game ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.game_id = messages.game_id
        AND p.user_id = auth.uid()
        AND (messages.team_id IS NULL OR p.team_id = messages.team_id)
    )
  );

-- Tighten select policy so team chats are only readable by team members
DROP POLICY IF EXISTS messages_select_in_game ON public.messages;
CREATE POLICY messages_select_in_game ON public.messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.game_id = messages.game_id
        AND p.user_id = auth.uid()
        AND (messages.team_id IS NULL OR p.team_id = messages.team_id)
    )
  );