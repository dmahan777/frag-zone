import { useEffect, useRef, useState } from "react";
import { MarkerClusterer, SuperClusterAlgorithm } from "@googlemaps/markerclusterer";

const PIN_W = 76;
const PIN_H = 92;
const RADIUS = 32;
const CENTER = 38;

type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  photoUrl?: string | null;
  ringColor?: string; // hex
};

type Props = {
  markers?: MapMarker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  onMarkerClick?: (id: string) => void;
  focusId?: string | null; // pan + zoom to this marker
};

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
    const params = new URLSearchParams({
      key: BROWSER_KEY,
      loading: "async",
      callback: "__lovableInitMap",
    });
    if (TRACKING_ID) params.set("channel", TRACKING_ID);
    s.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    s.async = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return loaderPromise;
}

// Cache photo URLs -> data URLs so the SVG <image> renders reliably (no CORS taint)
const photoCache = new Map<string, string>();
async function toDataUrl(url: string): Promise<string> {
  if (photoCache.has(url)) return photoCache.get(url)!;
  const res = await fetch(url, { mode: "cors" });
  const blob = await res.blob();
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
  photoCache.set(url, dataUrl);
  return dataUrl;
}

function svgPin(photoDataUrl: string | null | undefined, ringColor: string) {
  const img = photoDataUrl
    ? `<image href="${photoDataUrl}" x="6" y="6" width="44" height="44" clip-path="url(#avatarClip)" preserveAspectRatio="xMidYMid slice"/>`
    : `<circle cx="28" cy="28" r="22" fill="#1f2937"/><text x="28" y="34" font-size="18" text-anchor="middle" fill="#fff" font-family="sans-serif">?</text>`;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="56" height="68" viewBox="0 0 56 68">
      <defs>
        <clipPath id="avatarClip"><circle cx="28" cy="28" r="22"/></clipPath>
        <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.25"/>
        </filter>
      </defs>
      <g filter="url(#s)">
        <path d="M28 64 L20 52 H36 Z" fill="#ffffff"/>
        <circle cx="28" cy="28" r="26" fill="#ffffff"/>
        <circle cx="28" cy="28" r="24" fill="${ringColor}"/>
        ${img}
      </g>
    </svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

export function GoogleMap({ markers = [], center, zoom = 15, className = "", onMarkerClick, focusId }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerObjs = useRef<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const fallbackCenter = center ?? { lat: 25.768, lng: -80.135 }; // South Beach default

  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then(() => {
        if (cancelled || !ref.current) return;
        const google = (window as any).google;
        mapRef.current = new google.maps.Map(ref.current, {
          center: fallbackCenter,
          zoom,
          disableDefaultUI: true,
          zoomControl: false,
          clickableIcons: false,
          gestureHandling: "greedy",
          backgroundColor: "var(--map-fallback)",
        });
        // Trigger a resize once the container has its final size — fixes blank tiles
        // when the map is initialized inside a freshly-mounted flex/absolute parent.
        const fire = () => {
          if (!mapRef.current) return;
          google.maps.event.trigger(mapRef.current, "resize");
          mapRef.current.setCenter(fallbackCenter);
        };
        requestAnimationFrame(fire);
        setTimeout(fire, 300);
        if (ref.current && "ResizeObserver" in window) {
          const ro = new ResizeObserver(() => fire());
          ro.observe(ref.current);
          (mapRef.current as any).__ro = ro;
        }
      })
      .catch((e) => setErr(e.message));
    return () => {
      cancelled = true;
      const ro = (mapRef.current as any)?.__ro as ResizeObserver | undefined;
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render markers
  useEffect(() => {
    const google = (window as any).google;
    if (!mapRef.current || !google?.maps) return;
    let cancelled = false;

    markerObjs.current.forEach((m) => m.setMap(null));
    markerObjs.current = markers.map((m) => {
      const initialDataUrl = m.photoUrl ? photoCache.get(m.photoUrl) ?? null : null;
      const marker = new google.maps.Marker({
        position: { lat: m.lat, lng: m.lng },
        map: mapRef.current,
        icon: {
          url: svgPin(initialDataUrl, m.ringColor || "#3b82f6"),
          scaledSize: new google.maps.Size(56, 68),
          anchor: new google.maps.Point(28, 64),
        },
        title: m.label,
      });
      if (onMarkerClick) marker.addListener("click", () => onMarkerClick(m.id));
      if (m.photoUrl && !initialDataUrl) {
        toDataUrl(m.photoUrl).then((dataUrl) => {
          if (cancelled) return;
          marker.setIcon({
            url: svgPin(dataUrl, m.ringColor || "#3b82f6"),
            scaledSize: new google.maps.Size(56, 68),
            anchor: new google.maps.Point(28, 64),
          });
        }).catch(() => {});
      }
      return marker;
    });

    if (focusId) {
      const target = markers.find((m) => m.id === focusId);
      if (target) {
        mapRef.current.panTo({ lat: target.lat, lng: target.lng });
        mapRef.current.setZoom(18);
      }
    } else if (markers.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      markers.forEach((m) => bounds.extend({ lat: m.lat, lng: m.lng }));
      mapRef.current.fitBounds(bounds, 80);
      const listener = google.maps.event.addListenerOnce(mapRef.current, "idle", () => {
        if (mapRef.current.getZoom() > 17) mapRef.current.setZoom(17);
      });
      return () => { cancelled = true; google.maps.event.removeListener(listener); };
    }
    return () => { cancelled = true; };
  }, [markers, onMarkerClick, focusId]);

  return (
    <div className={`h-full w-full overflow-hidden ${className}`}>
      <div className="relative h-full w-full">
        <div className="absolute inset-0 bg-map-fallback" />
        <div ref={ref} className="absolute inset-0 h-full w-full" />
        {err && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/40 text-center p-4">
            <p className="text-xs text-muted-foreground">Map unavailable: {err}</p>
          </div>
        )}
      </div>
    </div>
  );
}
