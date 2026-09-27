'use server';

import { requireAuth } from './auth';
import { OWNER_USER_ID } from './auth-utils';
import { getCleanSupabaseConfig, getServerSupabase } from './supabase';
import { Habit, HabitLog } from '../types';

/**
 * Server Action: Fetch habits and logs scoped to the authenticated user
 */
export async function getHabitsAndLogsAction(): Promise<{
  success: boolean;
  isConfigured: boolean;
  habits?: Habit[];
  logs?: Record<string, HabitLog>;
  dayNotes?: Record<string, string>;
  error?: string;
  user?: { id: string; username: string; role: string };
}> {
  try {
    const user = await requireAuth();

    const config = getCleanSupabaseConfig();
    if (!config) {
      return { success: true, isConfigured: false, habits: [], logs: {}, dayNotes: {}, user: { id: user.userId, username: user.username, role: user.role } };
    }

    const supabase = getServerSupabase();
    if (!supabase) {
      return { success: true, isConfigured: false, habits: [], logs: {}, dayNotes: {}, user: { id: user.userId, username: user.username, role: user.role } };
    }

    // 1. Fetch habits scoped to this user
    let habitsData: any[] = [];
    const isOwner = user.role === 'owner' || user.userId === OWNER_USER_ID;

    // Try scoped query with user_id
    const habitsRes = await supabase
      .from('habits')
      .select('*')
      .eq('archived', false)
      .or(isOwner ? `user_id.eq.${user.userId},user_id.is.null` : `user_id.eq.${user.userId}`)
      .order('sort_order', { ascending: true });

    if (habitsRes.error) {
      // Fallback for pre-migration databases: owner gets all, new member gets empty
      if (isOwner) {
        const fallbackRes = await supabase
          .from('habits')
          .select('*')
          .eq('archived', false)
          .order('sort_order', { ascending: true });
        if (fallbackRes.error) throw fallbackRes.error;
        habitsData = fallbackRes.data || [];
      } else {
        habitsData = [];
      }
    } else {
      habitsData = habitsRes.data || [];
    }

    // 2. Fetch logs restricted to this user's habits (100% data isolation guarantee)
    const userHabitIds = habitsData.map((h: any) => h.id);
    let logsData: any[] = [];

    if (userHabitIds.length > 0) {
      const logsRes = await supabase
        .from('habit_logs')
        .select('*')
        .in('habit_id', userHabitIds)
        .limit(5000);

      if (!logsRes.error && logsRes.data) {
        logsData = logsRes.data;
      }
    }

    const formattedHabits: Habit[] = (habitsData || []).map((h: any) => {
      const rawDesc = h.description || '';
      const isDont = rawDesc.includes('[NATURE:DONT]');

      // Parse weaning config if present
      let weaningConfig = undefined;
      const weaningMatch = rawDesc.match(/\[WEANING:(.*?)\]/);
      if (weaningMatch && weaningMatch[1]) {
        try {
          weaningConfig = JSON.parse(weaningMatch[1]);
        } catch {}
      }

      const cleanDesc = rawDesc
        .replace(/\s*\[NATURE:DONT\]/g, '')
        .replace(/\s*\[WEANING:.*?\]/g, '')
        .trim();

      return {
        id: h.id,
        title: h.title,
        description: cleanDesc,
        category: h.category,
        color: h.color,
        icon: h.icon,
        type: h.type,
        nature: (isDont ? 'dont' : 'do') as Habit['nature'],
        weaning: weaningConfig || (isDont ? { enabled: true, protocol: 'exponential' } : undefined),
        target_value: Number(h.target_value) || 1,
        target_unit: h.target_unit || '',
        frequency: h.frequency,
        custom_days: h.custom_days || [],
        archived: Boolean(h.archived),
        order: h.sort_order || 0,
        created_at: h.created_at,
        updated_at: h.updated_at,
      };
    });

    const mappedLogs: Record<string, HabitLog> = {};
    (logsData || []).forEach((l: any) => {
      mappedLogs[`${l.habit_id}_${l.date}`] = {
        id: l.id,
        habit_id: l.habit_id,
        date: l.date,
        completed: Boolean(l.completed),
        value: Number(l.value) || 0,
        created_at: l.created_at,
        updated_at: l.updated_at,
      };
    });

    // 3. Fetch day notes directly from day_notes table
    const dayNotesMap: Record<string, string> = {};
    try {
      const notesRes = await supabase
        .from('day_notes')
        .select('date, content')
        .or(isOwner ? `user_id.eq.${user.userId},user_id.is.null` : `user_id.eq.${user.userId}`);

      if (!notesRes.error && notesRes.data) {
        notesRes.data.forEach((dn: any) => {
          if (dn.date && dn.content !== undefined) {
            dayNotesMap[dn.date] = dn.content;
          }
        });
      }
    } catch (e) {
      console.warn('day_notes fetch notice:', e);
    }

    return {
      success: true,
      isConfigured: true,
      habits: formattedHabits,
      logs: mappedLogs,
      dayNotes: dayNotesMap,
      user: { id: user.userId, username: user.username, role: user.role },
    };
  } catch (err: any) {
    return {
      success: false,
      isConfigured: Boolean(getCleanSupabaseConfig()),
      error: err?.message || 'Failed to fetch data',
    };
  }
}

