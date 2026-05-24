import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Pos = { lat: number; lng: number };

/**
 * Watches the user's location and upserts it into player_locations for the active game.
 * Returns the latest local position.
 */
export function useLiveLocation(gameId: string | undefined, userId: string | undefined) {
  const [pos, setPos] = useState<Pos | null>(null);

  useEffect(() => {
    if (!gameId || !userId) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Your device doesn't support location services.");
      return;
    }

    let shownError = false;
    let lastSent = 0;
    const push = async (lat: number, lng: number, accuracy: number) => {
      const now = Date.now();
      if (now - lastSent < 4000) return;
      lastSent = now;
      const { error } = await supabase.from("player_locations").upsert(
        { user_id: userId, game_id: gameId, lat, lng, accuracy, updated_at: new Date().toISOString() },
        { onConflict: "user_id,game_id" }
      );
      if (error) console.error("location upsert failed", error);
    };

    const onErr = (err: GeolocationPositionError) => {
      if (shownError) return;
      shownError = true;
      if (err.code === err.PERMISSION_DENIED) {
        toast.error("Location access denied. Enable location in your browser to appear on the map.");
      } else {
        toast.error(`Location error: ${err.message}`);
      }
    };

    navigator.geolocation.getCurrentPosition(
      (p) => {
        const next = { lat: p.coords.latitude, lng: p.coords.longitude };
        setPos(next);
        void push(next.lat, next.lng, p.coords.accuracy);
      },
      onErr,
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }
    );

    const watchId = navigator.geolocation.watchPosition(
      (p) => {
        const next = { lat: p.coords.latitude, lng: p.coords.longitude };
        setPos(next);
        void push(next.lat, next.lng, p.coords.accuracy);
      },
      onErr,
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 5_000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [gameId, userId]);

  return pos;
}
