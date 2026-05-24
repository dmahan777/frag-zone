import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { Upload, Video, Loader2, Heart } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clips")({
  component: ClipsPage,
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

function ClipsPage() {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const load = async () => {
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
  };

  useEffect(() => { load(); }, []);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Clip must be under 50MB");
      return;
    }
    setPendingFile(file);
  };

  const doUpload = async () => {
    if (!pendingFile || !user) return;
    setUploading(true);
    try {
      const ext = pendingFile.name.split(".").pop() || "mp4";
      const path = `${user.id}/clip-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("clips")
        .upload(path, pendingFile, { contentType: pendingFile.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("clips").getPublicUrl(path);
      const { error: insErr } = await supabase.from("clips").insert({
        user_id: user.id,
        video_url: pub.publicUrl,
        caption: caption.trim() || null,
      });
      if (insErr) throw insErr;
      toast.success("Clip uploaded");
      setPendingFile(null);
      setCaption("");
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="px-5 pt-12 pb-6">
      <h1 className="font-display text-3xl font-extrabold">Clips</h1>
      <p className="text-sm text-muted-foreground mt-1">Frags caught on camera.</p>

      {/* Upload card */}
      <div className="mt-5 bg-card border border-border rounded-2xl p-4">
        {!pendingFile ? (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed border-border hover:border-primary/60 transition group"
          >
            <Upload className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="font-semibold text-sm">Upload a clip</span>
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Video className="h-4 w-4 text-primary" />
              <span className="truncate flex-1 font-medium">{pendingFile.name}</span>
              <button onClick={() => setPendingFile(null)} className="text-xs text-muted-foreground">Cancel</button>
            </div>
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption…"
              maxLength={140}
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition"
            />
            <button
              onClick={doUpload}
              disabled={uploading}
              className="w-full bg-gradient-to-r from-primary to-secondary text-primary-foreground font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Uploading…" : "Post clip"}
            </button>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={onPickFile}
        />
      </div>

      {/* Feed */}
      <div className="mt-6 space-y-4">
        {loading && <p className="text-center text-sm text-muted-foreground py-8">Loading…</p>}
        {!loading && clips.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-12">No clips yet. Be the first to drop one.</p>
        )}
        {clips.map((c) => (
          <ClipCard key={c.id} clip={c} />
        ))}
      </div>
    </div>
  );
}

function ClipCard({ clip }: { clip: Clip }) {
  const name = clip.profile?.username ?? clip.profile?.display_name ?? "operator";
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar name={name} url={clip.profile?.photo_url ?? null} size={36} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">@{name}</p>
          <p className="text-[11px] text-muted-foreground">
            {new Date(clip.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>
      <video
        src={clip.video_url}
        controls
        playsInline
        preload="metadata"
        className="w-full aspect-[9/16] bg-black object-cover"
      />
      {clip.caption && (
        <p className="px-4 py-3 text-sm">{clip.caption}</p>
      )}
      <div className="px-4 pb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Heart className="h-3.5 w-3.5" />
        {clip.likes}
      </div>
    </div>
  );
}
