import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Crosshair } from "lucide-react";

export const Route = createFileRoute("/_authenticated/map")({
  component: MapRedirect,
});

function MapRedirect() {
  const { user } = useAuth();
  const [gameId, setGameId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("players")
        .select("game_id")
        .eq("user_id", user.id)
        .order("joined_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setGameId(data?.game_id ?? null);
    })();
  }, [user]);

  if (gameId === undefined) {
    return <div className="h-screen flex items-center justify-center text-muted-foreground text-sm">Loading map…</div>;
  }

  if (gameId) {
    return <Navigate to="/game/$gameId" params={{ gameId }} replace />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center pb-28">
      <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
        <Crosshair className="h-8 w-8 text-primary" />
      </div>
      <h2 className="mt-4 font-display text-2xl font-extrabold">No active game</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs">Join or create a game from the home screen to see the live map.</p>
      <Link to="/home" className="mt-6 px-6 py-3 rounded-2xl bg-gradient-to-r from-primary to-secondary text-primary-foreground font-display font-bold shadow-glow-primary">
        Go to lobby
      </Link>
    </div>
  );
}
