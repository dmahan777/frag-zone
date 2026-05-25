
-- Player points & powerup inventory
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS powerup_inventory jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS powerup_active jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Game-level points & powerup config
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS points_per_elimination integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS powerup_config jsonb NOT NULL DEFAULT '{
    "revive":      {"enabled": true,  "cost": 500, "scope": "personal"},
    "immunity":    {"enabled": true,  "cost": 400, "scope": "personal"},
    "ghostMode":   {"enabled": true,  "cost": 350, "scope": "personal"},
    "decoy":       {"enabled": true,  "cost": 300, "scope": "personal"},
    "roundPass":   {"enabled": true,  "cost": 450, "scope": "personal"},
    "bounty":      {"enabled": true,  "cost": 200, "scope": "personal"},
    "selfPurge":   {"enabled": true,  "cost": 600, "scope": "personal"},
    "uav":         {"enabled": true,  "cost": 500, "scope": "team"},
    "teamShield":  {"enabled": true,  "cost": 700, "scope": "team"}
  }'::jsonb;
