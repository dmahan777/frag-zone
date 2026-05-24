import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { Send, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
});

type Msg = { id: string; game_id: string; user_id: string; text: string; created_at: string };
type ProfileLite = { id: string; username: string | null; photo_url: string | null };

function ChatPage() {
  const { user, profile } = useAuth();
  const [gameId, setGameId] = useState<string | null | undefined>(undefined);
  const [gameName, setGameName] = useState<string>("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, ProfileLite>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // find active game
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("players")
        .select("game_id")
        .eq("user_id", user.id)
        .order("joined_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setGameId(data?.game_id ?? null);
      if (data?.game_id) {
        const { data: g } = await supabase.from("games").select("name").eq("id", data.game_id).maybeSingle();
        setGameName((g as any)?.name ?? "Game chat");
      }
    })();
  }, [user]);

  const loadMessages = async (gid: string) => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("game_id", gid)
      .order("created_at", { ascending: true })
      .limit(200);
    const arr = (data as Msg[]) ?? [];
    setMsgs(arr);
    const ids = Array.from(new Set(arr.map((m) => m.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, username, photo_url").in("id", ids);
      const map: Record<string, ProfileLite> = {};
      (profs as ProfileLite[] | null)?.forEach((p) => { map[p.id] = p; });
      setProfilesById(map);
    }
  };

  useEffect(() => {
    if (!gameId) return;
    loadMessages(gameId);
    const ch = supabase.channel(`chat-${gameId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `game_id=eq.${gameId}` },
        (payload) => {
          const m = payload.new as Msg;
          setMsgs((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
          if (!profilesById[m.user_id]) {
            supabase.from("profiles").select("id, username, photo_url").eq("id", m.user_id).maybeSingle().then(({ data }) => {
              if (data) setProfilesById((p) => ({ ...p, [m.user_id]: data as ProfileLite }));
            });
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [gameId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const send = async () => {
    const t = text.trim();
    if (!t || !user || !gameId) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({ game_id: gameId, user_id: user.id, text: t });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setText("");
  };

  const grouped = useMemo(() => {
    // group consecutive messages by same sender within 5 min
    const out: { user_id: string; items: Msg[] }[] = [];
    for (const m of msgs) {
      const last = out[out.length - 1];
      const prevTime = last ? new Date(last.items[last.items.length - 1].created_at).getTime() : 0;
      const curTime = new Date(m.created_at).getTime();
      if (last && last.user_id === m.user_id && curTime - prevTime < 5 * 60_000) {
        last.items.push(m);
      } else {
        out.push({ user_id: m.user_id, items: [m] });
      }
    }
    return out;
  }, [msgs]);

  if (gameId === undefined) {
    return <div className="h-screen flex items-center justify-center text-muted-foreground text-sm">Loading chat…</div>;
  }

  if (!gameId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center pb-28">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
          <MessageCircle className="h-8 w-8 text-primary" />
        </div>
        <h2 className="mt-4 font-display text-2xl font-extrabold">No game chat yet</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">Join or create a game to start chatting with the other players.</p>
        <Link to="/home" className="mt-6 px-6 py-3 rounded-2xl bg-gradient-to-r from-primary to-secondary text-primary-foreground font-display font-bold shadow-glow-primary">
          Go to lobby
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col pb-28">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur-xl border-b border-border px-5 pt-12 pb-3">
        <h1 className="font-display text-xl font-extrabold truncate">{gameName}</h1>
        <p className="text-xs text-muted-foreground">Game chat · {msgs.length} messages</p>
      </div>

      {/* Messages */}
      <div className="flex-1 px-4 py-4 space-y-4">
        {msgs.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-10">Say hi 👋 — be the first to send a message.</p>
        )}
        {grouped.map((g, i) => {
          const isMe = g.user_id === user?.id;
          const prof = profilesById[g.user_id];
          return (
            <div key={i} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
              <Avatar name={prof?.username ?? (isMe ? profile?.username : "")} url={prof?.photo_url ?? (isMe ? profile?.photo_url : null)} size={32} />
              <div className={`flex flex-col gap-1 max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                {!isMe && <span className="text-[11px] text-muted-foreground px-2">@{prof?.username ?? "player"}</span>}
                {g.items.map((m) => (
                  <div key={m.id}
                    className={`px-3.5 py-2 rounded-2xl text-sm break-words ${
                      isMe
                        ? "bg-gradient-to-br from-primary to-secondary text-primary-foreground rounded-br-md"
                        : "bg-card border border-border text-foreground rounded-bl-md"
                    }`}>
                    {m.text}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="fixed bottom-[88px] left-1/2 -translate-x-1/2 w-full max-w-[430px] px-3 z-30">
        <div className="bg-card border border-border rounded-full shadow-card flex items-center gap-2 pl-4 pr-2 py-1.5">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder="Type a message…"
            className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none py-1.5"
          />
          <button
            onClick={send}
            disabled={sending || !text.trim()}
            className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center disabled:opacity-40 active:scale-95 transition"
          >
            <Send className="h-4 w-4 text-primary-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
