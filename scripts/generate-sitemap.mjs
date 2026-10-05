import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const DOMAIN = 'https://cineflex.eu.cc';
const TMDB_API_KEY = '05902896074695709d7763505bb88b4d';
const TMDB_BASE = 'https://api.themoviedb.org/3';

async function fetchTmdb(endpoint) {
  try {
    const url = `${TMDB_BASE}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${TMDB_API_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`[Sitemap] Failed to fetch TMDB ${endpoint}:`, err.message);
    return null;
  }
}

async function generateSitemap() {
  console.log('[Sitemap] Generating canonical sitemap.xml for', DOMAIN);
  const now = new Date().toISOString().split('T')[0];

  const urls = [];

  // 1. Core Homepage
  urls.push({
    loc: `${DOMAIN}/`,
    lastmod: now,
    changefreq: 'daily',
    priority: '1.0'
  });

  // 2. Curated Collections
  const collections = [
    'trending',
    'releases',
    'top-rated-movies',
    'top-rated-series',
    'action-movies',
    'sci-fi-movies',
    'horror-movies',
    'animation-movies',
    'k-drama',
    'anime-series',
    'airing-today'
  ];
  for (const c of collections) {
    urls.push({
      loc: `${DOMAIN}/collection/${c}`,
      lastmod: now,
      changefreq: 'daily',
      priority: '0.8'
    });
  }

  // 3. Official OTT Networks
  const networks = [
    'netflix',
    'amazon-prime',
    'jio-hotstar',
    'jiocinema',
    'crunchyroll',
    'sony-liv',
    'zee5',
    'mx-player'
  ];
  for (const n of networks) {
    urls.push({
      loc: `${DOMAIN}/network/${n}`,
      lastmod: now,
      changefreq: 'weekly',
      priority: '0.8'
    });
  }

  // 4. Fetch Indexable Popular & Trending Movies
  const movieIds = new Set();
  const movieEndpoints = [
    '/trending/movie/week?page=1',
    '/trending/movie/week?page=2',
    '/movie/popular?page=1',
    '/movie/popular?page=2',
    '/movie/top_rated?page=1'
  ];

  for (const ep of movieEndpoints) {
    const data = await fetchTmdb(ep);
    if (data && Array.isArray(data.results)) {
      for (const item of data.results) {
        if (item.id && !movieIds.has(item.id)) {
          movieIds.add(item.id);
          const releaseDate = item.release_date || now;
          urls.push({
            loc: `${DOMAIN}/movie/${item.id}`,
            lastmod: releaseDate.length === 10 ? releaseDate : now,
            changefreq: 'weekly',
            priority: '0.7',
            title: item.title,
            image: item.poster_path ? `https://image.tmdb.org/t/p/w780${item.poster_path}` : undefined
          });
        }
      }
    }
  }

  // 5. Fetch Indexable Popular & Trending TV Shows
  const tvIds = new Set();
  const tvEndpoints = [
    '/trending/tv/week?page=1',
    '/trending/tv/week?page=2',
    '/tv/popular?page=1',
    '/tv/popular?page=2',
    '/tv/top_rated?page=1'
  ];

  for (const ep of tvEndpoints) {
    const data = await fetchTmdb(ep);
    if (data && Array.isArray(data.results)) {
      for (const item of data.results) {
        if (item.id && !tvIds.has(item.id)) {
          tvIds.add(item.id);
          const firstAirDate = item.first_air_date || now;
          urls.push({
            loc: `${DOMAIN}/tv/${item.id}`,
            lastmod: firstAirDate.length === 10 ? firstAirDate : now,
            changefreq: 'weekly',
            priority: '0.7',
            title: item.name,
            image: item.poster_path ? `https://image.tmdb.org/t/p/w780${item.poster_path}` : undefined
          });
        }
      }
    }
  }

  // Build XML String
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
  xml += `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

  for (const item of urls) {
    xml += `  <url>\n`;
    xml += `    <loc>${item.loc}</loc>\n`;
    xml += `    <lastmod>${item.lastmod}</lastmod>\n`;
    xml += `    <changefreq>${item.changefreq}</changefreq>\n`;
    xml += `    <priority>${item.priority}</priority>\n`;
    if (item.image) {
      xml += `    <image:image>\n`;
      xml += `      <image:loc>${item.image}</image:loc>\n`;
      if (item.title) {
        const cleanTitle = item.title.replace(/[<>&'"]/g, (c) => {
          switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
          }
        });
        xml += `      <image:title>${cleanTitle}</image:title>\n`;
      }
      xml += `    </image:image>\n`;
    }
    xml += `  </url>\n`;
  }

  xml += `</urlset>\n`;

  const publicDir = path.join(repoRoot, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const sitemapPath = path.join(publicDir, 'sitemap.xml');
  fs.writeFileSync(sitemapPath, xml, 'utf8');

  console.log(`[Sitemap] Generated ${urls.length} indexable URLs into ${sitemapPath}`);
  return urls.length;
}

generateSitemap().catch((err) => {
  console.error('[Sitemap] Error generating sitemap:', err);
  process.exit(1);
});
