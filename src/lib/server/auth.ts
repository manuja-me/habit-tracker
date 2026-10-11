'use server';

import { cookies, headers } from 'next/headers';
import crypto from 'crypto';
import { getServerSupabase } from './supabase';
import { purgeUserData } from './user-management';
import {
  OWNER_USER_ID,
  COOKIE_NAME,
  RL_COOKIE_NAME,
  SECRET_HMAC_KEY,
  SessionUser,
  getBackoffSeconds,
  checkRateLimit,
  recordFailedAttempt,
  resetFailedAttempts,
  signRateLimitToken,
  hashPinScrypt,
  isScryptHash,
  verifyPinHash,
  verifyMasterPin,
  isValidPinFormat,
  createSessionToken,
  getSessionUserFromToken,
  getClientIp,
  isOwnerUser,
} from './auth-utils';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

const RATE_LIMIT_TTL_MS = 24 * 60 * 60 * 1000;

async function getRateLimitContext() {
  const headerList = await headers();
  const clientIp = getClientIp(headerList);
  const rateLimitKey = `pin_rl_${clientIp}`;
  const cookieStore = await cookies();
  const rlCookie = cookieStore.get(RL_COOKIE_NAME)?.value;
  let rateCheck = checkRateLimit(rateLimitKey, rlCookie);

  // Query persistent DB-backed rate limit (survives serverless cold starts & cookie clearing)
  const supabase = getServerSupabase();
  if (supabase) {
    try {
      const { data } = await supabase
        .from('auth_rate_limits')
        .select('count, locked_until, last_attempt')
        .eq('key', rateLimitKey)
        .maybeSingle();

      if (data) {
        const now = Date.now();
        const lastAttemptMs = data.last_attempt ? new Date(data.last_attempt).getTime() : 0;
        const isExpired = lastAttemptMs > 0 && now - lastAttemptMs > RATE_LIMIT_TTL_MS;
        if (!isExpired) {
          const dbCount = Number(data.count) || 0;
          const dbLockedUntil = data.locked_until ? new Date(data.locked_until).getTime() : 0;
          const effectiveCount = Math.max(rateCheck.currentCount, dbCount);
          const effectiveLockedUntil = Math.max(rateCheck.lockedUntil, dbLockedUntil);
          if (effectiveLockedUntil > now) {
            rateCheck = {
              allowed: false,
              waitSeconds: Math.ceil((effectiveLockedUntil - now) / 1000),
              currentCount: effectiveCount,
              lockedUntil: effectiveLockedUntil,
            };
          } else {
            rateCheck = {
              allowed: true,
              currentCount: effectiveCount,
              lockedUntil: 0,
            };
          }
        }
      }
    } catch {
      // Graceful fallback if auth_rate_limits table is not migrated yet
    }
  }

  return { rateLimitKey, cookieStore, rlCookie, rateCheck };
}

async function recordAndPersistFailure(
  rateLimitKey: string,
  rlCookie: string | undefined,
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  priorCount = 0
) {
  const localFail = recordFailedAttempt(rateLimitKey, rlCookie);
  const nextCount = Math.max(localFail.count, priorCount + 1);
  const waitSeconds = getBackoffSeconds(nextCount);
  const now = Date.now();
  const lockedUntil = waitSeconds > 0 ? now + waitSeconds * 1000 : 0;
  const token = signRateLimitToken(nextCount, lockedUntil);

  cookieStore.set(RL_COOKIE_NAME, token, {
    ...COOKIE_OPTS,
    maxAge: Math.max(86400, waitSeconds || 3600),
  });

  const supabase = getServerSupabase();
  if (supabase) {
    try {
      await supabase.from('auth_rate_limits').upsert({
        key: rateLimitKey,
        count: nextCount,
        locked_until: lockedUntil > 0 ? new Date(lockedUntil).toISOString() : null,
        last_attempt: new Date(now).toISOString(),
      });
    } catch {
      // Ignore if auth_rate_limits table is not migrated yet
    }
  }

  return { count: nextCount, lockedUntil, waitSeconds, token };
}

async function clearRateLimits(
  rateLimitKey: string,
  cookieStore: Awaited<ReturnType<typeof cookies>>
) {
  resetFailedAttempts(rateLimitKey);
  cookieStore.delete(RL_COOKIE_NAME);
  const supabase = getServerSupabase();
  if (supabase) {
    try {
      await supabase.from('auth_rate_limits').delete().eq('key', rateLimitKey);
    } catch {}
  }
}

