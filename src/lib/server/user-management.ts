import type { SupabaseClient } from '@supabase/supabase-js';
import { OWNER_USER_ID, isValidUuid } from './auth-utils';
import { getServerSupabase } from './supabase';

/**
 * Delete a member and their dependent data using schema foreign keys.
 */
export async function purgeUserData(
  supabaseClient: SupabaseClient | ReturnType<typeof getServerSupabase>,
  targetUserId: string,
  expiredBefore?: string,
): Promise<boolean> {
  if (!supabaseClient || !targetUserId || !isValidUuid(targetUserId) || targetUserId === OWNER_USER_ID) {
    return false;
  }

  try {
    let deletion = supabaseClient
      .from('app_users')
      .delete()
      .eq('id', targetUserId)
      .eq('role', 'member');
    if (expiredBefore) deletion = deletion.lte('deactivated_at', expiredBefore);
    const { data, error } = await deletion.select('id').maybeSingle();
    return Boolean(data && !error);
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
      .lte('deactivated_at', cutoffDate);

    if (error) {
      // Column might not exist in un-migrated DB
      return 0;
    }

    let purgedCount = 0;
    if (expiredUsers && expiredUsers.length > 0) {
      const candidates = expiredUsers.filter((u) => u.id !== OWNER_USER_ID && u.role !== 'owner');
      const results = await Promise.all(candidates.map((u) => purgeUserData(supabase, u.id, cutoffDate)));
      purgedCount = results.filter(Boolean).length;
    }
    return purgedCount;
  } catch (err) {
    console.warn('purgeExpiredDeactivatedUsers exception:', err);
    return 0;
  }
}
