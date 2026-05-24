import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const reverseGeocodeCity = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ lat: z.number(), lng: z.number() }).parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    const connKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey || !connKey) return { label: `${data.lat.toFixed(3)}, ${data.lng.toFixed(3)}` };

    const url = `https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json?latlng=${data.lat},${data.lng}&result_type=locality|administrative_area_level_3|administrative_area_level_2`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Connection-Api-Key": connKey,
      },
    });
    const json: any = await res.json();
    const first = json?.results?.[0];
    if (!first) return { label: `${data.lat.toFixed(3)}, ${data.lng.toFixed(3)}` };

    const comps: Array<{ long_name: string; short_name: string; types: string[] }> = first.address_components ?? [];
    const pick = (...types: string[]) => comps.find((c) => types.some((t) => c.types.includes(t)));
    const city = pick("locality", "postal_town", "administrative_area_level_3", "administrative_area_level_2")?.long_name;
    const region = pick("administrative_area_level_1")?.short_name;
    const country = pick("country")?.short_name;

    const parts = [city, region, country && country !== "US" ? country : null].filter(Boolean);
    return { label: parts.length ? parts.join(", ") : `${data.lat.toFixed(3)}, ${data.lng.toFixed(3)}` };
  });