/**
 * Server Action: Verify 6-digit PIN (or legacy 4-digit PIN for zero-data-loss migration)
 */
export async function verifyPinAction(enteredPin: string): Promise<{
  success: boolean;
  error?: string;
  waitSeconds?: number;
  user?: SessionUser;
  isLegacyPin?: boolean;
  requiresReactivation?: boolean;
  deactivatedAt?: string;
  remainingMs?: number;
}> {
  try {
    const { rateLimitKey, cookieStore, rlCookie, rateCheck } = await getRateLimitContext();

    if (!rateCheck.allowed) {
      return {
        success: false,
        error: `SECURITY LOCKOUT ACTIVE // ${rateCheck.waitSeconds}s remaining.`,
        waitSeconds: rateCheck.waitSeconds,
      };
    }

    if (!isValidPinFormat(enteredPin, true)) {
      const fail = await recordAndPersistFailure(rateLimitKey, rlCookie, cookieStore, rateCheck.currentCount);
      return {
        success: false,
        error: fail.waitSeconds > 0
          ? `TOO MANY FAILED ATTEMPTS // Locked out for ${fail.waitSeconds}s.`
          : 'PIN must be 6 digits (or 4-digit legacy PIN).',
        waitSeconds: fail.waitSeconds > 0 ? fail.waitSeconds : undefined,
      };
    }

    const cleanPin = enteredPin.trim();
    let matchedUser: SessionUser | null = null;
    let matchedPinHash: string | null = null;
    let userDeactivatedAt: string | null = null;
    let ownerHasCustomDbPin = false;

    // 1. Query app_users table in Supabase (supports Scrypt per-user salt & legacy SHA-256)
    const supabase = getServerSupabase();
    if (supabase) {
      try {
        let rows: Array<{
          id: string;
          username: string;
          role?: string;
          pin_hash: string;
          deactivated_at?: string | null;
        }> = [];

        const { data, error } = await supabase
          .from('app_users')
          .select('id, username, role, pin_hash, deactivated_at');

        if (error && (error.message?.includes('deactivated_at') || error.code === '42703')) {
          const fallback = await supabase
            .from('app_users')
            .select('id, username, role, pin_hash');

          if (fallback.error) {
            console.error('Supabase app_users query error:', fallback.error.message);
            return { success: false, error: 'Database connection error. Please try again.' };
          }
          rows = (fallback.data || []).map((r) => ({ ...r, deactivated_at: null }));
        } else if (error) {
          console.error('Supabase app_users query error:', error.message);
          return { success: false, error: 'Database connection error. Please try again.' };
        } else {
          rows = data || [];
        }

        const ownerRow = rows.find((r) => r.id === OWNER_USER_ID || r.role === 'owner');
        if (ownerRow && isScryptHash(ownerRow.pin_hash)) {
          ownerHasCustomDbPin = true;
        }

        for (const row of rows) {
          if (verifyPinHash(cleanPin, row.pin_hash)) {
            matchedUser = {
              userId: row.id,
              username: row.username,
              role: (row.role as 'owner' | 'member') || 'member',
            };
            matchedPinHash = row.pin_hash;
            userDeactivatedAt = row.deactivated_at || null;
            break;
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('app_users table lookup exception:', message);
        return { success: false, error: 'Database connection failed. Please retry in a moment.' };
      }
    }

    // 2. Fallback to Master Owner PIN from environment if not overridden by a custom Scrypt DB PIN
    if (!matchedUser && !ownerHasCustomDbPin && verifyMasterPin(cleanPin)) {
      matchedUser = {
        userId: OWNER_USER_ID,
        username: 'owner',
        role: 'owner',
      };
    }

    if (!matchedUser) {
      // Artificial delay to prevent automated high-speed brute-forcing
      await new Promise((resolve) => setTimeout(resolve, 250));

      const fail = await recordAndPersistFailure(rateLimitKey, rlCookie, cookieStore, rateCheck.currentCount);

      if (fail.waitSeconds > 0) {
        return {
          success: false,
          error: `TOO MANY FAILED ATTEMPTS // Locked out for ${fail.waitSeconds}s.`,
          waitSeconds: fail.waitSeconds,
        };
      }

      const attemptsLeft = Math.max(0, 3 - fail.count);
      return {
        success: false,
        error: attemptsLeft > 0
          ? `INVALID PIN // ACCESS DENIED (${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} before lockout)`
          : 'INVALID PIN // ACCESS DENIED',
      };
    }

    // Check if account has been soft-deleted / deactivated
    if (userDeactivatedAt) {
      const supabaseClient = getServerSupabase();
      const deactivatedTime = new Date(userDeactivatedAt).getTime();
      const now = Date.now();
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      const remainingMs = SEVEN_DAYS_MS - (now - deactivatedTime);

      if (remainingMs <= 0) {
        if (supabaseClient) {
          await purgeUserData(supabaseClient, matchedUser.userId);
        }
        const fail = await recordAndPersistFailure(rateLimitKey, rlCookie, cookieStore, rateCheck.currentCount);
        return {
          success: false,
          error: 'ACCOUNT EXPIRED // This account was permanently deleted after 7 days of inactivity.',
          waitSeconds: fail.waitSeconds > 0 ? fail.waitSeconds : undefined,
        };
      }

      await clearRateLimits(rateLimitKey, cookieStore);
      cookieStore.set(COOKIE_NAME, createSessionToken({ ...matchedUser, isDeactivated: true }), COOKIE_OPTS);

      return {
        success: true,
        requiresReactivation: true,
        deactivatedAt: userDeactivatedAt,
        remainingMs,
        user: matchedUser,
        isLegacyPin: cleanPin.length === 4,
      };
    }

    // Normal active login: Reset rate limits and issue secure HttpOnly cookie
    await clearRateLimits(rateLimitKey, cookieStore);
    const token = createSessionToken(matchedUser);

    // Record last login timestamp & transparently upgrade 6-digit SHA-256 hash to Scrypt if needed
    const supabaseClient = getServerSupabase();
    if (supabaseClient) {
      try {
        const updateFields: Record<string, unknown> = {
          last_login_at: new Date().toISOString(),
        };
        if (cleanPin.length === 6 && matchedPinHash && !isScryptHash(matchedPinHash)) {
          updateFields.pin_hash = hashPinScrypt(cleanPin);
        }
        await supabaseClient
          .from('app_users')
          .update(updateFields)
          .eq('id', matchedUser.userId);
      } catch (logErr) {
        console.warn('Could not record last_login_at:', logErr);
      }
    }

    cookieStore.set(COOKIE_NAME, token, COOKIE_OPTS);

    return {
      success: true,
      user: matchedUser,
      isLegacyPin: cleanPin.length === 4,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Unhandled verifyPinAction error:', message);
    return {
      success: false,
      error: message || 'Internal authentication error. Please try again.',
    };
  }
}

/**
 * Server Action: Check if client has a valid session cookie
 */
export async function checkSessionAction(): Promise<boolean> {
  const user = await getCurrentUserAction();
  return Boolean(user && !user.isDeactivated);
}

/**
 * Server Action: Get current authenticated session user
 */
export async function getCurrentUserAction(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME);
  if (!sessionCookie?.value) return null;
  return getSessionUserFromToken(sessionCookie.value);
}

/**
 * Server Action: Lock device / Sign out
 */
export async function lockSessionAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Helper to ensure a server action is authenticated and return the user session
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUserAction();
  if (!user) {
    throw new Error('Unauthorized: Valid session required.');
  }
  if (user.isDeactivated) {
    throw new Error('ACCOUNT DEACTIVATED // Reactivation required to access application.');
  }
  return user;
}

/**
 * Server Action: Generate a 1-time invite token (Owner Only)
 */
export async function generateInviteAction(): Promise<{
  success: boolean;
  token?: string;
  error?: string;
}> {
  try {
    const user = await requireAuth();
    if (!isOwnerUser(user)) {
      return { success: false, error: 'Only the owner can generate friend invites.' };
    }

    const supabase = getServerSupabase();
    if (!supabase) {
      return { success: false, error: 'Database is not configured to generate invitations.' };
    }

    const rawToken = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const { error: insertErr } = await supabase.from('invitations').insert({
      token: rawToken,
      created_by: user.userId,
      expires_at: expiresAt,
    });
    if (insertErr) {
      return { success: false, error: insertErr.message || 'Failed to save invitation.' };
    }

    // Sign the token cryptographically
    const signature = crypto.createHmac('sha256', SECRET_HMAC_KEY).update(rawToken).digest('hex');
    const fullToken = `${rawToken}.${signature}`;

    return { success: true, token: fullToken };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message || 'Failed to generate invite' };
  }
}

