
-- Add columns to clips
ALTER TABLE public.clips
  ADD COLUMN IF NOT EXISTS game_id uuid,
  ADD COLUMN IF NOT EXISTS eliminated_id uuid,
  ADD COLUMN IF NOT EXISTS kill_type text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- Tighten select policy: approved OR owner OR host of game
DROP POLICY IF EXISTS clips_select_auth ON public.clips;
CREATE POLICY clips_select_visible ON public.clips
  FOR SELECT TO authenticated
  USING (
    status = 'approved'
    OR auth.uid() = user_id
    OR (game_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.games g WHERE g.id = clips.game_id AND g.host_id = auth.uid()
    ))
  );

-- Allow host of the game to update clip status (review)
DROP POLICY IF EXISTS clips_update_host ON public.clips;
CREATE POLICY clips_update_host ON public.clips
  FOR UPDATE TO authenticated
  USING (
    game_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.games g WHERE g.id = clips.game_id AND g.host_id = auth.uid()
    )
  );

-- Comments
CREATE TABLE IF NOT EXISTS public.clip_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id uuid NOT NULL REFERENCES public.clips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clip_comments_clip_idx ON public.clip_comments(clip_id);
ALTER TABLE public.clip_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY clip_comments_select_auth ON public.clip_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY clip_comments_insert_self ON public.clip_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY clip_comments_delete_self ON public.clip_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Likes
CREATE TABLE IF NOT EXISTS public.clip_likes (
  clip_id uuid NOT NULL REFERENCES public.clips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clip_id, user_id)
);
ALTER TABLE public.clip_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY clip_likes_select_auth ON public.clip_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY clip_likes_insert_self ON public.clip_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY clip_likes_delete_self ON public.clip_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);
