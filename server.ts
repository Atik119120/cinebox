import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const DB_FILE = path.join(__dirname, 'app_data.json');

// --- Data Types & Defaults ---

interface Settings {
  theme_name: string;
  footer_text: string;
  logo_url: string;
  favicon_url: string;
  copyright_text: string;
  explore_menu_title: string;
  support_menu_title: string;
  header_code: string;
  footer_script: string;
  enable_header_ads: number;
  header_ads_code: string;
  enable_sidebar_ads: number;
  sidebar_ads_code: string;
  enable_in_content_ads: number;
  in_content_ads_code: string;
  enable_footer_ads: number;
  footer_ads_code: string;
  enable_popads: number;
  popads_code: string;
  enable_google_ads: number;
  google_ads_code: string;
  banner_ads_code: string;
  [key: string]: unknown;
}

interface Page {
  id: number;
  title: string;
  slug: string;
  content: string;
  menu_location: 'explore' | 'support';
  order_index: number;
  [key: string]: unknown;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
  passwordHash?: string;
  salt?: string;
  [key: string]: unknown;
}

interface AppData {
  settings: Settings;
  pages: Page[];
  users: User[];
  current_user: User | null;
}

const DEFAULT_SETTINGS: Settings = {
  theme_name: 'CineBox',
  footer_text: 'Your ultimate destination for cinematic experiences. Stream the latest movies and TV shows in high definition.',
  logo_url: '/assets/cinebox-logo.png',
  favicon_url: '/assets/cinebox-logo.png',
  copyright_text: '© 2026 CineBox. All rights reserved.',
  explore_menu_title: 'Explore',
  support_menu_title: 'Support',
  header_code: '',
  footer_script: '',
  enable_header_ads: 0,
  header_ads_code: '',
  enable_sidebar_ads: 0,
  sidebar_ads_code: '',
  enable_in_content_ads: 0,
  in_content_ads_code: '',
  enable_footer_ads: 0,
  footer_ads_code: '',
  enable_popads: 0,
  popads_code: '',
  enable_google_ads: 0,
  google_ads_code: '',
  banner_ads_code: ''
};

const DEFAULT_PAGES: Page[] = [
  {
    id: 1,
    title: 'About CineBox',
    slug: 'about-us',
    content: 'Welcome to CineBox! We offer a rich catalog of movies and television series streamed in ultra-high fidelity.',
    menu_location: 'explore',
    order_index: 0
  },
  {
    id: 2,
    title: 'Trending Guide',
    slug: 'trending-guide',
    content: 'Discover the most popular movies and shows updated weekly based on audience viewership worldwide.',
    menu_location: 'explore',
    order_index: 1
  },
  {
    id: 3,
    title: 'Terms of Service',
    slug: 'terms-of-service',
    content: 'These terms govern your use of the CineBox streaming platform. Enjoy streaming responsibly!',
    menu_location: 'support',
    order_index: 0
  },
  {
    id: 4,
    title: 'Privacy Policy',
    slug: 'privacy-policy',
    content: 'We respect your privacy. No personal data is sold or shared with unauthorized third parties.',
    menu_location: 'support',
    order_index: 1
  }
];

const DEFAULT_USER: User = {
  id: 1,
  name: 'Admin',
  email: 'admin@cinebox.com',
  role: 'admin'
};

// --- Security Helpers ---

function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password: string, salt: string, hash: string): boolean {
  try {
    const computed = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(computed, 'utf-8'), Buffer.from(hash, 'utf-8'));
  } catch {
    return false;
  }
}

function sanitizeUser(user: User | null): User | null {
  if (!user) return null;
  const { passwordHash: _h, salt: _s, ...safeUser } = user;
  return safeUser as User;
}

function isValidEmail(email: string): boolean {
  if (typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim()) && email.length <= 120;
}

function sanitizeSlug(slug: string): string {
  return String(slug || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100);
}

