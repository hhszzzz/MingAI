/**
 * Network safety middleware for the public MCP runtime.
 *
 * The service deliberately has no user authentication. Host/origin validation,
 * IP quotas, and bounded in-memory maps protect the anonymous endpoint.
 */
import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';

const RATE_WINDOW_MS = 60_000;
const CLEANUP_INTERVAL_MS = 5 * 60_000;
const MAX_RATE_LIMIT_ENTRIES = 50_000;

export function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getClientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function asyncRequestHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    try {
      void Promise.resolve(handler(req, res, next)).catch(next);
    } catch (error) {
      next(error);
    }
  };
}

export const mcpErrorMiddleware: ErrorRequestHandler = (error, _req, res, next) => {
  console.error('[MCP] Unhandled request error:', error);
  if (res.headersSent) {
    next(error);
    return;
  }

  const candidateStatus = typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status?: unknown }).status)
    : 500;
  const isBadRequest = candidateStatus >= 400 && candidateStatus < 500;
  res.status(isBadRequest ? candidateStatus : 500).json({
    jsonrpc: '2.0',
    error: {
      code: isBadRequest ? -32700 : -32603,
      message: isBadRequest ? 'Invalid request body' : 'Internal server error',
    },
    id: null,
  });
};

export function originValidationMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (!origin) return next();

  const allowed = (process.env.MCP_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (allowed.length === 0) {
    return res.status(403).json({ error: 'Origin allowlist not configured' });
  }
  if (allowed.includes('*') || allowed.includes(origin)) {
    return next();
  }
  return res.status(403).json({ error: 'Origin not allowed' });
}

export function hostValidationMiddleware(req: Request, res: Response, next: NextFunction) {
  const allowed = (process.env.MCP_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (allowed.length === 0) return next();
  const host = req.headers.host;
  if (host && allowed.includes(host)) return next();
  return res.status(403).json({ error: 'Host not allowed' });
}

const rateLimitEntries = new Map<string, { count: number; resetAt: number }>();
let lastRateLimitCleanup = Date.now();

function cleanupRateLimitEntries(now: number) {
  if (now - lastRateLimitCleanup < CLEANUP_INTERVAL_MS && rateLimitEntries.size < MAX_RATE_LIMIT_ENTRIES) {
    return;
  }
  lastRateLimitCleanup = now;
  for (const [key, entry] of rateLimitEntries) {
    if (entry.resetAt <= now) rateLimitEntries.delete(key);
  }
}

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  cleanupRateLimitEntries(now);

  const limit = readPositiveIntEnv('MCP_RATE_LIMIT_PER_MINUTE', 120);
  const key = `${getClientIp(req)}:${req.method}`;
  const current = rateLimitEntries.get(key);

  if (!current || current.resetAt <= now) {
    if (rateLimitEntries.size >= MAX_RATE_LIMIT_ENTRIES) {
      return res.status(503).json({ error: 'Rate limiter at capacity' });
    }
    rateLimitEntries.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return next();
  }

  if (current.count >= limit) {
    res.setHeader('Retry-After', Math.max(1, Math.ceil((current.resetAt - now) / 1000)));
    return res.status(429).json({ error: 'Too many requests' });
  }

  current.count += 1;
  return next();
}

const sseConnectionsByIp = new Map<string, number>();

export function sseConnectionLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'GET') return next();

  const ip = getClientIp(req);
  const limit = readPositiveIntEnv('MCP_MAX_SSE_PER_IP', 3);
  const current = sseConnectionsByIp.get(ip) ?? 0;
  if (current >= limit) {
    return res.status(429).json({ error: 'Too many SSE connections' });
  }

  sseConnectionsByIp.set(ip, current + 1);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    const nextCount = (sseConnectionsByIp.get(ip) ?? 1) - 1;
    if (nextCount <= 0) sseConnectionsByIp.delete(ip);
    else sseConnectionsByIp.set(ip, nextCount);
  };
  res.once('close', release);
  res.once('finish', release);
  return next();
}