/**
 * Server Action: Validate an invitation token before showing friend signup
 */
export async function validateInviteTokenAction(fullToken: string): Promise<{
  valid: boolean;
  error?: string;
}> {
  if (!fullToken || !fullToken.includes('.')) {
    return { valid: false, error: 'Invalid invitation link format.' };
  }

  const [rawToken, signature] = fullToken.split('.');
  const expectedSig = crypto.createHmac('sha256', SECRET_HMAC_KEY).update(rawToken).digest('hex');
  if (
    signature.length !== expectedSig.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))
  ) {
    return { valid: false, error: 'Corrupted or tampered invitation link.' };
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return { valid: false, error: 'Database is not configured.' };
  }

  try {
    const { data, error } = await supabase
      .from('invitations')
      .select('used_at, expires_at')
      .eq('token', rawToken)
      .maybeSingle();

    if (error || !data) {
      return { valid: false, error: 'Invalid or unknown invitation link.' };
    }
    if (data.used_at) {
      return { valid: false, error: 'This invitation has already been used.' };
    }
    if (new Date(data.expires_at).getTime() < Date.now()) {
      return { valid: false, error: 'This invitation has expired.' };
    }
  } catch {
    return { valid: false, error: 'Failed to verify invitation link.' };
  }

  return { valid: true };
}

