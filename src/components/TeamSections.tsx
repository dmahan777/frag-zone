import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { toast } from "sonner";

export type TeamRow = { id: string; name: string; color: string; created_by: string; max_members: number };
export type PlayerLite = { id: string; user_id: string; status: string; target_id: string | null; kills: number; team_id: string | null };
export type ProfileLite = { id: string; username: string | null; photo_url: string | null; school: string | null };

export function TeamCreator({ gameId, meId, myPlayerId, teams, playersPerTeam }: { gameId: string; meId: string | null; myPlayerId: string | null; myTeamId: string | null; teams: TeamRow[]; playersPerTeam: number }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [busy, setBusy] = useState(false);

  void teams;

  const create = async () => {
    if (!meId) { toast.error("Sign in to create a team"); return; }
    if (!name.trim()) { toast.error("Give your team a name"); return; }
    setBusy(true);

    // Ensure a player row exists for this user in this game (RLS on teams_insert_in_game requires it).
    let playerId = myPlayerId;
    if (!playerId) {
      const { data: existing } = await supabase
        .from("players")
        .select("id")
        .eq("game_id", gameId)
        .eq("user_id", meId)
        .maybeSingle();
      if (existing?.id) {
        playerId = existing.id as string;
      } else {
        const { data: inserted, error: pErr } = await supabase
          .from("players")
          .insert({ game_id: gameId, user_id: meId })
          .select("id")
          .single();
        if (pErr) { setBusy(false); toast.error(pErr.message); return; }
        playerId = (inserted as { id: string }).id;
      }
    }

    const { data, error } = await supabase.from("teams").insert({
      game_id: gameId, name: name.trim(), color, created_by: meId, max_members: maxMembers,
    }).select().single();
    if (error) { setBusy(false); toast.error(error.message); return; }
    const created = data as TeamRow;
    const { error: upErr } = await supabase.from("players").update({ team_id: created.id }).eq("id", playerId);
    setBusy(false);
    if (upErr) { toast.error(upErr.message); return; }
    setName("");
    toast.success(`Created team ${created.name}`);
  };


  return (
    <div className="bg-surface border border-border rounded-2xl p-4">
      <h3 className="font-display font-extrabold text-base mb-3">Create your team</h3>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Team name"
        maxLength={40}
        className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary"
      />

      <div className="mt-4 flex items-center gap-3">
        <label className="relative h-12 w-12 rounded-full overflow-hidden border-2 border-border shrink-0 cursor-pointer" style={{ background: color }}>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
        </label>
        <div className="flex-1">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Team color</p>
          <p className="text-xs text-foreground/70 mt-0.5">Tap the circle to pick any color</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Max members</p>
          <span className="text-sm font-bold tabular-nums">{maxMembers}</span>
        </div>
        <input
          type="range" min={2} max={20} step={1}
          value={maxMembers}
          onChange={(e) => setMaxMembers(parseInt(e.target.value))}
          className="w-full mt-1 accent-primary"
        />
      </div>

      <button
        disabled={busy || !name.trim()}
        onClick={create}
        className="mt-4 w-full bg-primary text-primary-foreground font-display font-bold py-2.5 rounded-xl disabled:opacity-50 active:scale-[0.98] transition"
      >
        {busy ? "Creating…" : "Create team"}
      </button>
    </div>
  );
}

export function MyTeamSection({ gameId, meId, myPlayerId, myTeamId, teams, players, profilesById }: { gameId: string; meId: string | null; myPlayerId: string | null; myTeamId: string | null; teams: TeamRow[]; players: PlayerLite[]; profilesById: Record<string, ProfileLite> }) {
  const [points, setPoints] = useState(0);
  const myTeam = useMemo(() => teams.find((t) => t.id === myTeamId) ?? null, [teams, myTeamId]);
  const members = useMemo(() => players.filter((p) => p.team_id === myTeamId), [players, myTeamId]);
  const totalKills = useMemo(() => members.reduce((s, p) => s + (p.kills ?? 0), 0), [members]);

  useEffect(() => {
    if (!myTeam || members.length === 0) { setPoints(0); return; }
    const ids = members.map((m) => m.user_id);
    supabase
      .from("eliminations")
      .select("points_awarded")
      .eq("game_id", gameId)
      .in("eliminator_id", ids)
      .then(({ data }) => {
        const sum = (data ?? []).reduce((s: number, r: any) => s + (r.points_awarded ?? 0), 0);
        setPoints(sum);
      });
  }, [myTeam, members, gameId]);

  const leave = async () => {
    if (!myPlayerId) return;
    const { error } = await supabase.from("players").update({ team_id: null }).eq("id", myPlayerId);
    if (error) toast.error(error.message); else toast.success("Left team");
  };

  const join = async (teamId: string) => {
    if (!myPlayerId) return;
    const team = teams.find((t) => t.id === teamId);
    const count = players.filter((p) => p.team_id === teamId).length;
    if (team && count >= team.max_members) { toast.error("Team is full"); return; }
    const { error } = await supabase.from("players").update({ team_id: teamId }).eq("id", myPlayerId);
    if (error) toast.error(error.message); else toast.success(`Joined ${team?.name ?? "team"}`);
  };

  if (!myTeam) {
    return (
      <div className="space-y-4">
        <TeamCreator gameId={gameId} meId={meId} myPlayerId={myPlayerId} myTeamId={myTeamId} teams={teams} />
        {teams.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2 px-1">Or join an existing team</p>
            <ul className="space-y-2">
              {teams.map((t) => {
                const count = players.filter((p) => p.team_id === t.id).length;
                const full = count >= t.max_members;
                return (
                  <li key={t.id} className="flex items-center gap-3 bg-surface border border-border rounded-xl p-3">
                    <span className="h-6 w-6 rounded-full shrink-0 border border-border" style={{ background: t.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{t.name}</p>
                      <p className="text-[11px] text-muted-foreground">{count} / {t.max_members} members</p>
                    </div>
                    <button onClick={() => join(t.id)} disabled={full} className="text-xs font-bold px-3 py-1.5 rounded-full bg-primary text-primary-foreground disabled:opacity-50">
                      {full ? "Full" : "Join"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-border rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-full border-2 border-border shrink-0" style={{ background: myTeam.color }} />
          <div className="flex-1 min-w-0">
            <p className="font-display font-extrabold text-lg truncate">{myTeam.name}</p>
            <p className="text-xs text-muted-foreground">{members.length} / {myTeam.max_members} members</p>
          </div>
          <button onClick={leave} className="text-xs font-bold px-3 py-1.5 rounded-full bg-muted text-foreground/80">Leave</button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-card border border-border px-3 py-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Team kills</p>
            <p className="text-xl font-display font-extrabold mt-0.5">{totalKills}</p>
          </div>
          <div className="rounded-xl bg-card border border-border px-3 py-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Team points</p>
            <p className="text-xl font-display font-extrabold mt-0.5">{points}</p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-display font-extrabold text-base mb-3">Members</h3>
        <div className="grid grid-cols-4 gap-3">
          {members.map((p) => {
            const prof = profilesById[p.user_id];
            return (
              <div key={p.id} className="flex flex-col items-center gap-1.5">
                <Avatar name={prof?.username} url={prof?.photo_url} size={64} ring={p.user_id === meId ? "primary" : "none"} />
                <span className="text-xs text-foreground/90 truncate max-w-full">{prof?.username ?? "player"}</span>
                <span className="text-[10px] text-muted-foreground">{p.kills} kills</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
