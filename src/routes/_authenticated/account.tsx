import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "My account — Cineflex" },
      { name: "description", content: "Your Cineflex profile, watchlist and history." },
      { property: "og:title", content: "My account — Cineflex" },
      { property: "og:description", content: "Your Cineflex profile, watchlist and history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Account,
});

function Account() {
  const { user } = Route.useRouteContext();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  type Media = { id: string; external_movie_id: string; content_type: string; title: string | null; poster_path: string | null; season?: number | null; episode?: number | null; last_watched_at?: string };
  const [history, setHistory] = useState<Media[]>([]);
  const [watchlist, setWatchlist] = useState<Media[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle().then(({ data }) => setName(data?.display_name ?? ""));
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => setRoles((data ?? []).map((r) => r.role)));
    supabase.from("watch_histories").select("id,external_movie_id,content_type,title,poster_path,season,episode,last_watched_at").eq("user_id", user.id).order("last_watched_at", { ascending: false }).limit(100).then(({ data }) => setHistory(data ?? []));
    supabase.from("watchlists").select("id,external_movie_id,content_type,title,poster_path").eq("user_id", user.id).order("added_at", { ascending: false }).limit(100).then(({ data }) => setWatchlist(data ?? []));
  }, [user.id]);

  const isAdmin = roles.includes("admin") || roles.includes("super_admin");

  async function save() {
    const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", user.id);
    setMsg(error ? error.message : "Saved");
  }
  async function logout() {
    await supabase.auth.signOut();
    localStorage.removeItem("playflix_watchlist");
    nav({ to: "/auth", replace: true });
  }

  async function removeSaved(item: Media) {
    const { error } = await supabase.from("watchlists").delete().eq("id", item.id).eq("user_id", user.id);
    if (error) { setMsg(error.message); return; }
    setWatchlist((list) => list.filter((entry) => entry.id !== item.id));
    try {
      const local = JSON.parse(localStorage.getItem("playflix_watchlist") || "[]");
      if (Array.isArray(local)) localStorage.setItem("playflix_watchlist", JSON.stringify(local.filter((entry) => !(String(entry.id) === item.external_movie_id && (entry.media_type === "tv" ? "tv" : "movie") === item.content_type))));
    } catch { /* An invalid local cache does not block removing the cloud item. */ }
  }

  async function clearHistory() {
    if (!window.confirm("Clear your viewing history?")) return;
    const { error } = await supabase.from("watch_histories").delete().eq("user_id", user.id);
    if (error) setMsg(error.message);
    else setHistory([]);
  }

  const poster = (path: string | null) => path?.startsWith("/") ? `https://image.tmdb.org/t/p/w185${path}` : null;

  return (
    <div className="cine-account min-h-screen bg-background px-5 py-8 text-foreground md:px-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <a href="/" className="text-2xl font-black">CINE<span className="text-primary">BOX</span></a>
          <div className="flex gap-2">
            {isAdmin && <Link to="/admin" className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Admin</Link>}
            <Button onClick={logout} variant="outline">Logout</Button>
          </div>
        </div>
        <section className="mt-8 rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-bold">My profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">{user.email} · {roles.join(", ") || "user"}</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name" className="flex-1 rounded-md border border-border bg-muted px-4 py-2" />
            <Button onClick={save}>Save</Button>
          </div>
          {msg && <p className="mt-2 text-sm text-muted-foreground">{msg}</p>}
        </section>
        <section className="mt-8">
          <h2 className="text-lg font-bold">My watchlist</h2>
          {watchlist.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Nothing saved yet.</p> :
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6">{watchlist.map((item) =>
              <div key={item.id} className="min-w-0">
                <a href={`/watch/${item.content_type}/${item.external_movie_id}`} className="block text-sm">
                  {poster(item.poster_path) && <img src={poster(item.poster_path) ?? ""} alt="" className="aspect-[2/3] w-full rounded-md object-cover" loading="lazy" />}
                  <span className="mt-2 block truncate">{item.title || "Untitled"}</span>
                </a>
                <Button size="sm" variant="ghost" onClick={() => removeSaved(item)} className="mt-1 px-0 text-muted-foreground">Remove</Button>
              </div>)}</div>}
        </section>
        <section className="mt-8">
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Recently watched</h2>{history.length > 0 && <Button size="sm" variant="ghost" onClick={clearHistory}>Clear history</Button>}</div>
          {history.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6">
              {history.map((h) => (
                <a key={h.id} href={`/watch/${h.content_type}/${h.external_movie_id}${h.content_type === "tv" ? `?season=${h.season || 1}&episode=${h.episode || 1}` : ""}`} className="text-xs">
                  {poster(h.poster_path) && <img src={poster(h.poster_path) ?? ""} alt="" className="aspect-[2/3] w-full rounded-md object-cover" loading="lazy" />}
                  <span className="mt-1 block truncate">{h.title}</span>
                  {h.content_type === "tv" && <span className="text-muted-foreground">S{h.season || 1} E{h.episode || 1}</span>}
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
