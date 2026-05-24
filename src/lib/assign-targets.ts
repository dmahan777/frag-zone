import { supabase } from "@/integrations/supabase/client";

// Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Assign each active player a target in a circular chain.
 * Player A -> B -> C -> ... -> A
 */
export async function assignTargetsForGame(gameId: string): Promise<number> {
  const { data: players, error } = await supabase
    .from("players")
    .select("id, user_id")
    .eq("game_id", gameId)
    .eq("status", "active");
  if (error) throw error;
  if (!players || players.length < 2) {
    throw new Error("Need at least 2 active players to assign targets");
  }

  const shuffled = shuffle(players);
  const updates = shuffled.map((p, idx) => {
    const target = shuffled[(idx + 1) % shuffled.length];
    return supabase.from("players").update({ target_id: target.user_id }).eq("id", p.id);
  });
  const results = await Promise.all(updates);
  for (const r of results) if (r.error) throw r.error;
  return shuffled.length;
}
