import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { ChevronLeft, Search, Users as UsersIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/players/$gameId")({
  component: PlayersScreen,
});

type PlayerRow = { id: string; user_id: string; status: string; target_id: string | null; kills: number; team_id: string | null };
type ProfileLite = { id: string; username: string | null; display_name: string | null; photo_url: string | null };
type Filter = "All" | "Active";

function PlayersScreen() {
  const { gameId } = Route.useParams();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [gameName, setGameName] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [q, setQ] = useState("");
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setMeId(u.user?.id ?? null);
      const { data: g } = await supabase.from("games").select("name").eq("id", gameId).maybeSingle();
      setGameName((g as { name: string } | null)?.name ?? "");
      const { data: ps } = await supabase.from("players").select("id, user_id, status, target_id, kills, team_id").eq("game_id", gameId);
      const arr = (ps as PlayerRow[]) ?? [];
      setPlayers(arr);
      if (arr.length) {
        const ids = Array.from(new Set(arr.map((p) => p.user_id)));
        const { data: profs } = await supabase.from("profiles").select("id, username, display_name, photo_url").in("id", ids);
        const map: Record<string, ProfileLite> = {};
        (profs as ProfileLite[] | null)?.forEach((p) => { map[p.id] = p; });
        setProfiles(map);
      }
    })();
  }, [gameId]);

  const me = players.find((p) => p.user_id === meId) ?? null;

  const filtered = useMemo(() => {
    let list = players;
    if (filter === "Active") list = list.filter((p) => p.status === "active");
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter((p) => {
        const pr = profiles[p.user_id];
        return (
          (pr?.username ?? "").toLowerCase().includes(s) ||
          (pr?.display_name ?? "").toLowerCase().includes(s) ||
          (p.team_id ?? "").toLowerCase().includes(s)
        );
      });
    }
    return list;
  }, [players, filter, q, me, profiles]);

  const grouped = useMemo(() => {
    const m = new Map<string, PlayerRow[]>();
    for (const p of filtered) {
      const key = p.team_id?.trim() || "No Team";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(p);
    }
    // Put "No Team" last
    return Array.from(m.entries()).sort((a, b) => {
      if (a[0] === "No Team") return 1;
      if (b[0] === "No Team") return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [filtered]);

  const counts = useMemo(() => ({
    All: players.length,
    Active: players.filter((p) => p.status === "active").length,
  }), [players]);

  const FILTERS: Filter[] = ["All", "Active"];

  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3">
        <button
          onClick={() => navigate({ to: "/game/$gameId", params: { gameId } })}
          className="h-10 w-10 rounded-full bg-surface border border-border flex items-center justify-center text-primary"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="px-4 py-2 rounded-full bg-surface border border-border font-semibold text-sm truncate max-w-[60%]">
          {gameName || "Game"}
        </div>
        <div className="h-10 w-10" />
      </div>

      {/* Search */}
      <div className="px-4 mt-3">
        <div className="flex items-center gap-2 bg-surface border border-border rounded-full px-3 py-2">
          <Search className="h-4 w-4 text-foreground/50" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by player or team"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-foreground/50"
          />
          <UsersIcon className="h-4 w-4 text-foreground/50" />
        </div>
      </div>

      {/* Filter chips */}
      <div className="px-4 mt-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
        {FILTERS.map((f) => {
          const active = f === filter;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold border transition ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-surface text-foreground/80 border-border"
              }`}
            >
              {f} {counts[f]}
            </button>
          );
        })}
      </div>

      {/* Groups */}
      <div className="px-4 mt-5 space-y-7">
        {grouped.length === 0 && (
          <div className="text-center text-sm text-foreground/60 mt-10">No players found</div>
        )}
        {grouped.map(([team, list]) => (
          <section key={team}>
            <h2 className="font-bold text-lg mb-3">{team}</h2>
            <div className="flex flex-wrap gap-x-5 gap-y-4">
              {list.map((p) => {
                const pr = profiles[p.user_id];
                const name = pr?.username || pr?.display_name || "Player";
                const eliminated = p.status !== "active";
                const ring = eliminated ? "danger" : "primary";
                return (
                  <div key={p.id} className="flex flex-col items-center w-16">
                    <div className="relative">
                      <Avatar name={name} url={pr?.photo_url} size={56} ring={ring} />
                      {eliminated && (
                        <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center border-2 border-background">
                          ×
                        </div>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-center truncate w-full">{name}</div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