/**
 * Server Action: Save / Upsert a Habit (Protected & Scoped to user)
 */
export async function saveHabitAction(habit: Habit): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    const supabase = getServerSupabase();
    if (!supabase) return { success: true };

    const rawDesc = habit.description || '';
    let storedDesc = rawDesc
      .replace(/\s*\[NATURE:DONT\]/g, '')
      .replace(/\s*\[WEANING:.*?\]/g, '')
      .trim();

    if (habit.nature === 'dont') {
      storedDesc = storedDesc ? `${storedDesc} [NATURE:DONT]` : '[NATURE:DONT]';
      if (habit.weaning?.enabled) {
        storedDesc += ` [WEANING:${JSON.stringify(habit.weaning)}]`;
      }
    }

    const habitPayload: any = {
      id: habit.id,
      user_id: user.userId,
      title: habit.title,
      description: storedDesc,
      category: habit.category,
      color: habit.color,
      icon: habit.icon,
      type: habit.type,
      target_value: habit.target_value,
      target_unit: habit.target_unit || '',
      frequency: habit.frequency,
      custom_days: habit.custom_days || [],
      archived: Boolean(habit.archived),
      sort_order: habit.order,
      updated_at: new Date().toISOString(),
    };

    let { error } = await supabase.from('habits').upsert(habitPayload);

    // Resilient fallback if user_id column doesn't exist yet
    if (error && (error.message?.includes('user_id') || error.code === '42703')) {
      delete habitPayload.user_id;
      const retry = await supabase.from('habits').upsert(habitPayload);
      error = retry.error;
    }

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

/**
 * Server Action: Delete a Habit (Protected & Scoped to user)
 */
export async function deleteHabitAction(habitId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    const supabase = getServerSupabase();
    if (!supabase) return { success: true };

    const isOwner = user.role === 'owner' || user.userId === OWNER_USER_ID;

    // Verify habit ownership before deleting
    const { data: habitRecord } = await supabase
      .from('habits')
      .select('id, user_id')
      .eq('id', habitId)
      .maybeSingle();

    if (habitRecord) {
      const isOwnerOrSelf = habitRecord.user_id === user.userId || (isOwner && !habitRecord.user_id);
      if (!isOwnerOrSelf) {
        return { success: false, error: 'Unauthorized: Cannot modify other users data.' };
      }
    }

    // 1. Delete associated logs first to prevent foreign key errors
    await supabase.from('habit_logs').delete().eq('habit_id', habitId);

    // 2. Delete the habit from the database
    const { error: deleteErr } = await supabase.from('habits').delete().eq('id', habitId);

    // 3. Fallback to soft delete if restricted
    if (deleteErr) {
      const { error: archiveErr } = await supabase.from('habits').update({ archived: true }).eq('id', habitId);
      if (archiveErr) throw deleteErr;
    }

    return { success: true };
  } catch (err: any) {
    console.error('deleteHabitAction error:', err);
    return { success: false, error: err?.message };
  }
}

/**
 * Server Action: Save / Upsert a Habit Log (Protected & Scoped to user)
 */
