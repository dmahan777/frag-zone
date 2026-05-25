import { useEffect, useRef, useState } from "react";
import { X, Square as SquareIcon, Plus, Trash2, Check } from "lucide-react";

const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const TRACKING_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

let loaderPromise: Promise<void> | null = null;
function loadMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if ((window as any).google?.maps?.Map) return Promise.resolve();
  if (loaderPromise) return loaderPromise;
  if (!BROWSER_KEY) return Promise.reject(new Error("Missing Google Maps browser key"));
  loaderPromise = new Promise<void>((resolve, reject) => {
    (window as any).__lovableInitMap = () => resolve();
    const s = document.createElement("script");
    const params = new URLSearchParams({ key: BROWSER_KEY, loading: "async", callback: "__lovableInitMap" });
    if (TRACKING_ID) params.set("channel", TRACKING_ID);
    s.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    s.async = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return loaderPromise;
}

export type Zone = { north: number; south: number; east: number; west: number };

type Props = {
  open: boolean;
  initial: Zone[];
  center?: { lat: number; lng: number };
  onClose: () => void;
  onSave: (zones: Zone[]) => void;
};

export function MultiZoneDrawer({ open, initial, center, onClose, onSave }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const rectsRef = useRef<any[]>([]);
  const corner1Ref = useRef<{ lat: number; lng: number } | null>(null);
  const [hint, setHint] = useState("Tap two corners to draw a zone. Add as many as you want.");
  const [count, setCount] = useState(initial?.length ?? 0);

  const syncCount = () => setCount(rectsRef.current.length);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadMaps().then(() => {
      if (cancelled || !ref.current) return;
      const google = (window as any).google;
      const c = center ?? { lat: 25.768, lng: -80.135 };
      const map = new google.maps.Map(ref.current, {
        center: c, zoom: 15, disableDefaultUI: true, zoomControl: true, gestureHandling: "greedy",
      });
      mapRef.current = map;
      rectsRef.current = [];
      (initial ?? []).forEach((z) => drawRect(z));
      syncCount();

      map.addListener("click", (e: any) => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        if (!corner1Ref.current) {
          corner1Ref.current = { lat, lng };
          setHint("Tap the opposite corner");
        } else {
          const a = corner1Ref.current;
          drawRect({
            north: Math.max(a.lat, lat),
            south: Math.min(a.lat, lat),
            east: Math.max(a.lng, lng),
            west: Math.min(a.lng, lng),
          });
          corner1Ref.current = null;
          syncCount();
          setHint("Zone added. Tap two more corners for another, or save.");
        }
      });
    }).catch(() => setHint("Map failed to load"));
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, [open]);

  const drawRect = (area: Zone) => {
    const google = (window as any).google;
    if (!google || !mapRef.current) return;
    const rect = new google.maps.Rectangle({
      bounds: area,
      strokeColor: "#FF5FA0", strokeWeight: 2, fillColor: "#FF5FA0", fillOpacity: 0.18,
      map: mapRef.current, editable: true, draggable: true,
    });
    rect.addListener("rightclick", () => {
      rect.setMap(null);
      rectsRef.current = rectsRef.current.filter((r) => r !== rect);
      syncCount();
    });
    rectsRef.current.push(rect);
  };

  const removeLast = () => {
    const last = rectsRef.current.pop();
    last?.setMap(null);
    syncCount();
  };

  const clearAll = () => {
    rectsRef.current.forEach((r) => r.setMap(null));
    rectsRef.current = [];
    corner1Ref.current = null;
    syncCount();
    setHint("Cleared. Tap two corners to draw a zone.");
  };

  const save = () => {
    const zones: Zone[] = rectsRef.current.map((r) => {
      const b = r.getBounds();
      const ne = b.getNorthEast();
      const sw = b.getSouthWest();
      return { north: ne.lat(), south: sw.lat(), east: ne.lng(), west: sw.lng() };
    });
    onSave(zones);
    onClose();
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col">
      <div className="flex items-center justify-between px-4 h-14 border-b border-border">
        <button onClick={onClose} className="h-9 w-9 rounded-full bg-card flex items-center justify-center"><X className="h-5 w-5" /></button>
        <p className="font-display font-bold text-sm">Purchase zones ({count})</p>
        <div className="flex gap-1">
          <button onClick={removeLast} disabled={count === 0} className="h-9 px-2 rounded-full bg-card flex items-center justify-center disabled:opacity-40" title="Remove last"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="flex-1 relative">
        <div ref={ref} className="absolute inset-0" />
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-card/95 backdrop-blur px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5 border border-border">
          <SquareIcon className="h-3.5 w-3.5 text-primary" />{hint}
        </div>
        {count > 0 && (
          <button onClick={clearAll} className="absolute bottom-3 left-3 bg-card/95 backdrop-blur px-3 py-1.5 rounded-full text-[11px] border border-border text-danger font-bold">
            Clear all
          </button>
        )}
        <div className="absolute bottom-3 right-3 bg-card/95 backdrop-blur px-3 py-1.5 rounded-full text-[11px] border border-border flex items-center gap-1">
          <Plus className="h-3 w-3" /> Tap map to add. Right-click a zone to remove.
        </div>
      </div>
      <div className="p-4 border-t border-border flex gap-2">
        <button onClick={onClose} className="flex-1 h-12 rounded-2xl bg-card border border-border font-bold text-sm">Cancel</button>
        <button onClick={save}
          className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-primary to-secondary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2">
          <Check className="h-4 w-4" /> Save {count > 0 ? `${count} zone${count === 1 ? "" : "s"}` : ""}
        </button>
      </div>
    </div>
  );
}
