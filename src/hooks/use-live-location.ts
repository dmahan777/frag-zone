import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Pos = { lat: number; lng: number };

/**
 * Watches the user's location and upserts it into player_locations for the active game.
 * Returns the latest local position.
 */
export function useLiveLocation(gameId: string | undefined, userId: string | undefined) {
  const [pos, setPos] = useState<Pos | null>(null);

  useEffect(() => {
    if (!gameId || !userId || typeof navigator === "undefined" || !navigator.geolocation) return;

    let lastSent = 0;
    const push = async (lat: number, lng: number, accuracy: number) => {
      const now = Date.now();
      // Throttle DB writes to ~once every 4s
      if (now - lastSent < 4000) return;
      lastSent = now;
      await supabase.from("player_locations").upsert(
        { user_id: userId, game_id: gameId, lat, lng, accuracy, updated_at: new Date().toISOString() },
        { onConflict: "user_id,game_id" }
      );
    };

    navigator.geolocation.getCurrentPosition(
      (p) => {
        const next = { lat: p.coords.latitude, lng: p.coords.longitude };
        setPos(next);
        void push(next.lat, next.lng, p.coords.accuracy);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    );

    const watchId = navigator.geolocation.watchPosition(
      (p) => {
        const next = { lat: p.coords.latitude, lng: p.coords.longitude };
        setPos(next);
        void push(next.lat, next.lng, p.coords.accuracy);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 5_000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [gameId, userId]);

  return pos;
}
