import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, Loader2, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { deleteMyAccount } from "@/lib/account.functions";

export const Route = createFileRoute("/_authenticated/account")({
  component: AccountPage,
});

function AccountPage() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const callDelete = useServerFn(deleteMyAccount);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username ?? "");
    setDisplayName(profile.display_name ?? "");
    setBio((profile as { bio?: string | null }).bio ?? "");
  }, [profile]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        username: username.trim() || null,
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await refreshProfile();
    toast.success("Settings saved");
  };

  const remove = async () => {
    if (!confirm("Delete your account? This permanently removes your profile, players, and clips. This cannot be undone.")) return;
    setDeleting(true);
    try {
      await callDelete();
      await signOut();
      toast.success("Account deleted");
      navigate({ to: "/login" });
    } catch (e) {
      setDeleting(false);
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="px-5 pt-12 pb-28 max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate({ to: "/profile" })}
          className="h-10 w-10 rounded-full bg-card border border-border flex items-center justify-center text-primary"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-3xl font-extrabold">Account settings</h1>
      </div>

      <div className="space-y-4">
        <Field label="Username">
          <input value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls} placeholder="username" maxLength={32} />
        </Field>
        <Field label="Display name">
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputCls} placeholder="Your name" maxLength={64} />
        </Field>
        <Field label="Bio / description">
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} className={`${inputCls} h-24 resize-none`} placeholder="Say something about yourself" maxLength={240} />
        </Field>

        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-gradient-to-r from-primary to-secondary text-primary-foreground font-bold rounded-2xl py-3 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </button>
      </div>

      <div className="mt-10 bg-card border border-danger/30 rounded-2xl p-4">
        <h2 className="font-bold text-danger">Danger zone</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Deleting your account permanently removes your profile, players, and clips.
        </p>
        <button
          onClick={remove}
          disabled={deleting}
          className="mt-3 w-full border border-danger/50 text-danger font-bold rounded-2xl py-3 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Delete account
        </button>
      </div>
    </div>
  );
}

const inputCls = "w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
