'use server';

import { cookies } from 'next/headers';
import crypto from 'crypto';
import { getServerSupabase } from './supabase';
import { purgeUserData } from './user-management';
import {
  OWNER_USER_ID,
  MASTER_PIN_HASH,
  COOKIE_NAME,
  SECRET_HMAC_KEY,
  SessionUser,
  checkRateLimit,
  recordFailedAttempt,
  resetFailedAttempts,
  hashPin,
  createSessionToken,
  getSessionUserFromToken,
} from './auth-utils';

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
    const rateLimitKey = 'global_pin_attempt';
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
              role: (userData.role as any) || 'member',
            };
            userDeactivatedAt = userData.deactivated_at || null;
          }
        } catch (err: any) {
          console.error('app_users table lookup exception:', err);
          return { success: false, error: 'Database connection failed. Please retry in a moment.' };
        }
      }
    }

    if (!matchedUser) {
      recordFailedAttempt(rateLimitKey);
      return { success: false, error: 'Invalid PIN. Access denied.' };
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
        recordFailedAttempt(rateLimitKey);
        return {
          success: false,
          error: 'ACCOUNT EXPIRED // This account was permanently deleted after 7 days of inactivity.',
        };
      }

      // Within 7 days: User can reactivate
      resetFailedAttempts(rateLimitKey);
      const token = createSessionToken({ ...matchedUser, isDeactivated: true });

      const cookieStore = await cookies();
      cookieStore.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });

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
    const token = createSessionToken(matchedUser);

    // Record last login timestamp in app_users
    const supabaseClient = getServerSupabase();
    if (supabaseClient) {
      try {
        await supabaseClient
          .from('app_users')
          .update({
            last_login_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', matchedUser.userId);
      } catch (logErr) {
        console.warn('Could not record last_login_at:', logErr);
      }
    }

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return { success: true, user: matchedUser };
  } catch (err: any) {
    console.error('Unhandled verifyPinAction error:', err);
    return {
      success: false,
      error: err?.message || 'Internal authentication error. Please try again.',
    };
  }
}

/**
 * Server Action: Check if client has a valid session cookie
 */
export async function checkSessionAction(): Promise<boolean> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME);
  if (!sessionCookie?.value) return false;
  const user = getSessionUserFromToken(sessionCookie.value);
  if (!user || user.isDeactivated) return false;
  return true;
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
    if (user.role !== 'owner') {
      return { success: false, error: 'Only the owner can generate friend invites.' };
    }

    const rawToken = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const supabase = getServerSupabase();
    if (supabase) {
      try {
        await supabase.from('invitations').insert({
          token: rawToken,
          created_by: user.userId,
          expires_at: expiresAt,
        });
      } catch (e) {
        console.warn('invitations table insert notice:', e);
      }
    }

    // Sign the token cryptographically
    const signature = crypto.createHmac('sha256', SECRET_HMAC_KEY).update(rawToken).digest('hex');
    const fullToken = `${rawToken}.${signature}`;

    return { success: true, token: fullToken };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to generate invite' };
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

  // Check database if table exists
  const supabase = getServerSupabase();
  if (supabase) {
    try {
      const { data } = await supabase
        .from('invitations')
        .select('*')
        .eq('token', rawToken)
        .maybeSingle();

      if (data) {
        if (data.used_at) {
          return { valid: false, error: 'This invitation has already been used.' };
        }
        if (new Date(data.expires_at).getTime() < Date.now()) {
          return { valid: false, error: 'This invitation has expired.' };
        }
      }
    } catch (e) {
      // Allow fallback if table not yet migrated
    }
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

  // Prevent duplicate PIN with Owner
  if (crypto.timingSafeEqual(Buffer.from(hashedPin), Buffer.from(MASTER_PIN_HASH))) {
    return { success: false, error: 'This PIN is already reserved. Please choose a different 4-digit PIN.' };
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
      return { success: false, error: 'This username is already taken. Please choose another.' };
    }

    // Check if PIN already used by another user
    const { data: existingPin } = await supabase
      .from('app_users')
      .select('id')
      .eq('pin_hash', hashedPin)
      .maybeSingle();

    if (existingPin) {
      return { success: false, error: 'This PIN is already taken. Please choose a different 4-digit PIN.' };
    }

    // Insert new user
    const newUserPayload: any = {
      username: cleanUsername,
      pin_hash: hashedPin,
      role: 'member',
      last_login_at: new Date().toISOString(),
    };

    let { data: newUser, error: insertErr } = await supabase
      .from('app_users')
      .insert(newUserPayload)
      .select()
      .single();

    if (insertErr && (insertErr.message?.includes('last_login_at') || insertErr.code === '42703')) {
      delete newUserPayload.last_login_at;
      const retry = await supabase.from('app_users').insert(newUserPayload).select().single();
      newUser = retry.data;
      insertErr = retry.error;
    }

    if (insertErr || !newUser) {
      throw insertErr || new Error('Failed to create user');
    }

    // Mark invitation as used
    const [rawToken] = fullToken.split('.');
    await supabase
      .from('invitations')
      .update({
        used_by: newUser.id,
        used_at: new Date().toISOString(),
      })
      .eq('token', rawToken);

    // Issue session cookie for the new user immediately
    const sessionUser: SessionUser = {
      userId: newUser.id,
      username: newUser.username,
      role: 'member',
    };

    const token = createSessionToken(sessionUser);
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return { success: true, user: sessionUser };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to complete registration' };
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
      role: (updatedUser?.role as any) || currentUser.role,
      isDeactivated: false,
    };

    const token = createSessionToken(sessionUser);
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return { success: true, user: sessionUser };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to reactivate account.' };
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

    if (user.role === 'owner' || user.userId === OWNER_USER_ID) {
      return { success: false, error: 'The Master Owner account cannot be deactivated.' };
    }

    if (!enteredPin || enteredPin.length !== 4) {
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
      return { success: false, error: 'Incorrect PIN. Deactivation cancelled.' };
    }

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

    // Clear session cookie
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to deactivate account.' };
  }
}

