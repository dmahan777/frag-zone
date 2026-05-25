import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { Plus, Heart, MessageCircle, Share2, Check, X, Clock, Send, MoreVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clips")({
  component: ClipsPage,
});

type Clip = {
  id: string;
  user_id: string;
  video_url: string;
  caption: string | null;
  description: string | null;
  likes: number;
  created_at: string;
  game_id: string | null;
  eliminated_id: string | null;
  kill_type: string;
  status: string;
  profile?: ProfileLite | null;
  game?: { id: string; name: string; host_id: string } | null;
};
type ProfileLite = { id: string; username: string | null; display_name: string | null; photo_url: string | null };

function ClipsPage() {
  const { user } = useAuth();
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("clips")
      .select("id,user_id,video_url,caption,description,likes,created_at,game_id,eliminated_id,kill_type,status")
      .order("created_at", { ascending: false })
      .limit(50);
    const arr = (data ?? []) as Clip[];

    const userIds = Array.from(new Set(arr.map((c) => c.user_id)));
    const gameIds = Array.from(new Set(arr.map((c) => c.game_id).filter(Boolean))) as string[];

    const [{ data: profiles }, { data: games }] = await Promise.all([
      userIds.length
        ? supabase.from("profiles").select("id,username,display_name,photo_url").in("id", userIds)
        : Promise.resolve({ data: [] as any[] } as any),
      gameIds.length
        ? supabase.from("games").select("id,name,host_id").in("id", gameIds)
        : Promise.resolve({ data: [] as any[] } as any),
    ]);
    const profileById = new Map<string, ProfileLite>((profiles ?? []).map((p: any) => [p.id, p as ProfileLite]));
    const gameById = new Map<string, { id: string; name: string; host_id: string }>((games ?? []).map((g: any) => [g.id, g]));

    setClips(arr.map((c) => ({
      ...c,
      profile: profileById.get(c.user_id) ?? null,
      game: c.game_id ? gameById.get(c.game_id) ?? null : null,
    })));

    if (user && arr.length) {
      const { data: likes } = await supabase
        .from("clip_likes")
        .select("clip_id")
        .eq("user_id", user.id)
        .in("clip_id", arr.map((c) => c.id));
      setMyLikes(new Set((likes ?? []).map((l: any) => l.clip_id)));
    }

    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  return (
    <div className="px-5 pt-12 pb-28">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Clips</h1>
          <p className="text-sm text-muted-foreground mt-1">Frags caught on camera.</p>
        </div>
        <Link
          to="/clips/new"
          className="inline-flex items-center gap-1.5 bg-gradient-to-r from-primary to-secondary text-primary-foreground font-bold px-4 py-2.5 rounded-full text-sm shadow-glow-primary"
        >
          <Plus className="h-4 w-4" /> New clip
        </Link>
      </div>

      <div className="mt-6 space-y-4">
        {loading && <p className="text-center text-sm text-muted-foreground py-8">Loading…</p>}
        {!loading && clips.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-12">No clips yet. Be the first to drop one.</p>
        )}
        {clips.map((c) => (
          <ClipCard
            key={c.id}
            clip={c}
            meId={user?.id ?? null}
            liked={myLikes.has(c.id)}
            onLikeToggle={async () => {
              if (!user) return;
              const isLiked = myLikes.has(c.id);
              // optimistic
              const nextLikes = new Set(myLikes);
              if (isLiked) nextLikes.delete(c.id); else nextLikes.add(c.id);
              setMyLikes(nextLikes);
              setClips((cs) => cs.map((x) => x.id === c.id ? { ...x, likes: Math.max(0, x.likes + (isLiked ? -1 : 1)) } : x));
              if (isLiked) {
                await supabase.from("clip_likes").delete().eq("clip_id", c.id).eq("user_id", user.id);
                await supabase.from("clips").update({ likes: Math.max(0, c.likes - 1) } as never).eq("id", c.id);
              } else {
                const { error } = await supabase.from("clip_likes").insert({ clip_id: c.id, user_id: user.id });
                if (!error) await supabase.from("clips").update({ likes: c.likes + 1 } as never).eq("id", c.id);
              }
            }}
            onReview={async (status) => {
              const { error } = await supabase
                .from("clips")
                .update({ status, reviewed_by: user?.id, reviewed_at: new Date().toISOString() } as never)
                .eq("id", c.id);
              if (error) { toast.error(error.message); return; }
              toast.success(`Clip ${status}`);
              setClips((cs) => cs.map((x) => x.id === c.id ? { ...x, status } : x));
            }}
            onDelete={async () => {
              if (!confirm("Delete this clip? This cannot be undone.")) return;
              const { error } = await supabase.from("clips").delete().eq("id", c.id);
              if (error) { toast.error(error.message); return; }
              toast.success("Clip deleted");
              setClips((cs) => cs.filter((x) => x.id !== c.id));
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ClipCard({ clip, meId, liked, onLikeToggle, onReview, onDelete }: {
  clip: Clip;
  meId: string | null;
  liked: boolean;
  onLikeToggle: () => void;
  onReview: (status: "approved" | "rejected") => void;
  onDelete: () => void;
}) {
  const name = clip.profile?.username ?? clip.profile?.display_name ?? "operator";
  const isHost = !!clip.game && meId === clip.game.host_id;
  const isMine = meId === clip.user_id;
  const canDelete = isMine || isHost;
  const [showComments, setShowComments] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const share = async () => {
    const url = clip.video_url;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Clip", text: clip.description ?? clip.caption ?? "", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch { /* user cancelled */ }
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar name={name} url={clip.profile?.photo_url ?? null} size={36} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">@{name}</p>
          <p className="text-[11px] text-muted-foreground">
            {new Date(clip.created_at).toLocaleDateString()}
            {clip.game ? <> · {clip.game.name}</> : null}
            {clip.kill_type ? <> · <span className="capitalize">{clip.kill_type}</span></> : null}
          </p>
        </div>
        <StatusBadge status={clip.status} />
      </div>

      <video
        src={clip.video_url}
        controls
        playsInline
        preload="metadata"
        className="w-full aspect-[9/16] bg-black object-cover"
      />

      {(clip.description || clip.caption) && (
        <p className="px-4 py-3 text-sm">{clip.description ?? clip.caption}</p>
      )}

      <div className="px-3 pb-2 pt-1 flex items-center gap-1">
        <button
          onClick={onLikeToggle}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold ${liked ? "text-danger" : "text-foreground/80"}`}
        >
          <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
          {clip.likes}
        </button>
        <button
          onClick={() => setShowComments((s) => !s)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold text-foreground/80"
        >
          <MessageCircle className="h-4 w-4" />
          Comment
        </button>
        <button
          onClick={share}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold text-foreground/80"
        >
          <Share2 className="h-4 w-4" />
          Share
        </button>
      </div>

      {isHost && clip.status === "pending" && (
        <div className="px-4 pb-3 flex gap-2">
          <button
            onClick={() => onReview("approved")}
            className="flex-1 flex items-center justify-center gap-1.5 bg-success/15 text-success border border-success/40 rounded-xl py-2 text-sm font-bold"
          >
            <Check className="h-4 w-4" /> Approve
          </button>
          <button
            onClick={() => onReview("rejected")}
            className="flex-1 flex items-center justify-center gap-1.5 bg-danger/10 text-danger border border-danger/40 rounded-xl py-2 text-sm font-bold"
          >
            <X className="h-4 w-4" /> Reject
          </button>
        </div>
      )}

      {isMine && clip.status === "pending" && !isHost && (
        <p className="px-4 pb-3 text-[11px] text-muted-foreground">Only you and the host can see this until it's approved.</p>
      )}

      {showComments && <Comments clipId={clip.id} meId={meId} />}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return null;
  if (status === "rejected") {
    return <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-danger/15 text-danger flex items-center gap-1"><X className="h-3 w-3" />Rejected</span>;
  }
  return <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 flex items-center gap-1"><Clock className="h-3 w-3" />Pending</span>;
}

type CommentRow = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  profile?: ProfileLite | null;
};

function Comments({ clipId, meId }: { clipId: string; meId: string | null }) {
  const [items, setItems] = useState<CommentRow[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("clip_comments")
      .select("id,user_id,body,created_at")
      .eq("clip_id", clipId)
      .order("created_at", { ascending: true });
    const arr = (data ?? []) as CommentRow[];
    const ids = Array.from(new Set(arr.map((c) => c.user_id)));
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("id,username,display_name,photo_url").in("id", ids)
      : { data: [] as any[] } as any;
    const map = new Map<string, ProfileLite>((profs ?? []).map((p: any) => [p.id, p as ProfileLite]));
    setItems(arr.map((c) => ({ ...c, profile: map.get(c.user_id) ?? null })));
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [clipId]);

  const post = async () => {
    if (!meId || !text.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("clip_comments").insert({ clip_id: clipId, user_id: meId, body: text.trim() });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setText("");
    await load();
  };

  return (
    <div className="border-t border-border px-4 py-3 space-y-3">
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {items.length === 0 && <p className="text-xs text-muted-foreground">No comments yet.</p>}
        {items.map((c) => {
          const name = c.profile?.username || c.profile?.display_name || "user";
          return (
            <div key={c.id} className="flex gap-2">
              <Avatar name={name} url={c.profile?.photo_url ?? null} size={28} />
              <div className="flex-1 min-w-0">
                <p className="text-xs"><span className="font-bold">@{name}</span> <span className="text-foreground/85">{c.body}</span></p>
                <p className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString()}</p>
              </div>
            </div>
          );
        })}
      </div>
      {meId && (
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); post(); } }}
            placeholder="Add a comment…"
            maxLength={300}
            className="flex-1 bg-background border border-border rounded-full px-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
          <button
            onClick={post}
            disabled={busy || !text.trim()}
            className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
