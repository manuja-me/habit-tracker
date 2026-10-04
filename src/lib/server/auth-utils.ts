import crypto from 'crypto';

const DEFAULT_SALT = 'zenith_server_salt_88f2_secret';
const DEFAULT_HMAC_SECRET = 'zenith_session_hmac_secret_key_44b1c8';

export const OWNER_USER_ID = '00000000-0000-0000-0000-000000000001';
export const PIN_SALT = process.env.PIN_SALT || DEFAULT_SALT;
export const SECRET_HMAC_KEY = process.env.SESSION_SECRET || process.env.SECRET_HMAC_KEY || DEFAULT_HMAC_SECRET;

const sessionSecretEnv = process.env.SESSION_SECRET || process.env.SECRET_HMAC_KEY;
if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
  const isPinSaltInsecure =
    !process.env.PIN_SALT ||
    !process.env.PIN_SALT.trim() ||
    PIN_SALT.trim() === DEFAULT_SALT;

  const isSessionSecretInsecure =
    !sessionSecretEnv ||
    !sessionSecretEnv.trim() ||
    SECRET_HMAC_KEY.trim() === DEFAULT_HMAC_SECRET;

  if (isPinSaltInsecure || isSessionSecretInsecure) {
    throw new Error(
      'FATAL SECURITY ERROR: Insecure default PIN_SALT or SESSION_SECRET detected in production. You must define custom secrets in your environment variables.'
    );
  }
}