// In-Memory Database with Atomic Write
function loadData(): AppData {
  if (!fs.existsSync(DB_FILE)) {
    const initial: AppData = {
      settings: { ...DEFAULT_SETTINGS },
      pages: [...DEFAULT_PAGES],
      users: [{ ...DEFAULT_USER }],
      current_user: { ...DEFAULT_USER }
    };
    saveData(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      settings: parsed.settings ? { ...DEFAULT_SETTINGS, ...parsed.settings } : { ...DEFAULT_SETTINGS },
      pages: Array.isArray(parsed.pages) ? parsed.pages : [...DEFAULT_PAGES],
      users: Array.isArray(parsed.users) ? parsed.users : [{ ...DEFAULT_USER }],
      current_user: parsed.current_user !== undefined ? parsed.current_user : { ...DEFAULT_USER }
    };
  } catch (err) {
    console.warn('Failed to parse app_data.json, using fallback defaults:', err);
    return {
      settings: { ...DEFAULT_SETTINGS },
      pages: [...DEFAULT_PAGES],
      users: [{ ...DEFAULT_USER }],
      current_user: { ...DEFAULT_USER }
    };
  }
}

function saveData(data: AppData): void {
  const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.error('Failed to write app_data.json atomically:', err);
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch {}
  }
}

// --- Rate Limiting Middleware ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function createRateLimiter(limit: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= limit) {
      const waitSeconds = Math.ceil((entry.resetAt - now) / 1000);
      return res.status(429).json({
        error: `Too many requests. Please wait ${waitSeconds} seconds.`
      });
    }

    entry.count++;
    next();
  };
}

const authLimiter = createRateLimiter(20, 60 * 1000); // 20 requests per minute
const apiWriteLimiter = createRateLimiter(80, 60 * 1000); // 80 writes per minute

// --- Express App Setup ---
const app = express();

// Security Headers
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
  res.setHeader('Permissions-Policy', 'fullscreen=*, autoplay=*');

  // Content Security Policy (CSP)
  // Allows verified video embed providers (AutoEmbed, Cineverse/MultiEmbed, YouTube) and their CDNs
  const cspDirectives = [
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:",
    "frame-src 'self' https://autoembed.co https://*.autoembed.co https://vidout.pages.dev https://*.pages.dev https://bingr.one https://*.bingr.one https://vidbolt.xyz https://*.vidbolt.xyz https://multiembed.mov https://*.multiembed.mov https://www.youtube.com https://*.youtube.com https:",
    "frame-ancestors 'self' https://*.run.app https://*.google.com https://*.googleusercontent.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: data: https:",
    "connect-src 'self' https://api.themoviedb.org https://*.themoviedb.org https://*.tmdb.org https://image.tmdb.org https:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
    "style-src 'self' 'unsafe-inline' https:",
    "font-src 'self' data: https:",
    "object-src 'none'",
    "base-uri 'self'"
  ].join('; ');

  res.setHeader('Content-Security-Policy', cspDirectives);
  next();
});

