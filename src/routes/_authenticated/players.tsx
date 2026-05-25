import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { Search, Crosshair } from "lucide-react";

export const Route = createFileRoute("/_authenticated/players")({
  component: PlayersPage,
});

type Row = {
  id: string;
  user_id: string;
  status: string;
  team_id: string | null;
  kills: number;
  profile: {
    username: string | null;
    display_name: string | null;
    photo_url: string | null;
    school: string | null;
  } | null;
};

type TeamLite = { id: string; name: string; color: string };

function PlayersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [teams, setTeams] = useState<Record<string, TeamLite>>({});
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: players } = await supabase
        .from("players")
        .select("id,user_id,status,team_id,kills")
        .order("kills", { ascending: false });

      const ids = Array.from(new Set((players ?? []).map((p) => p.user_id)));
      const { data: profiles } = ids.length
        ? await supabase
            .from("profiles")
            .select("id,username,display_name,photo_url,school")
            .in("id", ids)
        : { data: [] as any[] };

      const teamIds = Array.from(
        new Set((players ?? []).map((p) => p.team_id).filter(Boolean) as string[]),
      );
      const { data: teamRows } = teamIds.length
        ? await supabase.from("teams").select("id,name,color").in("id", teamIds)
        : { data: [] as any[] };
      const tmap: Record<string, TeamLite> = {};
      (teamRows ?? []).forEach((t: any) => { tmap[t.id] = t as TeamLite; });
      setTeams(tmap);

      const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      setRows(
        (players ?? []).map((p: any) => ({
          ...p,
          profile: byId.get(p.user_id) ?? null,
        })),
      );
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => {
      const teamName = r.team_id ? teams[r.team_id]?.name ?? "" : "";
      return [r.profile?.username, r.profile?.display_name, teamName]
        .filter(Boolean)
        .some((s) => (s as string).toLowerCase().includes(needle));
    });
  }, [rows, q, teams]);

  const groups = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of filtered) {
      const key = r.team_id?.trim() || "__none__";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(r);
    }
    return Array.from(m.entries()).sort((a, b) => {
      if (a[0] === "__none__") return 1;
      if (b[0] === "__none__") return -1;
      const an = teams[a[0]]?.name ?? "";
      const bn = teams[b[0]]?.name ?? "";
      return an.localeCompare(bn);
    });
  }, [filtered, teams]);

  return (
    <div className="px-5 pt-12 pb-4">
      <h1 className="font-display text-3xl font-extrabold flex items-center gap-2">
        Players
        <span className="text-base font-bold text-primary bg-primary/10 border border-primary/30 rounded-full px-2.5 py-0.5">
          {rows.filter((r) => r.status === "active").length}
        </span>
      </h1>
      <p className="text-sm text-muted-foreground mt-1">Everyone in the arena.</p>

      {/* Search */}
      <div className="relative mt-5">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search players or teams"
          className="w-full bg-card border border-border rounded-2xl pl-11 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition"
        />
      </div>

      {loading && <p className="mt-8 text-center text-sm text-muted-foreground">Loading…</p>}

      {!loading && (
        <div className="mt-6 space-y-8">
          {groups.length === 0 && <Empty text="No players yet." />}
          {groups.map(([teamKey, members]) => {
            const team = teamKey === "__none__" ? null : teams[teamKey];
            const label = team?.name ?? (teamKey === "__none__" ? "No Team" : "Team");
            const color = team?.color ?? null;
            return (
              <section key={teamKey}>
                <div className="mb-3">
                  <h2 className="font-display font-semibold text-4xl tracking-tight text-white">
                    {label}
                  </h2>
                </div>
                <div className="space-y-2">
                  {members.map((r, i) => (
                    <PlayerRow key={r.id} rank={i + 1} row={r} teamColor={color} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}


function PlayerRow({ row, rank, compact, teamColor }: { row: Row; rank?: number; compact?: boolean; teamColor?: string | null }) {
  const name = row.profile?.username ?? row.profile?.display_name ?? "operator";
  return (
    <div className={`flex items-center gap-3 ${compact ? "px-4 py-3" : "bg-card border border-border rounded-2xl p-3"}`}>
      {rank !== undefined && (
        <div className="w-6 text-center font-display font-extrabold text-muted-foreground text-sm">{rank}</div>
      )}
      <Avatar
        name={name}
        url={row.profile?.photo_url ?? null}
        size={40}
        ring="none"
        ringColor={teamColor ?? null}
      />
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {row.profile?.school ?? "no school"}
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-sm font-bold">
        <Crosshair className="h-3.5 w-3.5 text-primary" />
        {row.kills}
      </div>
      <StatusBadge status={row.status as any} />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-center text-sm text-muted-foreground py-12">{text}</p>;
}
