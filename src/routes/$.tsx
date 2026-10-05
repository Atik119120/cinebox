import { createFileRoute } from "@tanstack/react-router";
import { renderSeoPage } from "@/lib/seo-renderer";

export const Route = createFileRoute("/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const { html, status } = await renderSeoPage(url.pathname);
        return new Response(html, {
          status,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": status === 200 ? "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400" : "no-cache",
          },
        });
      },
    },
  },
  component: () => null,
});
