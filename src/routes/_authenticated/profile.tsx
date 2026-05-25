import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Avatar } from "@/components/Avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Settings, Share2, Calendar, Skull, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const share = async () => {
    const text = `Join me on Frag! Track our gel-ball game live → frag.app`;
    if (navigator.share) {
      try { await navigator.share({ title: "Frag", text, url: window.location.origin }); } catch {}
    } else {
      navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    }
  };

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be under 5MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ photo_url: pub.publicUrl })
        .eq("id", user.id);
      if (updErr) throw updErr;
      await refreshProfile();
      toast.success("Photo updated");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="px-5 pt-12">
      <div className="flex flex-col items-center text-center">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative group"
          disabled={uploading}
        >
          <Avatar name={profile?.username} url={profile?.photo_url} size={104} ring="primary" />
          <span className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary border-2 border-background flex items-center justify-center shadow-glow-primary group-active:scale-95 transition">
            {uploading ? (
              <Loader2 className="h-4 w-4 text-primary-foreground animate-spin" />
            ) : (
              <Camera className="h-4 w-4 text-primary-foreground" />
            )}
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPickPhoto}
        />
        <h1 className="mt-4 font-display text-3xl font-extrabold">@{profile?.username}</h1>
        {profile?.school && <p className="text-sm text-muted-foreground">{profile.school}</p>}
        <div className="mt-3"><StatusBadge status="active" /></div>
      </div>

      {/* Stats grid */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <StatCard icon={<Skull className="h-4 w-4 text-danger" />} label="Eliminations" value={profile?.stats.kills ?? 0} />
        <StatCard icon={<Calendar className="h-4 w-4 text-success" />} label="Days survived" value={profile?.stats.totalSurvivalDays ?? 0} />
      </div>

      <div className="mt-6 space-y-2">
        <button onClick={share} className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-3 active:scale-[0.99] transition">
          <Share2 className="h-5 w-5 text-primary" />
          <span className="font-semibold">Invite friends</span>
        </button>
        <button onClick={() => navigate({ to: "/account" })} className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-3 active:scale-[0.99] transition">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <span className="font-semibold">Settings</span>
        </button>
        <button onClick={async () => { await signOut(); navigate({ to: "/login" }); }} className="w-full bg-card border border-danger/30 rounded-2xl p-4 flex items-center gap-3 active:scale-[0.99] transition text-danger">
          <LogOut className="h-5 w-5" />
          <span className="font-semibold">Sign out</span>
        </button>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground">{icon}<span className="text-[10px] uppercase tracking-wider">{label}</span></div>
      <p className="mt-1 font-display font-extrabold text-2xl">{value}</p>
    </div>
  );
}
