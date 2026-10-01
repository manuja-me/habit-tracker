import crypto from 'crypto';

const DEFAULT_SALT = 'zenith_server_salt_88f2_secret';
const DEFAULT_HMAC_SECRET = 'zenith_session_hmac_secret_key_44b1c8';

export const OWNER_USER_ID = '00000000-0000-0000-0000-000000000001';
export const PIN_SALT = process.env.PIN_SALT || DEFAULT_SALT;
export const SECRET_HMAC_KEY = process.env.SESSION_SECRET || process.env.SECRET_HMAC_KEY || DEFAULT_HMAC_SECRET;

if (process.env.NODE_ENV === 'production') {
  if (PIN_SALT === DEFAULT_SALT) {
    console.warn('[SECURITY WARNING] Insecure default PIN_SALT detected in production. Set PIN_SALT in environment variables.');
  }
  if (SECRET_HMAC_KEY === DEFAULT_HMAC_SECRET) {
    console.warn('[SECURITY WARNING] Insecure default SESSION_SECRET detected in production. Set SESSION_SECRET in environment variables.');
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
const rateLimitMap = new Map<string, { count: number; lockedUntil: number }>();

export function signRateLimitToken(count: number, lockedUntil: number): string {
  const payload = `${count}:${lockedUntil}`;
  const sig = crypto.createHmac('sha256', SECRET_HMAC_KEY).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function parseRateLimitToken(token?: string): { count: number; lockedUntil: number } | null {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', SECRET_HMAC_KEY).update(payload).digest('hex');
  if (
    sig.length !== expectedSig.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
  ) {
    return null;
  }
  const [countStr, lockedUntilStr] = payload.split(':');
  const count = parseInt(countStr, 10);
  const lockedUntil = parseInt(lockedUntilStr, 10);
  if (isNaN(count) || isNaN(lockedUntil)) return null;
  return { count, lockedUntil };
}

export function checkRateLimit(
  key: string,
  cookieToken?: string
): { allowed: boolean; waitSeconds?: number; currentCount: number; lockedUntil: number } {
  const now = Date.now();
  const memoryRecord = rateLimitMap.get(key) || { count: 0, lockedUntil: 0 };
  const cookieRecord = parseRateLimitToken(cookieToken) || { count: 0, lockedUntil: 0 };

  const effectiveCount = Math.max(memoryRecord.count, cookieRecord.count);
  const effectiveLockedUntil = Math.max(memoryRecord.lockedUntil, cookieRecord.lockedUntil);

  if (effectiveLockedUntil > now) {
    const waitSeconds = Math.ceil((effectiveLockedUntil - now) / 1000);
    return { allowed: false, waitSeconds, currentCount: effectiveCount, lockedUntil: effectiveLockedUntil };
  }

  // If lockout expired, reset stale count if it has passed
  if (effectiveLockedUntil <= now && effectiveLockedUntil > 0) {
    rateLimitMap.delete(key);
    return { allowed: true, currentCount: 0, lockedUntil: 0 };
  }

  return { allowed: true, currentCount: effectiveCount, lockedUntil: 0 };
}

export function recordFailedAttempt(
  key: string,
  cookieToken?: string
): { count: number; lockedUntil: number; waitSeconds: number; token: string } {
  const now = Date.now();
  const memoryRecord = rateLimitMap.get(key) || { count: 0, lockedUntil: 0 };
  const cookieRecord = parseRateLimitToken(cookieToken) || { count: 0, lockedUntil: 0 };

  const nextCount = Math.max(memoryRecord.count, cookieRecord.count) + 1;
  const backoffSec = getBackoffSeconds(nextCount);
  const lockedUntil = backoffSec > 0 ? now + backoffSec * 1000 : 0;

  const newRecord = { count: nextCount, lockedUntil };
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
  if (!token || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
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
    if (data && data.userId) {
      return {
        userId: data.userId,
        username: data.username || 'user',
        role: data.role || 'member',
        isDeactivated: Boolean(data.isDeactivated),
      };
    }
  } catch {
    return null;
  }

  return null;
}