/**
 * Server Action: Complete friend registration using invite token and private 6-digit PIN
 */
export async function completeInviteSetupAction(
  fullToken: string,
  username: string,
  pin: string
): Promise<{
  success: boolean;
  error?: string;
  user?: SessionUser;
}> {
  const { rateLimitKey, cookieStore, rlCookie, rateCheck } = await getRateLimitContext();
  if (!rateCheck.allowed) {
    return {
      success: false,
      error: `SECURITY LOCKOUT ACTIVE // ${rateCheck.waitSeconds}s remaining.`,
    };
  }

  const tokenValidation = await validateInviteTokenAction(fullToken);
  if (!tokenValidation.valid) {
    return { success: false, error: tokenValidation.error };
  }

  const cleanUsername = username.trim();
  if (!cleanUsername || cleanUsername.length < 2) {
    return { success: false, error: 'Please enter a name of at least 2 characters.' };
  }

  if (!isValidPinFormat(pin, false)) {
    return { success: false, error: 'PIN must be exactly 6 numeric digits.' };
  }

  // Prevent duplicate PIN with Master Owner
  if (verifyMasterPin(pin)) {
    await recordAndPersistFailure(rateLimitKey, rlCookie, cookieStore, rateCheck.currentCount);
    return {
      success: false,
      error: 'Unable to complete registration with the provided details. Please choose a different PIN or display name.',
    };
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return { success: false, error: 'Database is not configured to register users.' };
  }

  try {
    // Check if username or PIN already exists across app_users
    const { data: existingUsers } = await supabase
      .from('app_users')
      .select('id, username, pin_hash');

    const normalizedName = cleanUsername.toLowerCase();
    const hasCollision = (existingUsers || []).some(
      (u) =>
        u.username?.trim().toLowerCase() === normalizedName ||
        verifyPinHash(pin, u.pin_hash)
    );

    if (hasCollision) {
      await recordAndPersistFailure(rateLimitKey, rlCookie, cookieStore, rateCheck.currentCount);
      return {
        success: false,
        error: 'Unable to complete registration with the provided details. Please choose a different PIN or display name.',
      };
    }

    const hashedPin = hashPinScrypt(pin);
    const [rawToken] = fullToken.split('.');
    const nowIso = new Date().toISOString();

    // Atomic claim of invitation token (Prevents race conditions)
    const { data: claimedInvite, error: claimErr } = await supabase
      .from('invitations')
      .update({ used_at: nowIso })
      .eq('token', rawToken)
      .is('used_at', null)
      .gt('expires_at', nowIso)
      .select('id')
      .maybeSingle();

    if (claimErr || !claimedInvite) {
      return { success: false, error: 'This invitation has already been used or has expired.' };
    }

    // Insert new user with per-user salted Scrypt hash
    const newUserPayload = {
      username: cleanUsername,
      pin_hash: hashedPin,
      role: 'member' as const,
      last_login_at: nowIso,
    };

    let { data: newUser, error: insertErr } = await supabase
      .from('app_users')
      .insert(newUserPayload)
      .select()
      .single();

    if (insertErr && (insertErr.message?.includes('last_login_at') || insertErr.code === '42703')) {
      const fallbackPayload: Record<string, unknown> = { ...newUserPayload };
      delete fallbackPayload.last_login_at;
      const retry = await supabase.from('app_users').insert(fallbackPayload).select().single();
      newUser = retry.data;
      insertErr = retry.error;
    }

    if (insertErr || !newUser) {
      // Revert the atomic claim if user creation failed
      await supabase
        .from('invitations')
        .update({ used_at: null })
        .eq('id', claimedInvite.id);
      throw insertErr || new Error('Failed to create user');
    }

    // Associate created user with the claimed invitation
    await supabase
      .from('invitations')
      .update({ used_by: newUser.id })
      .eq('id', claimedInvite.id);

    // Issue session cookie for the new user immediately
    const sessionUser: SessionUser = {
      userId: newUser.id,
      username: newUser.username,
      role: 'member',
    };

    await clearRateLimits(rateLimitKey, cookieStore);
    cookieStore.set(COOKIE_NAME, createSessionToken(sessionUser), COOKIE_OPTS);

    return { success: true, user: sessionUser };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message || 'Failed to complete registration' };
  }
}

