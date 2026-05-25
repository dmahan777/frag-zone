import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { Heart, ChevronLeft, Skull, Zap, Flag, Bell, Play } from "lucide-react";

export const Route = createFileRoute("/_authenticated/feed")({
  component: FeedPage,
});

type ProfileLite = { id: string; username: string | null; display_name: string | null; photo_url: string | null };

type ClipItem = {
  kind: "clip";
  id: string;
  created_at: string;
  user_id: string;
  video_url: string;
  caption: string | null;
  likes: number;
  profile: ProfileLite | null;
};

type ElimItem = {
  kind: "elim";
  id: string;
  created_at: string;
  eliminator_id: string;
  eliminated_id: string;
  proof_url: string | null;
  eliminator: ProfileLite | null;
  eliminated: ProfileLite | null;
};

type EventItem = {
  kind: "event";
  id: string;
  created_at: string;
  type: string;
  message: string;
};

type Item = ClipItem | ElimItem | EventItem;

function FeedPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [gameId, setGameId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);

      // Active game (most recent membership)
      const { data: p } = await supabase
        .from("players")
        .select("game_id")
        .eq("user_id", user.id)
        .order("joined_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const gid = (p as { game_id: string } | null)?.game_id ?? null;
      setGameId(gid);

      const clipsQ = supabase
        .from("clips")
        .select("id,user_id,video_url,caption,likes,created_at,game_id,status")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(40);

      const elimsQ = gid
        ? supabase.from("eliminations").select("id,eliminator_id,eliminated_id,proof_url,created_at,status").eq("game_id", gid).eq("status", "approved").order("created_at", { ascending: false }).limit(40)
        : Promise.resolve({ data: [] as never[] });

      const eventsQ = gid
        ? supabase.from("events").select("id,type,message,created_at").eq("game_id", gid).order("created_at", { ascending: false }).limit(40)
        : Promise.resolve({ data: [] as never[] });

      const [{ data: clips }, { data: elims }, { data: events }] = await Promise.all([clipsQ, elimsQ, eventsQ]);

      // Resolve profile lookups
      const ids = new Set<string>();
      (clips ?? []).forEach((c: { user_id: string }) => ids.add(c.user_id));
      (elims ?? []).forEach((e: { eliminator_id: string; eliminated_id: string }) => { ids.add(e.eliminator_id); ids.add(e.eliminated_id); });
      let byId = new Map<string, ProfileLite>();
      if (ids.size) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,username,display_name,photo_url")
          .in("id", Array.from(ids));
        byId = new Map((profs ?? []).map((pp: ProfileLite) => [pp.id, pp]));
      }

      const merged: Item[] = [
        ...(clips ?? []).map((c): ClipItem => ({
          kind: "clip",
          id: c.id,
          created_at: c.created_at,
          user_id: c.user_id,
          video_url: c.video_url,
          caption: c.caption,
          likes: c.likes,
          profile: byId.get(c.user_id) ?? null,
        })),
        ...(elims ?? []).map((e): ElimItem => ({
          kind: "elim",
          id: e.id,
          created_at: e.created_at,
          eliminator_id: e.eliminator_id,
          eliminated_id: e.eliminated_id,
          proof_url: e.proof_url,
          eliminator: byId.get(e.eliminator_id) ?? null,
          eliminated: byId.get(e.eliminated_id) ?? null,
        })),
        ...(events ?? []).map((ev): EventItem => ({
          kind: "event",
          id: ev.id,
          created_at: ev.created_at,
          type: ev.type,
          message: ev.message,
        })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setItems(merged);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/home" })}
          className="h-9 w-9 rounded-full bg-muted flex items-center justify-center active:scale-95 transition"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-xl font-extrabold">Activity</h1>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {loading && <p className="text-center text-sm text-muted-foreground py-8">Loading…</p>}
        {!loading && items.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-12">
            {gameId ? "Nothing happening yet — make some noise." : "Join a game to see activity."}
          </p>
        )}
        {items.map((it) => {
          if (it.kind === "clip") return <ClipCard key={`c-${it.id}`} item={it} />;
          if (it.kind === "elim") return <ElimCard key={`e-${it.id}`} item={it} />;
          return <EventCard key={`v-${it.id}`} item={it} />;
        })}
      </div>
    </div>
  );
}

function ClipCard({ item: c }: { item: ClipItem }) {
  const name = c.profile?.username ?? c.profile?.display_name ?? "operator";
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar name={name} url={c.profile?.photo_url ?? null} size={36} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{name}</p>
          <p className="text-[11px] text-muted-foreground">{new Date(c.created_at).toLocaleString()}</p>
        </div>
      </div>
      <video src={c.video_url} controls playsInline preload="metadata" className="w-full aspect-[9/16] bg-black object-cover" />
      {c.caption && <p className="px-4 py-3 text-sm">{c.caption}</p>}
      <div className="px-4 pb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Heart className="h-3.5 w-3.5" />
        {c.likes}
      </div>
    </div>
  );
}

function ElimCard({ item: e }: { item: ElimItem }) {
  const eliminator = e.eliminator?.username ?? e.eliminator?.display_name ?? "operator";
  const eliminated = e.eliminated?.username ?? e.eliminated?.display_name ?? "operator";
  const isVideo = e.proof_url && /\.(mp4|mov|webm|m4v)(\?|$)/i.test(e.proof_url);
  return (
    <div className="bg-card border border-danger/30 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="h-9 w-9 rounded-full bg-danger/15 text-danger flex items-center justify-center shrink-0">
          <Skull className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm">
            <span className="font-bold">{eliminator}</span>
            <span className="text-muted-foreground"> eliminated </span>
            <span className="font-bold">{eliminated}</span>
          </p>
          <p className="text-[11px] text-muted-foreground">{new Date(e.created_at).toLocaleString()}</p>
        </div>
      </div>
      {e.proof_url && (
        isVideo ? (
          <video src={e.proof_url} controls playsInline preload="metadata" className="w-full aspect-video bg-black object-cover" />
        ) : (
          <img src={e.proof_url} alt="Elimination proof" className="w-full max-h-[480px] object-cover" />
        )
      )}
    </div>
  );
}

function EventCard({ item: ev }: { item: EventItem }) {
  const Icon =
    /purge/i.test(ev.message) ? Skull :
    /powerup|spawn/i.test(ev.message) ? Zap :
    /round/i.test(ev.message) ? Play :
    /end|over/i.test(ev.message) ? Flag :
    Bell;
  return (
    <div className="bg-card border border-border rounded-2xl px-4 py-3 flex items-center gap-3">
      <div className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">{ev.message}</p>
        <p className="text-[11px] text-muted-foreground">{new Date(ev.created_at).toLocaleString()}</p>
      </div>
    </div>
  );
}
