import type { SupabaseClient } from '@supabase/supabase-js';
import { OWNER_USER_ID } from './auth-utils';
import { getServerSupabase } from './supabase';

/**
 * Permanently purge all data associated with a user:
 * - day_notes
 * - habit_logs (scoped by user_id and by habit_id)
 * - habits
 * - invitations (created_by or used_by)
 * - app_users
 */
export async function purgeUserData(
  supabaseClient: SupabaseClient | ReturnType<typeof getServerSupabase>,
  targetUserId: string
): Promise<boolean> {
  if (!supabaseClient || !targetUserId || targetUserId === OWNER_USER_ID) {
    return false;
  }

  try {
    // Verify target is not an owner account
    const { data: targetUser } = await supabaseClient
      .from('app_users')
      .select('role')
      .eq('id', targetUserId)
      .maybeSingle();

    if (targetUser?.role === 'owner') {
      return false;
    }

    // 1. Delete day_notes
    try {
      await supabaseClient.from('day_notes').delete().eq('user_id', targetUserId);
    } catch (e) {
      console.warn('purgeUserData: error deleting day_notes', e);
    }

    // 2. Delete user's habits and associated logs
    try {
      const { data: userHabits } = await supabaseClient
        .from('habits')
        .select('id')
        .eq('user_id', targetUserId);

      const habitIds = (userHabits || []).map((h: { id: string }) => h.id);
      if (habitIds.length > 0) {
        await supabaseClient.from('habit_logs').delete().in('habit_id', habitIds);
      }
      await supabaseClient.from('habit_logs').delete().eq('user_id', targetUserId);
      await supabaseClient.from('habits').delete().eq('user_id', targetUserId);
    } catch (e) {
      console.warn('purgeUserData: error deleting habits/logs', e);
    }

    // 3. Delete invitations
    try {
      await supabaseClient.from('invitations').delete().eq('created_by', targetUserId);
      await supabaseClient.from('invitations').delete().eq('used_by', targetUserId);
    } catch (e) {
      console.warn('purgeUserData: error deleting invitations', e);
    }

    // 4. Delete app_users row
    const { error: userDelErr } = await supabaseClient
      .from('app_users')
      .delete()
      .eq('id', targetUserId);

    if (userDelErr) {
      console.error('purgeUserData: error deleting app_users entry', userDelErr);
      return false;
    }

    return true;
  } catch (err) {
    console.error('purgeUserData fatal exception:', err);
    return false;
  }
}

/**
 * Purge all users whose deactivation grace period (>= 7 days) has expired
 */
export async function purgeExpiredDeactivatedUsers(
  supabaseClient?: SupabaseClient | ReturnType<typeof getServerSupabase>
): Promise<number> {
  const supabase = supabaseClient || getServerSupabase();
  if (!supabase) return 0;

  try {
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: expiredUsers, error } = await supabase
      .from('app_users')
      .select('id, role, deactivated_at')
      .not('deactivated_at', 'is', null)
      .lt('deactivated_at', cutoffDate);

    if (error) {
      // Column might not exist in un-migrated DB
      return 0;
    }

    let purgedCount = 0;
    if (expiredUsers && expiredUsers.length > 0) {
      for (const u of expiredUsers) {
        if (u.id !== OWNER_USER_ID && u.role !== 'owner') {
          const success = await purgeUserData(supabase, u.id);
          if (success) purgedCount++;
        }
      }
    }
    return purgedCount;
  } catch (err) {
    console.warn('purgeExpiredDeactivatedUsers exception:', err);
    return 0;
  }
}
