import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Pos = { lat: number; lng: number; speed?: number | null; battery?: number | null };

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
    let battery: number | null = null;
    let batteryObj: any = null;

    // Battery API (Chrome/Edge/Android) — Safari/iOS won't have it
    const navAny = navigator as any;
    if (typeof navAny.getBattery === "function") {
      navAny.getBattery().then((b: any) => {
        batteryObj = b;
        battery = Math.round(b.level * 100);
        const update = () => { battery = Math.round(b.level * 100); };
        b.addEventListener("levelchange", update);
      }).catch(() => {});
    }

    const push = async (lat: number, lng: number, accuracy: number, speedMs: number | null) => {
      const now = Date.now();
      if (now - lastSent < 4000) return;
      lastSent = now;
      const { error } = await supabase.from("player_locations").upsert(
        {
          user_id: userId,
          game_id: gameId,
          lat,
          lng,
          accuracy,
          speed: speedMs != null ? speedMs * 2.23694 : null, // m/s -> mph
          battery,
          updated_at: new Date().toISOString(),
        },
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

    const handle = (p: GeolocationPosition) => {
      const mph = p.coords.speed != null ? p.coords.speed * 2.23694 : null;
      setPos({ lat: p.coords.latitude, lng: p.coords.longitude, speed: mph, battery });
      void push(p.coords.latitude, p.coords.longitude, p.coords.accuracy, p.coords.speed ?? null);
    };

    navigator.geolocation.getCurrentPosition(handle, onErr, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 });
    const watchId = navigator.geolocation.watchPosition(handle, onErr, { enableHighAccuracy: true, timeout: 20_000, maximumAge: 5_000 });

    return () => {
      navigator.geolocation.clearWatch(watchId);
      if (batteryObj) batteryObj.removeEventListener?.("levelchange", () => {});
    };
  }, [gameId, userId]);

  return pos;
}
