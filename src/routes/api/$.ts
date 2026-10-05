import { createFileRoute } from "@tanstack/react-router";
import settings from "@/cinebox/settings.json";
import pages from "@/cinebox/pages.json";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const SIZES = ["original", "w500", "w780", "w1280", "w300", "w200"];

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const p = (params as { _splat?: string })._splat ?? "";
        const url = new URL(request.url);
        if (p === "settings") return json(settings);
        if (p === "pages") return json(pages);
        if (p.startsWith("pages/")) {
          const key = p.slice(6);
          const page = (pages as Array<{ id: number; slug: string }>).find(
            (x) => String(x.id) === key || x.slug === key,
          );
          return page ? json(page) : json({ error: "Not found" }, 404);
        }
        if (p === "auth/me") return json({ user: null });
        if (p === "image-proxy") {
          const direct = url.searchParams.get("url");
          const path = url.searchParams.get("path");
          const sizeQ = url.searchParams.get("size") ?? "w500";
          const size = SIZES.includes(sizeQ) ? sizeQ : "w500";
          let target = "";
          if (direct?.startsWith("http")) target = direct;
          else if (path) target = `https://image.tmdb.org/t/p/${size}${path.startsWith("/") ? path : "/" + path}`;
          else return new Response("Missing image path or url", { status: 400 });
          const r = await fetch(target);
          if (!r.ok) return new Response("Image not found", { status: r.status });
          return new Response(r.body, {
            headers: {
              "Content-Type": r.headers.get("content-type") ?? "image/jpeg",
              "Cache-Control": "public, max-age=604800",
            },
          });
        }
        return json({ error: "Not found" }, 404);
      },
      POST: async () => json({ error: "Not available in this preview" }, 403),
      PUT: async () => json({ error: "Not available in this preview" }, 403),
      DELETE: async () => json({ error: "Not available in this preview" }, 403),
    },
  },
});
