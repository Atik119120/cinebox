import { supabase } from "../integrations/supabase/client";

// The imported Cineflex player remains untouched; only its saved-list changes are mirrored.
const key = "playflix_watchlist";
type Item = { id: number | string; media_type?: string | undefined; title?: string | undefined; name?: string | undefined; poster_path?: string | undefined; release_date?: string | undefined; first_air_date?: string | undefined; vote_average?: number | undefined };
let userId: string | null = null;
let current: Item[] = [];
let syncing = false;

function saved(): Item[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value.filter((item) => item && item.id != null) : [];
  } catch { return []; }
}

function identity(item: Item) { return `${item.media_type === "tv" ? "tv" : "movie"}:${item.id}`; }

async function persist(next: Item[]) {
  if (!userId || syncing) return;
  const previous = new Map(current.map((item) => [identity(item), item]));
  const incoming = new Map(next.map((item) => [identity(item), item]));
  for (const [id, item] of incoming) {
    if (previous.has(id)) continue;
    const { error } = await supabase.from("watchlists").upsert({
      user_id: userId, external_movie_id: String(item.id), content_type: item.media_type === "tv" ? "tv" : "movie",
      title: item.title || item.name || null, poster_path: item.poster_path || null,
      release_year: Number((item.release_date || item.first_air_date || "").slice(0, 4)) || null,
      rating: typeof item.vote_average === "number" ? Math.round(item.vote_average * 10) / 10 : null,
    }, { onConflict: "user_id,external_movie_id,content_type" });
    if (error) console.warn("Saved list could not sync", error.message);
  }
  for (const id of previous.keys()) {
    if (incoming.has(id)) continue;
    const [type = "movie", movieId = ""] = id.split(":");
    const { error } = await supabase.from("watchlists").delete().eq("user_id", userId).eq("content_type", type).eq("external_movie_id", movieId);
    if (error) console.warn("Saved list could not sync", error.message);
  }
  current = next;
}

const originalSet = Storage.prototype.setItem;
Storage.prototype.setItem = function (name, value) {
  originalSet.call(this, name, value);
  if (this === localStorage && name === key) void persist(saved());
};

async function hydrate() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { userId = null; return; }
  userId = user.id;
  const { data, error } = await supabase.from("watchlists").select("external_movie_id,content_type,title,poster_path,release_year,rating").eq("user_id", user.id);
  if (error) { console.warn("Saved list could not load", error.message); return; }
  const local = saved();
  const remote: Item[] = (data || []).map((row) => ({ id: Number(row.external_movie_id), media_type: row.content_type, title: row.title || undefined, poster_path: row.poster_path || undefined, vote_average: row.rating || undefined }));
  const merged = [...local, ...remote.filter((row) => !local.some((item) => identity(item) === identity(row)))];
  current = remote;
  await persist(merged);
  if (merged.length !== local.length) {
    // The imported SPA reads its saved list only once at mount.
    syncing = true;
    originalSet.call(localStorage, key, JSON.stringify(merged));
    syncing = false;
    if (sessionStorage.getItem("cinebox-hydrated") !== user.id) {
      sessionStorage.setItem("cinebox-hydrated", user.id);
      location.reload();
    }
  }
}

void hydrate();
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    userId = null;
    sessionStorage.removeItem("cinebox-hydrated");
    originalSet.call(localStorage, key, "[]");
  } else if (event === "SIGNED_IN") void hydrate();
});

// Third-party streams render cross-origin frames: only the opened title and episode
// can be recorded here; frame playback time cannot be observed from this page.
let lastWatch = "";
const watchObserver = new MutationObserver(() => {
  const match = location.pathname.match(/^\/watch\/(movie|tv)\/(\d+)/);
  if (!match || !document.querySelector(".cine-watch-page") || !userId) return;
  const season = Number(new URLSearchParams(location.search).get("season")) || 1;
  const episode = Number(new URLSearchParams(location.search).get("episode")) || 1;
  const title = document.querySelector(".cine-watch-heading h1")?.textContent?.trim();
  if (!title) return;
  const stamp = `${userId}:${match[1]!}:${match[2]!}:${season}:${episode}`;
  if (stamp === lastWatch) return;
  lastWatch = stamp;
  void supabase.from("watch_histories").upsert({ user_id: userId, external_movie_id: match[2]!, content_type: match[1]!, title,
    ...(match[1] === "tv" ? { season, episode } : {}), last_watched_at: new Date().toISOString() },
  { onConflict: "user_id,external_movie_id,content_type" }).then(({ error }) => { if (error) console.warn("Viewing history could not sync", error.message); });
});
watchObserver.observe(document.documentElement, { childList: true, subtree: true });