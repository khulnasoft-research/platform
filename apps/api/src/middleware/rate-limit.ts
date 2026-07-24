import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';

interface StoreEntry {
  count: number;
  resetAt: number;
}

interface TierConfig {
  windowMs: number;
  max: number;
}

const TIERS: Record<string, TierConfig> = {
  global: { windowMs: 60_000, max: 100 },
  auth: { windowMs: 60_000, max: 10 },
  ai: { windowMs: 60_000, max: 30 },
  api: { windowMs: 60_000, max: 60 },
  deploy: { windowMs: 60_000, max: 20 },
};

const store = new Map<string, StoreEntry>();

let storeInterval: ReturnType<typeof setInterval> | null = null;
function startCleanup(): void {
  if (storeInterval) return;
  storeInterval = setInterval(() => {
    const now = Date.now();
    for (const entryKey of store.keys()) {
      const entry = store.get(entryKey);
      if (entry && now >= entry.resetAt) {
        store.delete(entryKey);
      }
    }
  }, 60_000);
}

function getTier(path: string): string {
  if (path.startsWith('/auth')) return 'auth';
  if (path.startsWith('/ai')) return 'ai';
  if (path.startsWith('/deploy') || path.startsWith('/previews')) return 'deploy';
  return 'api';
}

function getClientIp(c: Context): string {
  return (
    c.req.header('x-forwarded-for') ||
    c.get('userId') ||
    c.req.header('x-real-ip') ||
    'unknown'
  );
}

function resolveConfig(tierKey: string): TierConfig {
  return (TIERS[tierKey] ?? TIERS.api) as TierConfig;
}

export function rateLimit(tier?: string) {
  startCleanup();

  return createMiddleware(async (c, next) => {
    const tierKey = tier ?? getTier(c.req.path);
    const config = resolveConfig(tierKey);
    const requestKey = getClientIp(c);
    const now = Date.now();

    let entry = store.get(requestKey);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + config.windowMs };
      store.set(requestKey, entry);
    }

    entry.count++;

    const remaining = Math.max(0, config.max - entry.count);
    const resetSec = Math.ceil((entry.resetAt - now) / 1000);

    c.header('x-ratelimit-limit', String(config.max));
    c.header('x-ratelimit-remaining', String(remaining));
    c.header('x-ratelimit-reset', String(resetSec));

    if (entry.count > config.max) {
      c.header('retry-after', String(resetSec));
      return c.json({
        error: 'Rate limit exceeded',
        retryAfter: resetSec,
        limit: config.max,
      }, 429);
    }

    await next();
  });
}

export function configureTier(name: string, config: Partial<TierConfig>): void {
  if (TIERS[name]) {
    TIERS[name] = { ...TIERS[name], ...config };
  }
}
