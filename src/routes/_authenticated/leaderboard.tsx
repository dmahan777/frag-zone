import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { Flame, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  component: LeaderboardPage,
});

type Row = { user_id: string; username: string | null; photo_url: string | null; kills: number; status: string };

function LeaderboardPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [gameId, setGameId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const { data: p } = await supabase.from("players").select("game_id").eq("user_id", user.id).order("joined_at", { ascending: false }).limit(1).maybeSingle();
    if (!p) return;
    setGameId(p.game_id);
    const { data } = await supabase
      .from("players").select("user_id, kills, status, profiles(username, photo_url)")
      .eq("game_id", p.game_id).order("kills", { ascending: false });
    setRows((data ?? []).map((d: any) => ({
      user_id: d.user_id, kills: d.kills, status: d.status,
      username: d.profiles?.username, photo_url: d.profiles?.photo_url,
    })));
  };
  useEffect(() => { load(); }, [user]);
  useEffect(() => {
    if (!gameId) return;
    const ch = supabase.channel(`lb-${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `game_id=eq.${gameId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [gameId]);

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <div className="px-5 pt-12">
      <h1 className="font-display text-3xl font-extrabold">Leaderboard</h1>
      <p className="text-sm text-muted-foreground mt-1">Top operators</p>

      {rows.length === 0 ? (
        <div className="mt-12 text-center text-muted-foreground">
          <Trophy className="h-10 w-10 mx-auto opacity-50" />
          <p className="mt-3 text-sm">No players yet. Join or host a game.</p>
        </div>
      ) : (
        <>
          {/* Podium */}
          <div className="mt-8 flex items-end justify-center gap-2 h-44">
            {[1, 0, 2].map((idx) => {
              const p = podium[idx];
              if (!p) return <div key={idx} className="w-20" />;
              const heights = ["h-32", "h-40", "h-24"];
              const colors = ["from-secondary/40 to-secondary/10", "from-primary/40 to-primary/10", "from-danger/40 to-danger/10"];
              const medals = ["🥈", "🥇", "🥉"];
              return (
                <div key={p.user_id} className="flex flex-col items-center w-24">
                  <Avatar name={p.username} url={p.photo_url} size={48} ring={idx === 0 ? "primary" : "none"} />
                  <p className="mt-1 text-xs font-bold truncate w-full text-center">@{p.username}</p>
                  <div className={`mt-1 w-full ${heights[idx]} bg-gradient-to-t ${colors[idx]} border border-border rounded-t-2xl flex flex-col items-center justify-center`}>
                    <span className="text-2xl">{medals[idx]}</span>
                    <p className="font-display font-extrabold text-lg">{p.kills}</p>
                    <p className="text-[10px] uppercase text-muted-foreground">kills</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rest */}
          <div className="mt-6 space-y-2">
            {rest.map((p, i) => {
              const isMe = p.user_id === user?.id;
              const isOut = p.status === "eliminated";
              return (
                <div key={p.user_id} className={`flex items-center gap-3 rounded-2xl p-3 border ${isMe ? "bg-primary/10 border-primary" : "bg-card border-border"}`}>
                  <span className="font-display font-bold text-muted-foreground w-6 text-center">{i + 4}</span>
                  <Avatar name={p.username} url={p.photo_url} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold truncate ${isOut ? "line-through text-muted-foreground" : ""}`}>@{p.username} {isMe && <span className="text-primary text-xs">(You)</span>}</p>
                    {isOut && <span className="text-[10px] uppercase text-danger font-bold">Out</span>}
                  </div>
                  <div className="flex items-center gap-1 text-sm">
                    <Flame className="h-4 w-4 text-danger" />
                    <span className="font-display font-bold">{p.kills}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
