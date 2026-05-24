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

function PlayersPage() {
  const [tab, setTab] = useState<"players" | "teams">("players");
  const [rows, setRows] = useState<Row[]>([]);
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
    return rows.filter((r) =>
      [r.profile?.username, r.profile?.display_name, r.team_id]
        .filter(Boolean)
        .some((s) => (s as string).toLowerCase().includes(needle)),
    );
  }, [rows, q]);

  const teams = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of filtered) {
      if (!r.team_id) continue;
      if (!map.has(r.team_id)) map.set(r.team_id, []);
      map.get(r.team_id)!.push(r);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  return (
    <div className="px-5 pt-12 pb-4">
      <h1 className="font-display text-3xl font-extrabold">Players</h1>
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
        <div className="mt-5 space-y-2">
          {filtered.length === 0 && <Empty text="No players yet." />}
          {filtered.map((r, i) => (
            <PlayerRow key={r.id} rank={i + 1} row={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-bold transition ${
        active ? "bg-gradient-to-r from-primary to-secondary text-primary-foreground" : "text-muted-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function PlayerRow({ row, rank, compact }: { row: Row; rank?: number; compact?: boolean }) {
  const name = row.profile?.username ?? row.profile?.display_name ?? "operator";
  return (
    <div className={`flex items-center gap-3 ${compact ? "px-4 py-3" : "bg-card border border-border rounded-2xl p-3"}`}>
      {rank !== undefined && (
        <div className="w-6 text-center font-display font-extrabold text-muted-foreground text-sm">{rank}</div>
      )}
      <Avatar name={name} url={row.profile?.photo_url ?? null} size={40} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">@{name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {row.profile?.school ?? "no school"} {row.team_id ? `· ${row.team_id}` : ""}
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