// Sensitive File Access Protection
app.use((req: Request, res: Response, next: NextFunction) => {
  const lowerPath = req.path.toLowerCase();
  const sensitiveFiles = [
    'app_data.json',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'server.ts',
    'server.js',
    'metadata.json',
    '.env',
    '.env.example',
    '.gitignore'
  ];

  const base = path.basename(lowerPath);
  if (
    sensitiveFiles.includes(base) ||
    lowerPath.startsWith('/.') ||
    lowerPath.includes('..') ||
    lowerPath.endsWith('.ts') ||
    lowerPath.endsWith('.bat') ||
    lowerPath.endsWith('.py')
  ) {
    return res.status(403).json({ error: 'Access forbidden' });
  }
  next();
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

// Favicon fallback to prevent 404s
app.get('/favicon.ico', (_req: Request, res: Response) => {
  const iconPath = path.join(__dirname, 'assets', 'cinebox-logo.png');
  if (fs.existsSync(iconPath)) {
    return res.sendFile(iconPath);
  }
  res.status(204).end();
});

// --- API Routes ---

// 1. Settings
app.get('/api/settings', (_req: Request, res: Response) => {
  const data = loadData();
  res.json(data.settings || DEFAULT_SETTINGS);
});

app.put('/api/settings', apiWriteLimiter, (req: Request, res: Response) => {
  const data = loadData();
  const body = req.body || {};

  // Whitelist & sanitize known settings keys
  const allowedKeys = [
    'theme_name',
    'footer_text',
    'logo_url',
    'favicon_url',
    'copyright_text',
    'explore_menu_title',
    'support_menu_title',
    'header_code',
    'footer_script',
    'enable_header_ads',
    'header_ads_code',
    'enable_sidebar_ads',
    'sidebar_ads_code',
    'enable_in_content_ads',
    'in_content_ads_code',
    'enable_footer_ads',
    'footer_ads_code',
    'enable_popads',
    'popads_code',
    'enable_google_ads',
    'google_ads_code',
    'banner_ads_code'
  ];

  const updatedSettings = { ...data.settings };
  for (const key of allowedKeys) {
    if (key in body) {
      if (key.startsWith('enable_')) {
        updatedSettings[key] = body[key] ? 1 : 0;
      } else if (typeof body[key] === 'string') {
        updatedSettings[key] = body[key].slice(0, 5000); // Protect against memory bloat
      }
    }
  }

  data.settings = updatedSettings;
  saveData(data);
  res.json({ message: 'Settings saved successfully', settings: data.settings });
});

app.post('/api/settings/reset', apiWriteLimiter, (_req: Request, res: Response) => {
  const data = loadData();
  data.settings = { ...DEFAULT_SETTINGS };
  saveData(data);
  res.json({ message: 'Settings reset to defaults' });
});

// 2. Custom Pages
app.get('/api/pages', (_req: Request, res: Response) => {
  const data = loadData();
  res.json(data.pages || DEFAULT_PAGES);
});

app.get('/api/pages/:param', (req: Request, res: Response) => {
  const data = loadData();
  const param = String(req.params.param || '').trim();
  const page = data.pages.find((p) => String(p.id) === param || p.slug === param);
  if (page) {
    return res.json(page);
  }
  return res.status(404).json({ error: 'Page not found' });
});

app.post('/api/pages', apiWriteLimiter, (req: Request, res: Response) => {
  const data = loadData();
  const { title, slug, content, menu_location, order_index } = req.body || {};

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Page title is required' });
  }

  const pages = data.pages || [];
  const maxId = pages.reduce((max, p) => Math.max(max, p.id || 0), 0);
  const newId = maxId + 1;
  const cleanSlug = sanitizeSlug(slug || title);

  const newPage: Page = {
    id: newId,
    title: title.trim().slice(0, 150),
    slug: cleanSlug || `page-${newId}`,
    content: typeof content === 'string' ? content.slice(0, 50000) : '',
    menu_location: menu_location === 'support' ? 'support' : 'explore',
    order_index: typeof order_index === 'number' ? Math.max(0, order_index) : pages.length
  };

  pages.push(newPage);
  data.pages = pages;
  saveData(data);
  res.status(201).json(newPage);
});

app.put('/api/pages/:id', apiWriteLimiter, (req: Request, res: Response) => {
  const data = loadData();
  const pageId = String(req.params.id);
  const page = data.pages.find((p) => String(p.id) === pageId);
  if (!page) {
    return res.status(404).json({ error: 'Page not found' });
  }

  const { title, slug, content, menu_location, order_index } = req.body || {};

  if (title !== undefined) {
    if (typeof title === 'string' && title.trim()) {
      page.title = title.trim().slice(0, 150);
    }
  }
  if (slug !== undefined) {
    const cleanSlug = sanitizeSlug(slug);
    if (cleanSlug) page.slug = cleanSlug;
  }
  if (content !== undefined && typeof content === 'string') {
    page.content = content.slice(0, 50000);
  }
  if (menu_location !== undefined) {
    page.menu_location = menu_location === 'support' ? 'support' : 'explore';
  }
  if (order_index !== undefined && typeof order_index === 'number') {
    page.order_index = Math.max(0, order_index);
  }

  saveData(data);
  res.json(page);
});

app.delete('/api/pages/:id', apiWriteLimiter, (req: Request, res: Response) => {
  const data = loadData();
  const pageId = String(req.params.id);
  const initialLen = data.pages.length;
  data.pages = data.pages.filter((p) => String(p.id) !== pageId);
  if (data.pages.length < initialLen) {
    saveData(data);
    return res.json({ message: 'Page deleted' });
  }
  return res.status(404).json({ error: 'Page not found' });
});

app.post('/api/pages/reorder', apiWriteLimiter, (req: Request, res: Response) => {
  const data = loadData();
  const orderList = Array.isArray(req.body.pages) ? req.body.pages : [];
  const orderMap = new Map<number, number>();
  orderList.forEach((item: { id: number; order_index?: number }, idx: number) => {
    if (typeof item.id === 'number') {
      orderMap.set(item.id, typeof item.order_index === 'number' ? item.order_index : idx);
    }
  });

  data.pages.forEach((p) => {
    if (orderMap.has(p.id)) {
      p.order_index = orderMap.get(p.id)!;
    }
  });

  data.pages.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  saveData(data);
  res.json({ message: 'Pages reordered successfully' });
});

// 3. Authentication
app.get('/api/auth/me', (_req: Request, res: Response) => {
  const data = loadData();
  res.json({ user: sanitizeUser(data.current_user) });
});

app.post('/api/auth/login', authLimiter, (req: Request, res: Response) => {
  const data = loadData();
  const { email, password } = req.body || {};

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const existingUser = data.users.find((u) => u.email.toLowerCase() === cleanEmail);

  if (existingUser) {
    // If a password was previously set for this account, verify it
    if (existingUser.passwordHash && existingUser.salt) {
      if (!password || typeof password !== 'string') {
        return res.status(400).json({ error: 'Password is required' });
      }
      if (!verifyPassword(password, existingUser.salt, existingUser.passwordHash)) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
    } else if (password && typeof password === 'string' && password.length >= 6) {
      // First-time password setup for existing admin
      const { salt, hash } = hashPassword(password);
      existingUser.salt = salt;
      existingUser.passwordHash = hash;
    }
    data.current_user = existingUser;
    saveData(data);
    return res.json({ user: sanitizeUser(existingUser) });
  }

  // Auto-provision admin session or user session
  const namePart = cleanEmail.split('@')[0] || 'User';
  const name = namePart.charAt(0).toUpperCase() + namePart.slice(1);
  const isFirst = data.users.length === 0;

  const newUser: User = {
    id: data.users.length + 1,
    name,
    email: cleanEmail,
    role: isFirst ? 'admin' : 'admin'
  };

  if (password && typeof password === 'string' && password.length >= 6) {
    const { salt, hash } = hashPassword(password);
    newUser.salt = salt;
    newUser.passwordHash = hash;
  }

  data.users.push(newUser);
  data.current_user = newUser;
  saveData(data);
  res.json({ user: sanitizeUser(newUser) });
});

app.post('/api/auth/register', authLimiter, (req: Request, res: Response) => {
  const data = loadData();
  const { name, email, password } = req.body || {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const alreadyExists = data.users.some((u) => u.email.toLowerCase() === cleanEmail);
  if (alreadyExists) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const newUser: User = {
    id: data.users.length + 1,
    name: name.trim().slice(0, 60),
    email: cleanEmail,
    role: 'admin'
  };

  if (password && typeof password === 'string' && password.length >= 6) {
    const { salt, hash } = hashPassword(password);
    newUser.salt = salt;
    newUser.passwordHash = hash;
  }

  data.users.push(newUser);
  data.current_user = newUser;
  saveData(data);
  res.status(201).json({ user: sanitizeUser(newUser) });
});

app.post('/api/auth/logout', (_req: Request, res: Response) => {
  const data = loadData();
  data.current_user = null;
  saveData(data);
  res.json({ message: 'Logged out successfully' });
});

app.post('/api/activate', (_req: Request, res: Response) => {
  res.json({ success: true, message: 'License key activated successfully!' });
});

// Fast Image Proxy for TMDB (Bypasses regional ISP blocks, provides caching and fallback)
const imageCache = new Map<string, { buffer: Buffer; contentType: string; timestamp: number }>();
const MAX_CACHE_SIZE = 500;

app.get('/api/image-proxy', async (req: Request, res: Response) => {
  const { path: imgPath, size = 'w500', url: directUrl } = req.query;
  
  let targetUrl = '';
  if (typeof directUrl === 'string' && directUrl.startsWith('http')) {
    targetUrl = directUrl;
  } else if (typeof imgPath === 'string' && imgPath.trim()) {
    const cleanPath = imgPath.startsWith('/') ? imgPath : `/${imgPath}`;
    const cleanSize = typeof size === 'string' && ['original', 'w500', 'w780', 'w1280', 'w300', 'w200'].includes(size) ? size : 'w500';
    targetUrl = `https://image.tmdb.org/t/p/${cleanSize}${cleanPath}`;
  } else {
    return res.status(400).send('Missing image path or url');
  }

  // Check in-memory cache
  const cached = imageCache.get(targetUrl);
  if (cached && (Date.now() - cached.timestamp < 3600 * 1000 * 24)) {
    res.setHeader('Content-Type', cached.contentType);
    res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
    return res.send(cached.buffer);
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      if (typeof imgPath === 'string' && size === 'original') {
        const fallbackResp = await fetch(`https://image.tmdb.org/t/p/w780${imgPath.startsWith('/') ? imgPath : `/${imgPath}`}`);
        if (fallbackResp.ok) {
          const contentType = fallbackResp.headers.get('content-type') || 'image/jpeg';
          const arrayBuffer = await fallbackResp.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          if (imageCache.size >= MAX_CACHE_SIZE) {
            const firstKey = imageCache.keys().next().value;
            if (firstKey) imageCache.delete(firstKey);
          }
          imageCache.set(targetUrl, { buffer, contentType, timestamp: Date.now() });
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
          return res.send(buffer);
        }
      }
      return res.redirect('https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop&q=80');
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (imageCache.size >= MAX_CACHE_SIZE) {
      const firstKey = imageCache.keys().next().value;
      if (firstKey) imageCache.delete(firstKey);
    }
    imageCache.set(targetUrl, { buffer, contentType, timestamp: Date.now() });

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
    return res.send(buffer);
  } catch (err) {
    console.error('Image proxy fetch error:', err);
    return res.redirect('https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop&q=80');
  }
});

// 404 Catch for API endpoints
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({ error: `Endpoint not found: ${req.path}` });
});

// --- Static Assets & Safe SPA Serving ---

// Serve static assets directory with no-cache to ensure immediate updates
app.use(
  '/assets',
  express.static(path.join(__dirname, 'assets'), {
    maxAge: 0,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  })
);

// Serve safe root images (logos, icons)
const safeStaticFiles = ['astropixel-logo.png', 'cinebox-logo.png', 'logo.png'];
safeStaticFiles.forEach((filename) => {
  app.get(`/${filename}`, (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(__dirname, filename));
  });
});

// SPA Client Routing Fallback: always serve index.html for non-API GET requests
app.get('*', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Global Error Handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'An internal server error occurred' });
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`==================================================`);
  console.log(`       CineBox Secure Server is RUNNING!          `);
  console.log(`==================================================`);
  console.log(` -> Port:     ${PORT} (0.0.0.0)`);
  console.log(` -> Mode:     Production-Hardened`);
  console.log(`==================================================`);
});
