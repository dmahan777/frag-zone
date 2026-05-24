CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL,
  user_id UUID NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_game_created ON public.messages(game_id, created_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select_in_game"
ON public.messages FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.players p WHERE p.game_id = messages.game_id AND p.user_id = auth.uid()));

CREATE POLICY "messages_insert_self_in_game"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.players p WHERE p.game_id = messages.game_id AND p.user_id = auth.uid())
);

CREATE POLICY "messages_delete_self"
ON public.messages FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;