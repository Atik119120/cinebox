import { createFileRoute } from "@tanstack/react-router";
import html from "@/cinebox/index.html?raw";

// SPA fallback: Cineflex handles its own client-side routing.
export const Route = createFileRoute("/$")({
  head: ({ params }) => {
    const slug = params._splat ?? "";
    const names: Record<string, string> = {
      "collection/trending": "Trending Now",
      "collection/releases": "New Releases",
      "collection/rated": "Top Rated",
      "collection/action": "Action & Adventure",
      "collection/popular-tv": "Popular TV Shows",
      "network/netflix": "Netflix",
      "network/amazon-prime": "Prime Video",
      "network/jio-hotstar": "Hotstar",
      "network/jiocinema": "JioCinema",
      "network/crunchyroll": "Crunchyroll",
      "network/mx-player": "MX Player",
      "network/sony-liv": "Sony LIV",
      "network/zee5": "Zee5",
    };
    const title = `${names[slug] ?? "Watch & Explore"} — Cineflex`;
    const description = names[slug]
      ? `Browse ${names[slug]} movies and series on Cineflex.`
      : "Explore a title or watch movies and series on Cineflex.";
    return { meta: [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] };
  },
  server: {
    handlers: {
      GET: async () =>
        new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
    },
  },
  component: () => null,
});
