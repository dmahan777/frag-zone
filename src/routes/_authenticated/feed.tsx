import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { Heart, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/feed")({
  component: FeedPage,
});

type Clip = {
  id: string;
  user_id: string;
  video_url: string;
  caption: string | null;
  likes: number;
  created_at: string;
  profile?: {
    username: string | null;
    display_name: string | null;
    photo_url: string | null;
  } | null;
};

function FeedPage() {
  const navigate = useNavigate();
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("clips")
        .select("id,user_id,video_url,caption,likes,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      const ids = Array.from(new Set((data ?? []).map((c) => c.user_id)));
      const { data: profiles } = ids.length
        ? await supabase
            .from("profiles")
            .select("id,username,display_name,photo_url")
            .in("id", ids)
        : { data: [] as any[] };
      const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      setClips((data ?? []).map((c: any) => ({ ...c, profile: byId.get(c.user_id) ?? null })));
      setLoading(false);
    })();
  }, []);

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

      <div className="px-4 pt-4 space-y-4">
        {loading && <p className="text-center text-sm text-muted-foreground py-8">Loading…</p>}
        {!loading && clips.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-12">No clips yet.</p>
        )}
        {clips.map((c) => {
          const name = c.profile?.username ?? c.profile?.display_name ?? "operator";
          return (
            <div key={c.id} className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <Avatar name={name} url={c.profile?.photo_url ?? null} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">@{name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <video
                src={c.video_url}
                controls
                playsInline
                preload="metadata"
                className="w-full aspect-[9/16] bg-black object-cover"
              />
              {c.caption && <p className="px-4 py-3 text-sm">{c.caption}</p>}
              <div className="px-4 pb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Heart className="h-3.5 w-3.5" />
                {c.likes}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
