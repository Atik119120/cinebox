/**
 * Cinebox Enterprise Web Application Firewall (WAF) & Security Shield
 * Provides real-time attack blocking, rate limiting, security headers, and CDN caching.
 */

// In-memory sliding window rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 150; // Max requests per window
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window

// Periodic cleanup of expired rate limit entries to prevent memory leaks
let lastCleanup = Date.now();
function cleanupRateLimits() {
  const now = Date.now();
  if (now - lastCleanup < 30000) return;
  lastCleanup = now;
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}

// Blocked malicious scanner User-Agents
const MALICIOUS_USER_AGENTS = [
  /sqlmap/i,
  /nikto/i,
  /acunetix/i,
  /masscan/i,
  /wpscan/i,
  /dirbuster/i,
  /nmap/i,
  /zgrab/i,
  /gobuster/i,
  /havij/i,
  /pangolin/i,
  /netsparker/i,
  /vuln/i,
];

// Blocked sensitive file probes and exploit paths
const MALICIOUS_PATH_PATTERNS = [
  // Sensitive files & environment variables
  /\/\.(env|git|svn|hg|bzr|htaccess|htpasswd|aws|docker)/i,
  /\/(id_rsa|id_dsa|authorized_keys|known_hosts)/i,
  /\/(web\.config|phpinfo\.php|eval-stdin\.php)/i,
  // CMS & Server Exploits
  /\/(wp-admin|wp-login|xmlrpc\.php|wp-content|wp-includes)/i,
  /\/(phpmyadmin|pma|myadmin|adminer)/i,
  /\/(cgi-bin|solr|autodiscover|\.well-known\/security\.txt\/..)/i,
  // Path traversal
  /(\.\.[\/\\]|%2e%2e[\/\\]|\.\.%2f|\.\.%5c)/i,
  // Shell & command injection
  /(\/bin\/sh|\/bin\/bash|cmd\.exe|powershell\.exe)/i,
  /\/etc\/(passwd|shadow|hosts)/i,
];

// SQL Injection & XSS query attack patterns
const MALICIOUS_QUERY_PATTERNS = [
  /(union[\s+]+select|select[\s+]+from|concat\s*\(|group_concat|information_schema)/i,
  /(sleep\s*\(|benchmark\s*\(|waitfor\s+delay)/i,
  /(<script\b[^>]*>|javascript:\s*alert|<svg[\s\S]*?onload=)/i,
  /(\bexec\s*\(|\bpassthru\s*\(|\bshell_exec\s*\(|\bsystem\s*\()/i,
];

/**
 * Extracts client IP from incoming request headers
 */
export function getClientIp(request: Request): string {
  const headers = request.headers;
  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  return "127.0.0.1";
}

/**
 * Validates request against WAF rules:
 * - Anti-DDoS / Rate Limiting
 * - Malicious User-Agent blocking
 * - Exploit & probe path blocking
 * - SQL Injection & XSS attack blocking in query strings
 */
export function inspectFirewall(request: Request): Response | null {
  cleanupRateLimits();

  const url = new URL(request.url);
  const pathname = decodeURIComponent(url.pathname);
  const search = url.search;
  const userAgent = request.headers.get("user-agent") || "";
  const ip = getClientIp(request);
  const now = Date.now();

  // 1. Rate Limiting Protection (Anti-DDoS)
  let rate = rateLimitMap.get(ip);
  if (!rate || now > rate.resetAt) {
    rate = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(ip, rate);
  } else {
    rate.count++;
  }

  if (rate.count > RATE_LIMIT_MAX) {
    return new Response(
      JSON.stringify({
        error: "Too Many Requests",
        message: "Your IP has exceeded the allowed request rate limit. Please try again in 1 minute.",
        status: 429,
        shield: "Cinebox-WAF-RateLimiter",
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Retry-After": "60",
          "X-Firewall-Status": "Rate-Limited",
        },
      },
    );
  }

  // 2. Bad Bot & Malicious Scanner Protection
  if (userAgent) {
    for (const pattern of MALICIOUS_USER_AGENTS) {
      if (pattern.test(userAgent)) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message: "Automated vulnerability scanners and malicious crawlers are prohibited.",
            status: 403,
            shield: "Cinebox-WAF-BotShield",
          }),
          {
            status: 403,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "X-Firewall-Status": "Blocked-Bad-Bot",
            },
          },
        );
      }
    }
  }

  // 3. Sensitive Probes, Path Traversal & Exploit Protection
  for (const pattern of MALICIOUS_PATH_PATTERNS) {
    if (pattern.test(pathname)) {
      return new Response(
        JSON.stringify({
          error: "Forbidden",
          message: "Malicious request path blocked by Cinebox Web Application Firewall.",
          status: 403,
          shield: "Cinebox-WAF-PathShield",
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "X-Firewall-Status": "Blocked-Exploit-Probe",
          },
        },
      );
    }
  }

  // 4. SQL Injection & XSS Attack Query Protection
  if (search) {
    const decodedSearch = decodeURIComponent(search);
    for (const pattern of MALICIOUS_QUERY_PATTERNS) {
      if (pattern.test(decodedSearch)) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message: "Malicious SQL/Script payload detected in request parameters.",
            status: 403,
            shield: "Cinebox-WAF-PayloadShield",
          }),
          {
            status: 403,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "X-Firewall-Status": "Blocked-Injection-Attack",
            },
          },
        );
      }
    }
  }

  return null; // Passed firewall inspection
}

