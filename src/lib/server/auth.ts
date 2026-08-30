'use server';

import { cookies } from 'next/headers';
import crypto from 'crypto';

const PIN_SALT = 'zenith_server_salt_88f2_secret';
const SECRET_HMAC_KEY = 'zenith_session_hmac_secret_key_44b1c8';
const PIN_HASH = crypto.createHash('sha256').update('1001' + PIN_SALT).digest('hex');
const COOKIE_NAME = 'zenith_session_v1';

// In-memory rate limiting map for failed attempts
// Key: identifier (IP or fallback), Value: { count, lockedUntil }
const rateLimitMap = new Map<string, { count: number; lockedUntil: number }>();

function checkRateLimit(key: string): { allowed: boolean; waitSeconds?: number } {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record) return { allowed: true };

  if (record.lockedUntil > now) {
    const waitSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, waitSeconds };
  }

  if (record.lockedUntil <= now && record.count >= 5) {
    // Reset after lockout expires
    rateLimitMap.delete(key);
    return { allowed: true };
  }

  return { allowed: true };
}

function recordFailedAttempt(key: string) {
  const now = Date.now();
  const record = rateLimitMap.get(key) || { count: 0, lockedUntil: 0 };
  record.count += 1;

  if (record.count >= 5) {
    // Lock out for 10 minutes (600,000 ms)
    record.lockedUntil = now + 10 * 60 * 1000;
  }

  rateLimitMap.set(key, record);
}

function resetFailedAttempts(key: string) {
  rateLimitMap.delete(key);
}

// Generate signed session token
function createSessionToken(): string {
  const payload = `zenith_auth_${Date.now()}`;
  const signature = crypto.createHmac('sha256', SECRET_HMAC_KEY).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

// Validate session token
function isValidSessionToken(token: string): boolean {
  if (!token || !token.includes('.')) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;

  const expectedSignature = crypto.createHmac('sha256', SECRET_HMAC_KEY).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

/**
 * Server Action: Verify 4-digit PIN with server-side salted SHA-256 and rate limiting
 */
export async function verifyPinAction(enteredPin: string): Promise<{
  success: boolean;
  error?: string;
  waitSeconds?: number;
}> {
  const rateLimitKey = 'global_pin_attempt'; // Single-user rate limiter
  const rateCheck = checkRateLimit(rateLimitKey);

  if (!rateCheck.allowed) {
    return {
      success: false,
      error: `Too many failed attempts. Locked for ${rateCheck.waitSeconds}s.`,
      waitSeconds: rateCheck.waitSeconds,
    };
  }

  if (!enteredPin || enteredPin.length !== 4) {
    recordFailedAttempt(rateLimitKey);
    return { success: false, error: 'Invalid PIN length.' };
  }

  // Constant-time compare salted hash
  const computedHash = crypto.createHash('sha256').update(enteredPin.trim() + PIN_SALT).digest('hex');
  const isMatch = crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(PIN_HASH));

  if (!isMatch) {
    recordFailedAttempt(rateLimitKey);
    return { success: false, error: 'Invalid PIN. Access denied.' };
  }

  // Success: Reset rate limits and issue secure HttpOnly cookie
  resetFailedAttempts(rateLimitKey);
  const token = createSessionToken();

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 365 * 24 * 60 * 60, // 1 year persistence on personal devices
  });

  return { success: true };
}

/**
 * Server Action: Check if client has a valid session cookie
 */
export async function checkSessionAction(): Promise<boolean> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME);
  if (!sessionCookie?.value) return false;
  return isValidSessionToken(sessionCookie.value);
}

/**
 * Server Action: Lock device / Sign out
 */
export async function lockSessionAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Helper to ensure a server action is authenticated
 */
export async function requireAuth(): Promise<void> {
  const isAuthenticated = await checkSessionAction();
  if (!isAuthenticated) {
    throw new Error('Unauthorized: Valid session required.');
  }
}
