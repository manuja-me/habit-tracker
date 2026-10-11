'use server';

import { cookies, headers } from 'next/headers';
import crypto from 'crypto';
import { getServerSupabase } from './supabase';
import { purgeUserData } from './user-management';
import {
  OWNER_USER_ID,
  MASTER_PIN_HASH,
  COOKIE_NAME,
  RL_COOKIE_NAME,
  SECRET_HMAC_KEY,
  SessionUser,
  checkRateLimit,
  recordFailedAttempt,
  resetFailedAttempts,
  hashPin,
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

async function getRateLimitContext() {
  const headerList = await headers();
  const clientIp = getClientIp(headerList);
  const rateLimitKey = `pin_rl_${clientIp}`;
  const cookieStore = await cookies();
  const rlCookie = cookieStore.get(RL_COOKIE_NAME)?.value;
  const rateCheck = checkRateLimit(rateLimitKey, rlCookie);
  return { rateLimitKey, cookieStore, rlCookie, rateCheck };
}

function recordAndPersistFailure(
  rateLimitKey: string,
  rlCookie: string | undefined,
  cookieStore: Awaited<ReturnType<typeof cookies>>
) {
  const fail = recordFailedAttempt(rateLimitKey, rlCookie);
  cookieStore.set(RL_COOKIE_NAME, fail.token, {
    ...COOKIE_OPTS,
    maxAge: Math.max(86400, fail.waitSeconds || 3600),
  });
  return fail;
}

/**
 * Server Action: Verify 4-digit PIN against Master Owner or Multi-User Database
 */
export async function verifyPinAction(enteredPin: string): Promise<{
  success: boolean;
  error?: string;
  waitSeconds?: number;
  user?: SessionUser;
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

    if (!enteredPin || enteredPin.length !== 4) {
      const fail = recordAndPersistFailure(rateLimitKey, rlCookie, cookieStore);
      return {
        success: false,
        error: fail.waitSeconds > 0
          ? `TOO MANY FAILED ATTEMPTS // Locked out for ${fail.waitSeconds}s.`
          : 'Invalid PIN length.',
        waitSeconds: fail.waitSeconds > 0 ? fail.waitSeconds : undefined,
      };
    }

    const cleanPin = enteredPin.trim();
    const computedHash = hashPin(cleanPin);

    // 1. Check Master Owner PIN with buffer length check
    const computedBuf = Buffer.from(computedHash);
    const masterBuf = Buffer.from(MASTER_PIN_HASH);
    const isOwnerMatch =
      computedBuf.length === masterBuf.length &&
      crypto.timingSafeEqual(computedBuf, masterBuf);

    let matchedUser: SessionUser | null = null;
    let userDeactivatedAt: string | null = null;

    if (isOwnerMatch) {
      matchedUser = {
        userId: OWNER_USER_ID,
        username: 'owner',
        role: 'owner',
      };
    } else {
      // 2. Query app_users table in Supabase
      const supabase = getServerSupabase();
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('app_users')
            .select('id, username, role, pin_hash, deactivated_at')
            .eq('pin_hash', computedHash)
            .maybeSingle();

          let userData: { id: string; username: string; role?: string; pin_hash: string; deactivated_at?: string | null } | null = null;

          if (error && (error.message?.includes('deactivated_at') || error.code === '42703')) {
            const fallback = await supabase
              .from('app_users')
              .select('id, username, role, pin_hash')
              .eq('pin_hash', computedHash)
              .maybeSingle();

            if (fallback.error) {
              console.error('Supabase app_users query error:', fallback.error.message);
              return { success: false, error: 'Database connection error. Please try again.' };
            }
            userData = fallback.data ? { ...fallback.data, deactivated_at: null } : null;
          } else if (error) {
            console.error('Supabase app_users query error:', error.message);
            return { success: false, error: 'Database connection error. Please try again.' };
          } else {
            userData = data;
          }

          if (userData) {
            matchedUser = {
              userId: userData.id,
              username: userData.username,
              role: (userData.role as 'owner' | 'member') || 'member',
            };
            userDeactivatedAt = userData.deactivated_at || null;
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('app_users table lookup exception:', message);
          return { success: false, error: 'Database connection failed. Please retry in a moment.' };
        }
      }
    }

    if (!matchedUser) {
      // Artificial delay to prevent automated high-speed brute-forcing
      await new Promise((resolve) => setTimeout(resolve, 200));

      const fail = recordAndPersistFailure(rateLimitKey, rlCookie, cookieStore);

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
        // Exceeded 7 days: Permanently wipe user account data
        if (supabaseClient) {
          await purgeUserData(supabaseClient, matchedUser.userId);
        }
        const fail = recordAndPersistFailure(rateLimitKey, rlCookie, cookieStore);
        return {
          success: false,
          error: 'ACCOUNT EXPIRED // This account was permanently deleted after 7 days of inactivity.',
          waitSeconds: fail.waitSeconds > 0 ? fail.waitSeconds : undefined,
        };
      }

      // Within 7 days: User can reactivate
      resetFailedAttempts(rateLimitKey);
      cookieStore.delete(RL_COOKIE_NAME);
      cookieStore.set(COOKIE_NAME, createSessionToken({ ...matchedUser, isDeactivated: true }), COOKIE_OPTS);

      return {
        success: true,
        requiresReactivation: true,
        deactivatedAt: userDeactivatedAt,
        remainingMs,
        user: matchedUser,
      };
    }

    // Normal active login: Reset rate limits and issue secure HttpOnly cookie
    resetFailedAttempts(rateLimitKey);
    cookieStore.delete(RL_COOKIE_NAME);
    const token = createSessionToken(matchedUser);

    // Record last login timestamp in app_users
    const supabaseClient = getServerSupabase();
    if (supabaseClient) {
      try {
        await supabaseClient
          .from('app_users')
          .update({
            last_login_at: new Date().toISOString(),
          })
          .eq('id', matchedUser.userId);
      } catch (logErr) {
        console.warn('Could not record last_login_at:', logErr);
      }
    }

    cookieStore.set(COOKIE_NAME, token, COOKIE_OPTS);

    return { success: true, user: matchedUser };
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
 * Server Action: Complete friend registration using invite token and private PIN
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

  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    return { success: false, error: 'PIN must be exactly 4 numeric digits.' };
  }

  const hashedPin = hashPin(pin);

  // Prevent duplicate PIN with Owner (timing-safe comparison)
  const hashedBuf = Buffer.from(hashedPin);
  const masterBuf = Buffer.from(MASTER_PIN_HASH);
  const isOwnerPin =
    hashedBuf.length === masterBuf.length &&
    crypto.timingSafeEqual(hashedBuf, masterBuf);

  if (isOwnerPin) {
    recordAndPersistFailure(rateLimitKey, rlCookie, cookieStore);
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
    // Check if username already exists
    const { data: existingUser } = await supabase
      .from('app_users')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (existingUser) {
      recordAndPersistFailure(rateLimitKey, rlCookie, cookieStore);
      return {
        success: false,
        error: 'Unable to complete registration with the provided details. Please choose a different PIN or display name.',
      };
    }

    // Check if PIN already used by another user
    const { data: existingPin } = await supabase
      .from('app_users')
      .select('id')
      .eq('pin_hash', hashedPin)
      .maybeSingle();

    if (existingPin) {
      recordAndPersistFailure(rateLimitKey, rlCookie, cookieStore);
      return {
        success: false,
        error: 'Unable to complete registration with the provided details. Please choose a different PIN or display name.',
      };
    }

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

    // Insert new user
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

    resetFailedAttempts(rateLimitKey);
    cookieStore.delete(RL_COOKIE_NAME);
    cookieStore.set(COOKIE_NAME, createSessionToken(sessionUser), COOKIE_OPTS);

    return { success: true, user: sessionUser };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message || 'Failed to complete registration' };
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

    if (!enteredPin || enteredPin.length !== 4) {
      recordAndPersistFailure(rateLimitKey, rlCookie, cookieStore);
      return { success: false, error: 'PIN must be exactly 4 digits.' };
    }

    const cleanPin = enteredPin.trim();
    const computedHash = hashPin(cleanPin);

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

    const hashBuf = Buffer.from(computedHash);
    const recordBuf = Buffer.from(userRecord.pin_hash);
    const isPinValid =
      hashBuf.length === recordBuf.length &&
      crypto.timingSafeEqual(hashBuf, recordBuf);

    if (!isPinValid) {
      const fail = recordAndPersistFailure(rateLimitKey, rlCookie, cookieStore);
      return {
        success: false,
        error: fail.waitSeconds > 0
          ? `TOO MANY FAILED ATTEMPTS // Locked out for ${fail.waitSeconds}s.`
          : 'Incorrect PIN. Deactivation cancelled.',
      };
    }

    resetFailedAttempts(rateLimitKey);
    cookieStore.delete(RL_COOKIE_NAME);

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

