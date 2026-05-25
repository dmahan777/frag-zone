import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { MobileShell } from "@/components/MobileShell";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { toast } from "sonner";
import { requestLocationOnce } from "@/lib/location";
import { Camera, MapPin, Bell } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

const AVATAR_NAMES = ["Ghost", "Reaper", "Nova", "Viper", "Echo", "Blaze", "Frost", "Riot"];

function Onboarding() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarSeed, setAvatarSeed] = useState(AVATAR_NAMES[0]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [allowLocation, setAllowLocation] = useState(true);
  const [allowNotifications, setAllowNotifications] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
    if (!loading && profile?.onboarded) navigate({ to: "/menu" });
  }, [user, profile, loading, navigate]);

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (username.length < 3) return toast.error("Username must be 3+ characters");
    if (!allowLocation) return toast.error("Location sharing is required to play");
    setSaving(true);
    try {
      const loc = await requestLocationOnce();
      if (!loc) {
        toast.error("Please allow location access to continue");
        setSaving(false);
        return;
      }

      if (allowNotifications && typeof Notification !== "undefined" && Notification.permission === "default") {
        try { await Notification.requestPermission(); } catch { /* ignore */ }
      }

      let photo_url = `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(avatarSeed)}&backgroundColor=00E5FF,4D8FFF,FF5FA0`;

      if (photoFile) {
        const ext = photoFile.name.split(".").pop() || "jpg";
        const path = `${user.id}/avatar-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("avatars").upload(path, photoFile, { upsert: true, contentType: photoFile.type });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        photo_url = data.publicUrl;
      }

      const { error } = await supabase.from("profiles").update({
        username: username.trim(),
        display_name: username.trim(),
        bio: bio.trim() || null,
        photo_url,
        onboarded: true,
      }).eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success("You're in. Let's play.");
      navigate({ to: "/menu" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const displayPhoto = photoPreview || `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(avatarSeed)}&backgroundColor=00E5FF,4D8FFF,FF5FA0`;

  return (
    <MobileShell>
      <div className="min-h-screen px-6 pt-12 pb-10 bg-grid">
        <p className="text-xs uppercase tracking-widest text-primary">Step 1 of 1</p>
        <h1 className="text-3xl font-display font-bold mt-2">Set up your avatar</h1>
        <p className="text-sm text-muted-foreground mt-2">Pick a photo, callsign, and a quick bio.</p>

        <form onSubmit={save} className="mt-8 space-y-5">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Avatar name={avatarSeed} url={displayPhoto} size={112} ring="primary" />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-2 shadow-glow-primary active:scale-95 transition"
                aria-label="Upload photo"
              >
                <Camera size={16} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
            </div>
            {photoFile ? (
              <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null); }} className="text-xs text-muted-foreground underline">
                Remove photo & use avatar
              </button>
            ) : (
              <div className="grid grid-cols-4 gap-2 w-full">
                {AVATAR_NAMES.map((n) => (
                  <button
                    type="button"
                    key={n}
                    onClick={() => setAvatarSeed(n)}
                    className={`p-1.5 rounded-xl border transition ${avatarSeed === n ? "border-primary bg-primary/10" : "border-border bg-card"}`}
                  >
                    <img src={`https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(n)}&backgroundColor=00E5FF,4D8FFF,FF5FA0`} alt={n} className="w-full aspect-square rounded-lg" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Callsign / Username</label>
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. ghostfire"
              maxLength={20}
              className="mt-1 w-full bg-card border border-border rounded-2xl px-4 py-3.5 focus:outline-none focus:border-primary focus:shadow-glow-primary transition"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Description</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell others about yourself..."
              maxLength={160}
              rows={3}
              className="mt-1 w-full bg-card border border-border rounded-2xl px-4 py-3.5 focus:outline-none focus:border-primary focus:shadow-glow-primary transition resize-none"
            />
            <p className="text-[10px] text-muted-foreground mt-1 text-right">{bio.length}/160</p>
          </div>

          <PermissionToggle
            icon={<MapPin size={18} />}
            title="Share location"
            subtitle="Required to play — used while in a game"
            checked={allowLocation}
            onChange={setAllowLocation}
            required
          />
          <PermissionToggle
            icon={<Bell size={18} />}
            title="Push notifications"
            subtitle="Get alerts for eliminations & events"
            checked={allowNotifications}
            onChange={setAllowNotifications}
          />

          <button
            disabled={saving}
            className="w-full bg-gradient-to-r from-primary to-secondary text-primary-foreground font-display font-bold py-4 rounded-2xl shadow-glow-primary active:scale-[0.98] transition disabled:opacity-50"
          >
            {saving ? "..." : "Enter the Arena"}
          </button>
        </form>
      </div>
    </MobileShell>
  );
}

function PermissionToggle({
  icon, title, subtitle, checked, onChange, required,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  required?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition ${checked ? "border-primary bg-primary/5" : "border-border bg-card"}`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${checked ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold flex items-center gap-2">
          {title}
          {required && <span className="text-[9px] uppercase tracking-wider text-primary">Required</span>}
        </div>
        <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
      </div>
      <div className={`w-10 h-6 rounded-full p-0.5 transition ${checked ? "bg-primary" : "bg-muted"}`}>
        <div className={`w-5 h-5 rounded-full bg-background transition-transform ${checked ? "translate-x-4" : ""}`} />
      </div>
    </button>
  );
}