/**
 * Standard Content Security Policy allowing required media, TMDB APIs, Cloudflare CDN, fonts, and streaming players
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
  "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:",
  "img-src 'self' data: blob: https://image.tmdb.org https://images.unsplash.com https://*.tmdb.org https://*.supabase.co https://*.cloudflare.com https://*.googleusercontent.com https://*.githubusercontent.com https://upload.wikimedia.org https://*.wikimedia.org",
  "media-src 'self' blob: https:",
  "connect-src 'self' https://api.themoviedb.org https://image.tmdb.org https://*.supabase.co https://ipapi.co https://*.cloudflare.com https://api.ipwho.is",
  "frame-src 'self' https:",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

/**
 * Injects all standard Enterprise HTTP Security Headers and CDN Cache Headers
 */
export function enhanceResponseSecurity(response: Response, requestUrl: string): Response {
  const url = new URL(requestUrl);
  const pathname = url.pathname;
  const headers = new Headers(response.headers);

  // 1. Core HTTP Security Headers
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );
  headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload",
  );
  headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  headers.set("X-XSS-Protection", "1; mode=block");
  headers.set("X-Firewall-Status", "Protected-Active");
  headers.set("X-Security-Engine", "Cinebox-Shield-v2");

  // Only inject CSP for HTML responses or root/collection/watch routes
  const contentType = headers.get("content-type") || "";
  if (contentType.includes("text/html") || pathname === "/" || !pathname.includes(".")) {
    if (!headers.has("Content-Security-Policy")) {
      headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
    }
  }

  // 2. Global Edge CDN & Cache Acceleration Headers
  const isStaticAsset =
    pathname.startsWith("/assets/") ||
    /\.(js|css|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|eot)$/i.test(pathname);

  if (isStaticAsset) {
    // 1 year immutable cache for static assets on browser & CDN edge
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("CDN-Cache-Control", "public, max-age=31536000, immutable");
    headers.set("Cloudflare-CDN-Cache-Control", "public, max-age=31536000, immutable");
  } else if (pathname.startsWith("/api/")) {
    // No-store for sensitive dynamic APIs
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  } else {
    // Fast revalidation with stale-while-revalidate for SPA and dynamic routes
    headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    headers.set("CDN-Cache-Control", "max-age=60, stale-while-revalidate=300");
    headers.set("Cloudflare-CDN-Cache-Control", "max-age=60, stale-while-revalidate=300");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
