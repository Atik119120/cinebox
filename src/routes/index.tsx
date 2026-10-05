import { createFileRoute } from "@tanstack/react-router";
import html from "@/cinebox/index.html?raw";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Cineflex — Movies, Series & Anime" },
    { name: "description", content: "Browse movies, series and anime on Cineflex, and keep your favorites in a watchlist." },
    { property: "og:title", content: "Cineflex — Movies, Series & Anime" },
    { property: "og:description", content: "Browse movies, series and anime on Cineflex, and keep your favorites in a watchlist." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  server: {
    handlers: {
      GET: async () =>
        new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
    },
  },
  component: () => null,
});
