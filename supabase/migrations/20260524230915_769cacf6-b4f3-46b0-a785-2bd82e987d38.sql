
ALTER TABLE public.teams ADD COLUMN max_members integer NOT NULL DEFAULT 4 CHECK (max_members BETWEEN 1 AND 50);
CREATE UNIQUE INDEX teams_one_per_creator_per_game ON public.teams(game_id, created_by);
