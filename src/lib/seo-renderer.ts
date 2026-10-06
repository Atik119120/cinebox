// Server-side SEO pre-rendering and dynamic metadata generator for Cineflex
import rawHtml from "@/cinebox/index.html?raw";

const DOMAIN = "https://cineflex.eu.cc";
const TMDB_API_KEY = "05902896074695709d7763505bb88b4d";
const TMDB_BASE = "https://api.themoviedb.org/3";

interface CacheEntry {
  data: any;
  expiry: number;
}

const memoryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function fetchTmdb(endpoint: string): Promise<any | null> {
  const cached = memoryCache.get(endpoint);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const url = `${TMDB_BASE}${endpoint}${endpoint.includes("?") ? "&" : "?"}api_key=${TMDB_API_KEY}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = await res.json();
    memoryCache.set(endpoint, { data, expiry: Date.now() + CACHE_TTL_MS });
    return data;
  } catch {
    return null;
  }
}

const KNOWN_COLLECTIONS: Record<string, { title: string; desc: string }> = {
  trending: { title: "Trending Now", desc: "Discover top trending movies and television series streamed worldwide on Cineflex." },
  releases: { title: "New Releases", desc: "Stream the newest movie and TV releases with fresh daily updates in 4K & HD." },
  "top-rated-movies": { title: "Top Rated Movies", desc: "Browse all-time highest-rated movies with critically acclaimed storytelling." },
  "top-rated-series": { title: "Top Rated TV Series", desc: "Watch top-rated TV shows, drama series, and miniseries." },
  "action-movies": { title: "Action & Adventure", desc: "High-octane action, thrillers, and blockbuster adventures on Cineflex." },
  "sci-fi-movies": { title: "Sci-Fi & Fantasy", desc: "Explore futuristic worlds, space sagas, and fantasy epics in ultra-high definition." },
  "horror-movies": { title: "Horror & Suspense", desc: "Spine-chilling horror movies and psychological thrillers." },
  "animation-movies": { title: "Animation & Anime", desc: "Acclaimed animated features and popular anime series." },
  "k-drama": { title: "K-Drama Hits", desc: "Stream popular Korean dramas and romantic series with subtitles." },
  "anime-series": { title: "Anime Series", desc: "Top Japanese anime series streaming in full HD with original audio and subtitles." },
  "airing-today": { title: "Airing Today", desc: "Find television episodes and series premiering and broadcasting today." },
};

const KNOWN_NETWORKS: Record<string, { title: string; desc: string }> = {
  netflix: { title: "Netflix Originals", desc: "Stream top-rated Netflix original movies and television shows on Cineflex." },
  "amazon-prime": { title: "Prime Video", desc: "Watch popular Amazon Prime Video original productions and hit series in HD." },
  "jio-hotstar": { title: "Disney+ Hotstar", desc: "Explore Disney+ Hotstar blockbusters, Marvel, Star Wars, and premier shows." },
  jiocinema: { title: "JioCinema", desc: "Stream hit regional cinema, web series, and movies from JioCinema." },
  crunchyroll: { title: "Crunchyroll Anime", desc: "High-definition Japanese anime simulcasts and complete anime collections." },
  "sony-liv": { title: "Sony LIV", desc: "Popular Sony LIV original series, Indian drama, and sports streaming." },
  zee5: { title: "Zee5", desc: "Popular Zee5 blockbusters, regional shows, and original web series." },
  "mx-player": { title: "MX Player", desc: "Watch popular MX Player web shows and trending regional series." },
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function renderSeoPage(pathname: string): Promise<{ html: string; status: number }> {
  const cleanPath = pathname.split("?")[0].replace(/\/+$/, "") || "/";

  // 1. Private / Non-indexable routes
  if (cleanPath.startsWith("/admin") || cleanPath.startsWith("/account") || cleanPath.startsWith("/reset-password")) {
    let out = rawHtml;
    out = out.replace(
      /<meta\s+name=["']robots["'][^>]*>/i,
      `<meta name="robots" content="noindex, nofollow" />`
    );
    if (!out.includes("noindex, nofollow")) {
      out = out.replace("<head>", `<head>\n    <meta name="robots" content="noindex, nofollow" />`);
    }
    return { html: out, status: 200 };
  }

  // 2. Movie Route: /movie/:id or /watch/movie/:id
  const movieMatch = cleanPath.match(/^\/(?:watch\/)?movie\/([0-9]+)/i);
  if (movieMatch) {
    const id = movieMatch[1];
    const data = await fetchTmdb(`/movie/${id}?append_to_response=credits`);

    if (!data || data.success === false) {
      let out = rawHtml;
      out = out.replace(/<title>.*?<\/title>/i, `<title>Movie Not Found — Cineflex</title>`);
      out = out.replace("<head>", `<head>\n    <meta name="robots" content="noindex, nofollow" />`);
      return { html: out, status: 404 };
    }

    const title = data.title || "Movie";
    const year = data.release_date ? data.release_date.slice(0, 4) : "";
    const pageTitle = `${title}${year ? ` (${year})` : ""} — Watch Movie Online & Details | Cineflex`;
    const overview = data.overview || "Stream this movie in full HD on Cineflex with 10 high-speed servers.";
    const metaDesc = overview.length > 155 ? `${overview.slice(0, 152)}...` : overview;
    const canonical = `${DOMAIN}/movie/${id}`;
    const posterUrl = data.poster_path ? `https://image.tmdb.org/t/p/w780${data.poster_path}` : `${DOMAIN}/assets/cinebox-logo.png`;
    const backdropUrl = data.backdrop_path ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}` : posterUrl;
    const genres = Array.isArray(data.genres) ? data.genres.map((g: any) => g.name) : [];
    const director = data.credits?.crew?.find((c: any) => c.job === "Director")?.name;
    const topCast = Array.isArray(data.credits?.cast) ? data.credits.cast.slice(0, 8).map((a: any) => a.name) : [];

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Movie",
      name: title,
      url: canonical,
      image: posterUrl,
      description: overview,
      datePublished: data.release_date,
      genre: genres,
      ...(data.vote_count > 0 ? {
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: Number(data.vote_average.toFixed(1)),
          ratingCount: data.vote_count,
          bestRating: 10,
          worstRating: 1,
        }
      } : {}),
      ...(director ? { director: { "@type": "Person", name: director } } : {}),
      actor: topCast.map((name: string) => ({ "@type": "Person", name })),
    };

    const prerenderBlock = `
    <!-- Crawlable Pre-rendered Content for Search Engines -->
    <section id="cine-seo-prerender" class="cine-seo-crawler-content" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;pointer-events:none;opacity:0;visibility:hidden;">
      <article>
        <h1>${escapeHtml(title)}${year ? ` (${year})` : ""}</h1>
        <p>${escapeHtml(overview)}</p>
        <div>
          <h2>Movie Information</h2>
          <ul>
            <li><strong>Release Date:</strong> ${escapeHtml(data.release_date || "N/A")}</li>
            <li><strong>Runtime:</strong> ${data.runtime ? `${data.runtime} minutes` : "N/A"}</li>
            <li><strong>Rating:</strong> ${data.vote_average ? `${data.vote_average.toFixed(1)}/10 (${data.vote_count} votes)` : "N/A"}</li>
            <li><strong>Genres:</strong> ${escapeHtml(genres.join(", ") || "General")}</li>
            ${director ? `<li><strong>Director:</strong> ${escapeHtml(director)}</li>` : ""}
            ${topCast.length ? `<li><strong>Starring:</strong> ${escapeHtml(topCast.join(", "))}</li>` : ""}
          </ul>
        </div>
        <nav aria-label="Explore Related">
          <a href="/">Browse All Movies</a>
          <a href="/collection/trending">Trending Movies</a>
          <a href="/collection/top-rated-movies">Top Rated Movies</a>
        </nav>
      </article>
    </section>`;

    let out = rawHtml;
    out = out.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(pageTitle)}</title>`);
    out = out.replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(metaDesc)}" />`);
    out = out.replace(/<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${escapeHtml(pageTitle)}" />`);
    out = out.replace(/<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escapeHtml(metaDesc)}" />`);
    
    // Inject canonical & OG
    const headExtra = `
    <link rel="canonical" href="${canonical}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:type" content="video.movie" />
    <meta property="og:image" content="${backdropUrl}" />
    <meta property="og:image:alt" content="${escapeHtml(title)} backdrop" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(metaDesc)}" />
    <meta name="twitter:image" content="${backdropUrl}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;

    out = out.replace("</head>", `${headExtra}\n  </head>`);
    out = out.replace('<div id="root"></div>', `${prerenderBlock}\n    <div id="root"></div>`);

    return { html: out, status: 200 };
  }

  // 3. TV Series Route: /tv/:id, /series/:id, /watch/tv/:id, /watch/series/:id
  const tvMatch = cleanPath.match(/^\/(?:watch\/)?(?:tv|series)\/([0-9]+)/i);
  if (tvMatch) {
    const id = tvMatch[1];
    const data = await fetchTmdb(`/tv/${id}?append_to_response=credits`);

    if (!data || data.success === false) {
      let out = rawHtml;
      out = out.replace(/<title>.*?<\/title>/i, `<title>TV Show Not Found — Cineflex</title>`);
      out = out.replace("<head>", `<head>\n    <meta name="robots" content="noindex, nofollow" />`);
      return { html: out, status: 404 };
    }

    const title = data.name || "TV Series";
    const year = data.first_air_date ? data.first_air_date.slice(0, 4) : "";
    const seasonsCount = data.number_of_seasons || 1;
    const pageTitle = `${title}${year ? ` (${year})` : ""} — Stream TV Series Online | Cineflex`;
    const overview = data.overview || "Stream all episodes of this TV series in HD on Cineflex with 10 fast streaming servers.";
    const metaDesc = overview.length > 155 ? `${overview.slice(0, 152)}...` : overview;
    const canonical = `${DOMAIN}/tv/${id}`;
    const posterUrl = data.poster_path ? `https://image.tmdb.org/t/p/w780${data.poster_path}` : `${DOMAIN}/assets/cinebox-logo.png`;
    const backdropUrl = data.backdrop_path ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}` : posterUrl;
    const genres = Array.isArray(data.genres) ? data.genres.map((g: any) => g.name) : [];
    const topCast = Array.isArray(data.credits?.cast) ? data.credits.cast.slice(0, 8).map((a: any) => a.name) : [];

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "TVSeries",
      name: title,
      url: canonical,
      image: posterUrl,
      description: overview,
      datePublished: data.first_air_date,
      numberOfSeasons: seasonsCount,
      genre: genres,
      ...(data.vote_count > 0 ? {
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: Number(data.vote_average.toFixed(1)),
          ratingCount: data.vote_count,
          bestRating: 10,
          worstRating: 1,
        }
      } : {}),
      actor: topCast.map((name: string) => ({ "@type": "Person", name })),
    };

    const prerenderBlock = `
    <!-- Crawlable Pre-rendered Content for Search Engines -->
    <section id="cine-seo-prerender" class="cine-seo-crawler-content" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;pointer-events:none;opacity:0;visibility:hidden;">
      <article>
        <h1>${escapeHtml(title)}${year ? ` (${year})` : ""}</h1>
        <p>${escapeHtml(overview)}</p>
        <div>
          <h2>Series Information</h2>
          <ul>
            <li><strong>First Air Date:</strong> ${escapeHtml(data.first_air_date || "N/A")}</li>
            <li><strong>Total Seasons:</strong> ${seasonsCount} (${data.number_of_episodes || "N/A"} Episodes)</li>
            <li><strong>Rating:</strong> ${data.vote_average ? `${data.vote_average.toFixed(1)}/10 (${data.vote_count} votes)` : "N/A"}</li>
            <li><strong>Genres:</strong> ${escapeHtml(genres.join(", ") || "General")}</li>
            ${topCast.length ? `<li><strong>Starring:</strong> ${escapeHtml(topCast.join(", "))}</li>` : ""}
          </ul>
        </div>
        <nav aria-label="Explore Related">
          <a href="/">Browse All Series</a>
          <a href="/collection/top-rated-series">Top Rated Series</a>
          <a href="/network/netflix">Netflix Series</a>
        </nav>
      </article>
    </section>`;

    let out = rawHtml;
    out = out.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(pageTitle)}</title>`);
    out = out.replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(metaDesc)}" />`);
    out = out.replace(/<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${escapeHtml(pageTitle)}" />`);
    out = out.replace(/<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escapeHtml(metaDesc)}" />`);

    const headExtra = `
    <link rel="canonical" href="${canonical}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:type" content="video.tv_show" />
    <meta property="og:image" content="${backdropUrl}" />
    <meta property="og:image:alt" content="${escapeHtml(title)} backdrop" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(metaDesc)}" />
    <meta name="twitter:image" content="${backdropUrl}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;

    out = out.replace("</head>", `${headExtra}\n  </head>`);
    out = out.replace('<div id="root"></div>', `${prerenderBlock}\n    <div id="root"></div>`);

    return { html: out, status: 200 };
  }

  // 4. Collections: /collection/:slug
  const colMatch = cleanPath.match(/^\/collection\/([a-zA-Z0-9_-]+)/i);
  if (colMatch) {
    const slug = colMatch[1].toLowerCase();
    const info = KNOWN_COLLECTIONS[slug] || {
      title: `${slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`,
      desc: `Explore the ${slug.replace(/-/g, " ")} curated collection on Cineflex.`,
    };

    const pageTitle = `${info.title} — Watch Movies & Series | Cineflex`;
    const canonical = `${DOMAIN}/collection/${slug}`;

    const headExtra = `
    <link rel="canonical" href="${canonical}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="${DOMAIN}/assets/cinebox-logo.png" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(info.desc)}" />`;

    let out = rawHtml;
    out = out.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(pageTitle)}</title>`);
    out = out.replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(info.desc)}" />`);
    out = out.replace(/<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${escapeHtml(pageTitle)}" />`);
    out = out.replace(/<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escapeHtml(info.desc)}" />`);
    out = out.replace("</head>", `${headExtra}\n  </head>`);

    const prerenderBlock = `
    <!-- Crawlable Pre-rendered Content -->
    <section id="cine-seo-prerender" class="cine-seo-crawler-content" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;pointer-events:none;opacity:0;visibility:hidden;">
      <article>
        <h1>${escapeHtml(info.title)}</h1>
        <p>${escapeHtml(info.desc)}</p>
        <nav aria-label="Collection Navigation">
          <a href="/">Home</a>
          <a href="/collection/trending">Trending Now</a>
          <a href="/collection/top-rated-movies">Top Rated Movies</a>
        </nav>
      </article>
    </section>`;
    out = out.replace('<div id="root"></div>', `${prerenderBlock}\n    <div id="root"></div>`);

    return { html: out, status: 200 };
  }

  // 5. Networks: /network/:slug
  const netMatch = cleanPath.match(/^\/network\/([a-zA-Z0-9_-]+)/i);
  if (netMatch) {
    const slug = netMatch[1].toLowerCase();
    const info = KNOWN_NETWORKS[slug] || {
      title: `${slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`,
      desc: `Explore trending shows and movies from ${slug.replace(/-/g, " ")} on Cineflex.`,
    };

    const pageTitle = `${info.title} — Stream Shows & Movies | Cineflex`;
    const canonical = `${DOMAIN}/network/${slug}`;

    const headExtra = `
    <link rel="canonical" href="${canonical}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="${DOMAIN}/assets/cinebox-logo.png" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(info.desc)}" />`;

    let out = rawHtml;
    out = out.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(pageTitle)}</title>`);
    out = out.replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(info.desc)}" />`);
    out = out.replace(/<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${escapeHtml(pageTitle)}" />`);
    out = out.replace(/<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escapeHtml(info.desc)}" />`);
    out = out.replace("</head>", `${headExtra}\n  </head>`);

    const prerenderBlock = `
    <!-- Crawlable Pre-rendered Content -->
    <section id="cine-seo-prerender" class="cine-seo-crawler-content" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;pointer-events:none;opacity:0;visibility:hidden;">
      <article>
        <h1>${escapeHtml(info.title)}</h1>
        <p>${escapeHtml(info.desc)}</p>
        <nav aria-label="Network Navigation">
          <a href="/">Home</a>
          <a href="/network/netflix">Netflix</a>
          <a href="/network/amazon-prime">Prime Video</a>
        </nav>
      </article>
    </section>`;
    out = out.replace('<div id="root"></div>', `${prerenderBlock}\n    <div id="root"></div>`);

    return { html: out, status: 200 };
  }

  // 6. Homepage: /
  const homeTitle = "Cineflex — Discover & Stream Movies, TV Series & Anime";
  const homeDesc = "Stream the latest trending movies and TV series in HD & 4K on Cineflex with 10 high-speed servers, daily updates, and curated OTT collections.";
  const homeCanonical = `${DOMAIN}/`;

  const webSiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Cineflex",
    url: homeCanonical,
    description: homeDesc,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${DOMAIN}/?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  const homeHeadExtra = `
    <link rel="canonical" href="${homeCanonical}" />
    <meta property="og:url" content="${homeCanonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="${DOMAIN}/assets/cinebox-logo.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(homeTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(homeDesc)}" />
    <meta name="twitter:image" content="${DOMAIN}/assets/cinebox-logo.png" />
    <script type="application/ld+json">${JSON.stringify(webSiteJsonLd)}</script>`;

  let out = rawHtml;
  out = out.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(homeTitle)}</title>`);
  out = out.replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(homeDesc)}" />`);
  out = out.replace(/<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${escapeHtml(homeTitle)}" />`);
  out = out.replace(/<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escapeHtml(homeDesc)}" />`);
  out = out.replace("</head>", `${homeHeadExtra}\n  </head>`);

  const homePrerenderBlock = `
  <!-- Crawlable Pre-rendered Content -->
  <section id="cine-seo-prerender" class="cine-seo-crawler-content" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;pointer-events:none;opacity:0;visibility:hidden;">
    <header>
      <h1>Cineflex — Free High Definition Streaming Hub</h1>
      <p>Watch trending movies, popular TV shows, anime series, and OTT network originals with 10 high-speed servers.</p>
    </header>
    <nav aria-label="Popular Categories">
      <a href="/collection/trending">Trending Now</a>
      <a href="/collection/releases">New Releases</a>
      <a href="/collection/top-rated-movies">Top Rated Movies</a>
      <a href="/collection/top-rated-series">Top Rated Series</a>
      <a href="/network/netflix">Netflix Originals</a>
      <a href="/network/amazon-prime">Prime Video</a>
      <a href="/network/jio-hotstar">Disney+ Hotstar</a>
      <a href="/network/crunchyroll">Crunchyroll Anime</a>
    </nav>
  </section>`;
  out = out.replace('<div id="root"></div>', `${homePrerenderBlock}\n    <div id="root"></div>`);

  return { html: out, status: 200 };
}