const rawMasterPin = process.env.APP_SECRET_PIN || process.env.MASTER_PIN || '1001';
const configuredMasterPin = rawMasterPin.trim().replace(/^["']|["']$/g, '');
export const MASTER_PIN_HASH = crypto.createHash('sha256').update(configuredMasterPin + PIN_SALT).digest('hex');
export const COOKIE_NAME = 'zenith_session_v1';

export interface SessionUser {
  userId: string;
  username: string;
  role: 'owner' | 'member';
  isDeactivated?: boolean;
}

export const RL_COOKIE_NAME = 'zenith_rl_v1';

export function getBackoffSeconds(failedCount: number): number {
  if (failedCount < 3) return 0;
  if (failedCount === 3) return 60; // 1 min lockout on 3rd failure
  if (failedCount === 4) return 300; // 5 min lockout on 4th failure
  if (failedCount === 5) return 900; // 15 min lockout on 5th failure
  if (failedCount < 10) return 1800; // 30 min lockout for 6-9 failures
  return 86400; // 24 hours lockout on 10+ failures
}

// In-memory rate limiting map for failed attempts (keyed by client identifier)
interface RateLimitRecord {
  count: number;
  lockedUntil: number;
  lastAttempt: number;
}

const RATE_LIMIT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours of inactivity resets failed attempt history
const rateLimitMap = new Map<string, RateLimitRecord>();

export function signRateLimitToken(count: number, lockedUntil: number): string {
  const payload = `${count}:${lockedUntil}`;
  const sig = crypto.createHmac('sha256', SECRET_HMAC_KEY).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function parseRateLimitToken(token?: string): { count: number; lockedUntil: number } | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  if (!payload || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', SECRET_HMAC_KEY).update(payload).digest('hex');
  if (
    sig.length !== expectedSig.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
  ) {
    return null;
  }
  const subparts = payload.split(':');
  if (subparts.length !== 2) return null;
  const count = parseInt(subparts[0], 10);
  const lockedUntil = parseInt(subparts[1], 10);
  if (isNaN(count) || isNaN(lockedUntil) || count < 0 || lockedUntil < 0) return null;
  return { count, lockedUntil };
}

export function checkRateLimit(
  key: string,
  cookieToken?: string
): { allowed: boolean; waitSeconds?: number; currentCount: number; lockedUntil: number } {
  const now = Date.now();
  const rawMemory = rateLimitMap.get(key);
  const isMemoryExpired = rawMemory?.lastAttempt ? now - rawMemory.lastAttempt > RATE_LIMIT_TTL_MS : false;
  if (isMemoryExpired) {
    rateLimitMap.delete(key);
  }
  const memoryRecord = (!rawMemory || isMemoryExpired) ? { count: 0, lockedUntil: 0 } : rawMemory;
  const cookieRecord = parseRateLimitToken(cookieToken) || { count: 0, lockedUntil: 0 };

  const effectiveCount = Math.max(memoryRecord.count, cookieRecord.count);
  const effectiveLockedUntil = Math.max(memoryRecord.lockedUntil, cookieRecord.lockedUntil);

  if (effectiveLockedUntil > now) {
    const waitSeconds = Math.ceil((effectiveLockedUntil - now) / 1000);
    return { allowed: false, waitSeconds, currentCount: effectiveCount, lockedUntil: effectiveLockedUntil };
  }

  // Lockout has ended (or never occurred). Client is allowed to make their next attempt.
  // Note: We DO NOT delete memoryRecord here so that if the next attempt fails,
  // progressive backoff escalation is maintained even if the client omits cookies.
  return { allowed: true, currentCount: effectiveCount, lockedUntil: 0 };
}

export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function normalizeIp(ip: string): string {
  let cleaned = ip.trim();
  // Strip port from IPv4 (e.g., "192.0.2.1:12345" -> "192.0.2.1")
  if (/^(\d{1,3}\.){3}\d{1,3}:\d+$/.test(cleaned)) {
    cleaned = cleaned.split(':')[0];
  }
  // Strip port and brackets from IPv6 (e.g., "[2001:db8::1]:12345" -> "2001:db8::1")
  if (cleaned.startsWith('[') && cleaned.includes(']')) {
    cleaned = cleaned.slice(1, cleaned.indexOf(']'));
  }
  return cleaned;
}

export function getClientIp(headerList: { get(name: string): string | null }): string {
  // Check Vercel trusted edge header if present
  const vercelIp = headerList.get('x-vercel-forwarded-for');
  if (vercelIp?.trim()) {
    const parts = vercelIp.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return normalizeIp(parts[parts.length - 1]);
  }

  // Right-most entry in x-forwarded-for represents the most trusted upstream hop appended by reverse proxies
  const forwarded = headerList.get('x-forwarded-for');
  if (forwarded?.trim()) {
    const parts = forwarded.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return normalizeIp(parts[parts.length - 1]);
  }

  // Fallback to direct reverse proxy real IP if x-forwarded-for was not provided
  const realIp = headerList.get('x-real-ip');
  if (realIp?.trim()) return normalizeIp(realIp.trim());

  return '127.0.0.1';
}

function pruneStaleRateLimits(now: number) {
  if (rateLimitMap.size > 2000) {
    for (const [k, v] of rateLimitMap.entries()) {
      const lastTime = v.lastAttempt || v.lockedUntil || 0;
      if (lastTime > 0 && now - lastTime > RATE_LIMIT_TTL_MS) {
        rateLimitMap.delete(k);
      }
    }
    if (rateLimitMap.size > 10000) {
      const keysToDelete = Array.from(rateLimitMap.keys()).slice(0, 2000);
      for (const k of keysToDelete) {
        rateLimitMap.delete(k);
      }
    }
  }
}

export function recordFailedAttempt(
  key: string,
  cookieToken?: string
): { count: number; lockedUntil: number; waitSeconds: number; token: string } {
  const now = Date.now();
  pruneStaleRateLimits(now);

  const rawMemory = rateLimitMap.get(key);
  const isMemoryExpired = rawMemory?.lastAttempt ? now - rawMemory.lastAttempt > RATE_LIMIT_TTL_MS : false;
  const memoryRecord = (!rawMemory || isMemoryExpired) ? { count: 0, lockedUntil: 0 } : rawMemory;
  const cookieRecord = parseRateLimitToken(cookieToken) || { count: 0, lockedUntil: 0 };

  const nextCount = Math.max(memoryRecord.count, cookieRecord.count) + 1;
  const backoffSec = getBackoffSeconds(nextCount);
  const lockedUntil = backoffSec > 0 ? now + backoffSec * 1000 : 0;

  const newRecord: RateLimitRecord = { count: nextCount, lockedUntil, lastAttempt: now };
  rateLimitMap.set(key, newRecord);

  const token = signRateLimitToken(nextCount, lockedUntil);
  return { count: nextCount, lockedUntil, waitSeconds: backoffSec, token };
}

export function resetFailedAttempts(key: string) {
  rateLimitMap.delete(key);
}

export function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin.trim() + PIN_SALT).digest('hex');
}

export function createSessionToken(user: SessionUser): string {
  const payload = Buffer.from(
    JSON.stringify({
      userId: user.userId,
      username: user.username,
      role: user.role,
      isDeactivated: Boolean(user.isDeactivated),
      ts: Date.now(),
    })
  ).toString('base64url');

  const signature = crypto.createHmac('sha256', SECRET_HMAC_KEY).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

export function getSessionUserFromToken(token: string): SessionUser | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!payload || !signature) return null;

  const expectedSignature = crypto.createHmac('sha256', SECRET_HMAC_KEY).update(payload).digest('hex');
  if (
    signature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (!data || typeof data !== 'object') return null;

    const now = Date.now();
    // Validate session expiration and timestamp validity (max 7 days lifetime, allow 60s future clock skew)
    if (
      typeof data.ts !== 'number' ||
      !Number.isFinite(data.ts) ||
      data.ts > now + 60000 ||
      now - data.ts > SESSION_MAX_AGE_MS
    ) {
      return null;
    }

    if (data.userId && typeof data.userId === 'string' && data.userId.trim().length > 0) {
      return {
        userId: data.userId,
        username: typeof data.username === 'string' ? data.username : 'user',
        role: data.role === 'owner' ? 'owner' : 'member',
        isDeactivated: Boolean(data.isDeactivated),
      };
    }
  } catch {
    return null;
  }

  return null;
}
