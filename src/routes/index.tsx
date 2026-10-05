import { createFileRoute } from "@tanstack/react-router";
import { renderSeoPage } from "@/lib/seo-renderer";

export const Route = createFileRoute("/")({
  server: {
    handlers: {
      GET: async () => {
        const { html, status } = await renderSeoPage("/");
        return new Response(html, {
          status,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400",
          },
        });
      },
    },
  },
  component: () => null,
});
