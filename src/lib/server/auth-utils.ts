import crypto from 'crypto';

export const OWNER_USER_ID = '00000000-0000-0000-0000-000000000001';
export const PIN_SALT = process.env.PIN_SALT || 'zenith_server_salt_88f2_secret';
export const SECRET_HMAC_KEY = process.env.SESSION_SECRET || process.env.SECRET_HMAC_KEY || 'zenith_session_hmac_secret_key_44b1c8';
const rawMasterPin = process.env.APP_SECRET_PIN || process.env.MASTER_PIN || '1001';
const configuredMasterPin = rawMasterPin.trim().replace(/^["']|["']$/g, '');
export const MASTER_PIN_HASH = crypto.createHash('sha256').update(configuredMasterPin + PIN_SALT).digest('hex');
export const COOKIE_NAME = 'zenith_session_v1';

export interface SessionUser {
  userId: string;
  username: string;
  role: 'owner' | 'member';
}

// In-memory rate limiting map for failed attempts
const rateLimitMap = new Map<string, { count: number; lockedUntil: number }>();

export function checkRateLimit(key: string): { allowed: boolean; waitSeconds?: number } {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record) return { allowed: true };

  if (record.lockedUntil > now) {
    const waitSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, waitSeconds };
  }

  if (record.lockedUntil <= now && record.count >= 5) {
    rateLimitMap.delete(key);
    return { allowed: true };
  }

  return { allowed: true };
}

export function recordFailedAttempt(key: string) {
  const now = Date.now();
  const record = rateLimitMap.get(key) || { count: 0, lockedUntil: 0 };
  record.count += 1;

  if (record.count >= 5) {
    record.lockedUntil = now + 10 * 60 * 1000; // 10 min lockout
  }

  rateLimitMap.set(key, record);
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
      };
    }
  } catch {
    if (payload.startsWith('zenith_auth_')) {
      return {
        userId: OWNER_USER_ID,
        username: 'owner',
        role: 'owner',
      };
    }
  }

  return null;
}