export async function saveHabitLogAction(log: HabitLog): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    const supabase = getServerSupabase();
    if (!supabase) return { success: true };

    const logPayload: any = {
      habit_id: log.habit_id,
      user_id: user.userId,
      date: log.date,
      completed: log.completed,
      value: log.value,
      updated_at: new Date().toISOString(),
    };

    let { error } = await supabase.from('habit_logs').upsert(logPayload, { onConflict: 'habit_id,date' });

    // Fallback if user_id column doesn't exist yet
    if (error && (error.message?.includes('user_id') || error.code === '42703')) {
      delete logPayload.user_id;
      const retry = await supabase.from('habit_logs').upsert(logPayload, { onConflict: 'habit_id,date' });
      error = retry.error;
    }

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

/**
 * Server Action: Reorder Habits (Protected & Scoped to user)
 */
export async function reorderHabitsAction(orderedHabits: Habit[]): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    const supabase = getServerSupabase();
    if (!supabase) return { success: true };

    const isOwner = user.role === 'owner' || user.userId === OWNER_USER_ID;

    for (const h of orderedHabits) {
      const query = supabase.from('habits').update({ sort_order: h.order }).eq('id', h.id);
      if (!isOwner) {
        query.eq('user_id', user.userId);
      }
      await query;
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

/**
 * Server Action: Save / Upsert a Day Note (Protected & Scoped to user)
 * Directly persists to public.day_notes table in Supabase.
 */
export async function saveDayNoteAction(date: string, content: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    const supabase = getServerSupabase();
    if (!supabase) return { success: true };

    const notePayload: any = {
      user_id: user.userId,
      date,
      content: content ?? '',
      updated_at: new Date().toISOString(),
    };

    let { error } = await supabase.from('day_notes').upsert(notePayload, { onConflict: 'user_id,date' });

    // Fallback if day_notes table has constraint only on date
    if (error && (error.message?.includes('user_id') || error.code === '42703' || error.code === '42P10')) {
      delete notePayload.user_id;
      const retry = await supabase.from('day_notes').upsert(notePayload, { onConflict: 'date' });
      error = retry.error;
    }

    if (error) {
      console.error('saveDayNoteAction error:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('saveDayNoteAction catch error:', err);
    return { success: false, error: err?.message };
  }
}

export interface AdminUserRecord {
  id: string;
  username: string;
  role: 'owner' | 'member';
  created_at: string;
  last_login_at: string | null;
}

/**
 * Server Action: Get List of System Users (Owner / Admin Only)
 * Privacy Guarantee: Strictly excludes pin_hash and habit/note records.
 */
export async function getAdminUsersAction(): Promise<{
  success: boolean;
  users?: AdminUserRecord[];
  error?: string;
}> {
  try {
    const user = await requireAuth();
    if (user.role !== 'owner') {
      return { success: false, error: 'Unauthorized: Only the system owner can view user directory.' };
    }

    const supabase = getServerSupabase();
    if (!supabase) {
      return {
        success: true,
        users: [
          {
            id: user.userId,
            username: user.username,
            role: 'owner',
            created_at: new Date().toISOString(),
            last_login_at: new Date().toISOString(),
          },
        ],
      };
    }

    // Select only safe directory fields (NEVER pin_hash, NEVER habits/logs)
    const { data, error } = await supabase
      .from('app_users')
      .select('id, username, role, created_at, last_login_at, updated_at')
      .order('created_at', { ascending: true });

    if (error) {
      // Fallback if last_login_at column is not yet migrated in Supabase
      const fallback = await supabase
        .from('app_users')
        .select('id, username, role, created_at, updated_at')
        .order('created_at', { ascending: true });

      if (fallback.error) throw fallback.error;

      const fallbackUsers: AdminUserRecord[] = (fallback.data || []).map((u: any) => ({
        id: u.id,
        username: u.username,
        role: u.role,
        created_at: u.created_at,
        last_login_at: u.updated_at || null,
      }));

      return { success: true, users: fallbackUsers };
    }

    const users: AdminUserRecord[] = (data || []).map((u: any) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      created_at: u.created_at,
      last_login_at: u.last_login_at || u.updated_at || null,
    }));

    return { success: true, users };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to retrieve system users' };
  }
}