/**
 * Server Action: Change / Upgrade current user's PIN to a 6-digit Scrypt-hashed PIN (Zero Data Loss)
 */
export async function changePinAction(
  currentPin: string,
  newPin: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await requireAuth();
    const { rateLimitKey, cookieStore, rlCookie, rateCheck } = await getRateLimitContext();
    if (!rateCheck.allowed) {
      return {
        success: false,
        error: `SECURITY LOCKOUT ACTIVE // ${rateCheck.waitSeconds}s remaining.`,
      };
    }

    if (!isValidPinFormat(currentPin, true)) {
      return { success: false, error: 'Current PIN must be 4 or 6 numeric digits.' };
    }

    if (!isValidPinFormat(newPin, false)) {
      return { success: false, error: 'New PIN must be exactly 6 numeric digits.' };
    }

    const supabase = getServerSupabase();
    if (!supabase) {
      return { success: false, error: 'Database connection required to update PIN.' };
    }

    const { data: allUsers, error: fetchErr } = await supabase
      .from('app_users')
      .select('id, username, role, pin_hash');

    if (fetchErr) {
      return { success: false, error: 'Failed to verify current credentials.' };
    }

    const rows = allUsers || [];
    const currentRow = rows.find((r) => r.id === user.userId);
    const isOwner = isOwnerUser(user);

    let currentPinValid = false;
    if (currentRow && verifyPinHash(currentPin, currentRow.pin_hash)) {
      currentPinValid = true;
    } else if (isOwner && (!currentRow || !isScryptHash(currentRow.pin_hash)) && verifyMasterPin(currentPin)) {
      currentPinValid = true;
    }

    if (!currentPinValid) {
      const fail = await recordAndPersistFailure(rateLimitKey, rlCookie, cookieStore, rateCheck.currentCount);
      return {
        success: false,
        error: fail.waitSeconds > 0
          ? `TOO MANY FAILED ATTEMPTS // Locked out for ${fail.waitSeconds}s.`
          : 'Current PIN is incorrect.',
      };
    }

    // Ensure new PIN does not collide with another user's PIN
    const pinTakenByOther = rows.some(
      (r) => r.id !== user.userId && verifyPinHash(newPin, r.pin_hash)
    );
    if (pinTakenByOther || (!isOwner && verifyMasterPin(newPin))) {
      return {
        success: false,
        error: 'Please choose a different 6-digit PIN.',
      };
    }

    const newScryptHash = hashPinScrypt(newPin);
    const nowIso = new Date().toISOString();

    if (currentRow) {
      const { error: updateErr } = await supabase
        .from('app_users')
        .update({ pin_hash: newScryptHash, updated_at: nowIso })
        .eq('id', user.userId);
      if (updateErr) return { success: false, error: updateErr.message };
    } else if (isOwner) {
      const { error: upsertErr } = await supabase.from('app_users').upsert({
        id: OWNER_USER_ID,
        username: 'owner',
        pin_hash: newScryptHash,
        role: 'owner',
        updated_at: nowIso,
      });
      if (upsertErr) return { success: false, error: upsertErr.message };
    } else {
      return { success: false, error: 'User account record not found.' };
    }

    await clearRateLimits(rateLimitKey, cookieStore);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message || 'Failed to update PIN.' };
  }
}

