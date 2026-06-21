/*
 * prerender.mjs — static SEO prerendering for JustFlixMovies
 *
 * Reads every /movie/* and /tv/* URL from sitemap2.xml, fetches its TMDB
 * details, and writes a static HTML file per route (e.g. movie/obsession-1339713.html).
 * Each generated page has a UNIQUE <title>, meta description, self-referential
 * canonical, Open Graph/Twitter tags, JSON-LD, and a visible content block —
 * so Google can index real content on the first crawl instead of waiting for
 * (and depending on) client-side rendering.
 *
 * The same app scripts are kept, so when a real visitor lands the SPA boots,
 * opens the player modal over the prerendered content. Cloudflare Pages serves
 * these static files in preference to the `/* -> /index.html` catch-all.
 *
 * Usage:  node scripts/prerender.mjs
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const API_KEY = 'f7969edc09425407417da271f5077c89';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';
const SITE = 'https://justflixmovies.pages.dev';
const CONCURRENCY = 6;

// ---- helpers ----
const escapeHtml = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const truncate = (s = '', n = 155) => {
  const t = String(s).replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  return t.slice(0, t.lastIndexOf(' ', n) > 0 ? t.lastIndexOf(' ', n) : n).trim() + '…';
};

const yearOf = (d) => (d ? new Date(d).getFullYear() : null);

function runtimeLabel(item, type) {
  if (type === 'movie' && item.runtime) {
    const h = Math.floor(item.runtime / 60);
    const m = item.runtime % 60;
    return h ? `${h}h ${m}m` : `${m}m`;
  }
  if (type === 'tv' && item.number_of_seasons) {
    return `${item.number_of_seasons} season${item.number_of_seasons > 1 ? 's' : ''}`;
  }
  return '';
}

// Replace the first match of `re` in `str` with `replacement` (no-op if absent).
const sub = (str, re, replacement) => (re.test(str) ? str.replace(re, () => replacement) : str);

function buildPage(template, { type, path, item }) {
  const title = item.title || item.name || 'Untitled';
  const year = yearOf(item.release_date || item.first_air_date);
  const typeLabel = type === 'tv' ? 'TV Series' : 'Movie';
  const genres = (item.genres || []).map((g) => g.name).join(', ');
  const rating = item.vote_average ? item.vote_average.toFixed(1) : null;
  const runtime = runtimeLabel(item, type);
  const poster = item.poster_path ? `${IMG_URL}${item.poster_path}` : '/placeholder.jpg';
  const url = `${SITE}${path}`;
  const overview = item.overview || `Watch ${title} online free in HD on JustFlixMovies.`;

  const pageTitle = `${title}${year ? ` (${year})` : ''} - Watch Free in HD | JustFlixMovies`;
  const metaDesc = truncate(
    `Watch ${title}${year ? ` (${year})` : ''} online free in HD. ${overview}`,
    160
  );

  const metaLine = [typeLabel, genres, rating ? `⭐ ${rating}/10` : '', runtime]
    .filter(Boolean)
    .join(' · ');

  // JSON-LD for crawlers that don't execute JS
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': type === 'tv' ? 'TVSeries' : 'Movie',
    name: title,
    description: overview,
    image: poster,
    url,
    datePublished: item.release_date || item.first_air_date || undefined,
    genre: (item.genres || []).map((g) => g.name),
  };
  if (rating && item.vote_count) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: item.vote_average,
      ratingCount: item.vote_count,
      bestRating: 10,
      worstRating: 0,
    };
  }

  const detailSection = `<section class="detail-seo" aria-label="${escapeHtml(title)} details">
    <div class="detail-seo-inner">
      <img class="detail-seo-poster" src="${escapeHtml(poster)}" alt="${escapeHtml(title)} poster" width="300" height="450" />
      <div class="detail-seo-body">
        <h1>${escapeHtml(title)}${year ? ` <span>(${year})</span>` : ''}</h1>
        ${metaLine ? `<p class="detail-seo-meta">${escapeHtml(metaLine)}</p>` : ''}
        <p class="detail-seo-overview">${escapeHtml(overview)}</p>
        <p class="detail-seo-cta">Stream ${escapeHtml(title)} online free in HD — no signup required, on JustFlixMovies.</p>
      </div>
    </div>
  </section>`;

  let html = template;
  html = sub(html, /<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(pageTitle)}</title>`);
  html = sub(html, /<meta name="description" content="[\s\S]*?">/, `<meta name="description" content="${escapeHtml(metaDesc)}">`);
  html = sub(html, /<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${escapeHtml(url)}">`);
  html = sub(html, /<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escapeHtml(pageTitle)}">`);
  html = sub(html, /<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${escapeHtml(metaDesc)}">`);
  html = sub(html, /<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${escapeHtml(url)}">`);
  html = sub(html, /<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${escapeHtml(poster)}">`);
  html = sub(html, /<meta property="og:type" content="[^"]*">/, `<meta property="og:type" content="video.${type === 'tv' ? 'tv_show' : 'movie'}">`);
  html = sub(html, /<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${escapeHtml(pageTitle)}">`);
  html = sub(html, /<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${escapeHtml(metaDesc)}">`);
  html = sub(html, /<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${escapeHtml(poster)}">`);

  // Inject Movie/TVSeries JSON-LD just before </head>
  html = sub(
    html,
    /<\/head>/,
    `  <script type="application/ld+json">\n  ${JSON.stringify(jsonLd)}\n  </script>\n</head>`
  );

  // Swap the generic sr-only H1 for the visible, unique detail block
  html = sub(html, /<h1 class="sr-only">[\s\S]*?<\/h1>/, detailSection);

  return html;
}

async function fetchDetails(type, id) {
  const res = await fetch(`${BASE_URL}/${type}/${id}?api_key=${API_KEY}`);
  if (!res.ok) throw new Error(`TMDB ${res.status} for ${type}/${id}`);
  return res.json();
}

async function run() {
  const sitemap = await readFile(resolve(ROOT, 'sitemap2.xml'), 'utf8');
  const template = await readFile(resolve(ROOT, 'index.html'), 'utf8');

  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  const routes = [];
  let skipped = 0;
  for (const loc of locs) {
    // `.*` (not `.+`) so titles that slugify to empty — e.g. non-ASCII-only
    // names like "나는 신혼 너는 재혼" → /movie/-1604143 — still parse and render.
    const m = loc.match(/\/(movie|tv)\/(.*)-(\d+)\/?$/);
    if (!m) {
      // Warn only for URLs that look like detail pages but failed to parse,
      // so dropped sitemap entries aren't lost silently. The homepage and
      // other non-detail URLs are skipped quietly.
      if (/\/(movie|tv)\//.test(loc)) {
        console.warn(`  ! skipped unparseable detail URL: ${loc}`);
        skipped++;
      }
      continue;
    }
    const [, type, , id] = m;
    const path = new URL(loc).pathname.replace(/\/$/, '');
    routes.push({ type, id, path });
  }

  console.log(
    `Found ${routes.length} detail routes in sitemap${skipped ? ` (${skipped} unparseable skipped)` : ''}. Generating…`
  );

  let ok = 0;
  let fail = 0;
  const queue = [...routes];

  async function worker() {
    while (queue.length) {
      const route = queue.shift();
      try {
        const item = await fetchDetails(route.type, route.id);
        const html = buildPage(template, { type: route.type, path: route.path, item });
        const outPath = resolve(ROOT, `${route.path.replace(/^\//, '')}.html`);
        await mkdir(dirname(outPath), { recursive: true });
        await writeFile(outPath, html, 'utf8');
        ok++;
        process.stdout.write('.');
      } catch (err) {
        fail++;
        console.warn(`\n  ✗ ${route.path}: ${err.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`\nDone. Generated ${ok} pages, ${fail} failed.`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