/**
 * Server Action: Reactivate account during the 7-day deactivation grace period
 * Clears deactivated_at = NULL in app_users, updates last_login_at = NOW(), sets standard session cookie.
 */
export async function reactivateAccountAction(): Promise<{
  success: boolean;
  error?: string;
  user?: SessionUser;
}> {
  try {
    const currentUser = await getCurrentUserAction();
    if (!currentUser?.userId) {
      return { success: false, error: 'Unauthorized: Valid session required.' };
    }
    const targetId = currentUser.userId;

    const supabase = getServerSupabase();
    if (!supabase) {
      return { success: false, error: 'Database connection failed.' };
    }

    const nowIso = new Date().toISOString();
    const { data: updatedUser, error } = await supabase
      .from('app_users')
      .update({
        deactivated_at: null,
        last_login_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', targetId)
      .select('id, username, role')
      .maybeSingle();

    if (error && (error.message?.includes('deactivated_at') || error.code === '42703' || error.code === 'PGRST100')) {
      await supabase
        .from('app_users')
        .update({
          last_login_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', targetId);
    } else if (error) {
      return { success: false, error: error.message };
    }

    const sessionUser: SessionUser = {
      userId: updatedUser?.id || currentUser.userId,
      username: updatedUser?.username || currentUser.username,
      role: (updatedUser?.role as 'owner' | 'member') || currentUser.role,
      isDeactivated: false,
    };

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, createSessionToken(sessionUser), COOKIE_OPTS);

    return { success: true, user: sessionUser };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message || 'Failed to reactivate account.' };
  }
}

/**
 * Server Action: Deactivate current user account (Start 7-day countdown toward permanent hard delete)
 * Verifies caller PIN, verifies user is not owner, sets deactivated_at = NOW(), clears session cookie.
 */
export async function deactivateAccountAction(enteredPin: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await requireAuth();

    if (isOwnerUser(user)) {
      return { success: false, error: 'The Master Owner account cannot be deactivated.' };
    }

    const { rateLimitKey, cookieStore, rlCookie, rateCheck } = await getRateLimitContext();
    if (!rateCheck.allowed) {
      return {
        success: false,
        error: `SECURITY LOCKOUT ACTIVE // ${rateCheck.waitSeconds}s remaining.`,
      };
    }

    if (!isValidPinFormat(enteredPin, true)) {
      await recordAndPersistFailure(rateLimitKey, rlCookie, cookieStore, rateCheck.currentCount);
      return { success: false, error: 'PIN must be 6 digits (or 4-digit legacy PIN).' };
    }

    const cleanPin = enteredPin.trim();

    const supabase = getServerSupabase();
    if (!supabase) {
      return { success: false, error: 'Database connection failed.' };
    }

    // Verify PIN matches current user's PIN in app_users
    const { data: userRecord, error: fetchErr } = await supabase
      .from('app_users')
      .select('id, pin_hash')
      .eq('id', user.userId)
      .maybeSingle();

    if (fetchErr || !userRecord) {
      return { success: false, error: 'User record not found.' };
    }

    const isPinValid = verifyPinHash(cleanPin, userRecord.pin_hash);

    if (!isPinValid) {
      const fail = await recordAndPersistFailure(rateLimitKey, rlCookie, cookieStore, rateCheck.currentCount);
      return {
        success: false,
        error: fail.waitSeconds > 0
          ? `TOO MANY FAILED ATTEMPTS // Locked out for ${fail.waitSeconds}s.`
          : 'Incorrect PIN. Deactivation cancelled.',
      };
    }

    await clearRateLimits(rateLimitKey, cookieStore);

    const nowIso = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from('app_users')
      .update({
        deactivated_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', user.userId);

    if (updateErr) {
      if (updateErr.message?.includes('deactivated_at') || updateErr.code === '42703' || updateErr.code === 'PGRST100') {
        return {
          success: false,
          error: 'Database schema migration pending. Column "deactivated_at" is missing in Supabase.',
        };
      }
      return { success: false, error: updateErr.message };
    }

    cookieStore.delete(COOKIE_NAME);

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message || 'Failed to deactivate account.' };
  }
}

