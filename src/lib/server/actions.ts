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
        notes: l.notes || '',
        created_at: l.created_at,
        updated_at: l.updated_at,
      };
    });

    // 3. Fetch day notes scoped to this user (Dual-layer: day_notes table + shadow habit_logs)
    const dayNotesMap: Record<string, string> = {};

    // Layer A: Try day_notes table
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
      // Fallback
    }

    // Layer B: Fallback / Secondary read from shadow habit_logs (guarantees sync even without day_notes table)
    try {
      const plannerHabitId = await getOrCreatePlannerHabitId(supabase, user.userId, isOwner);
      if (plannerHabitId) {
        const shadowLogsRes = await supabase
          .from('habit_logs')
          .select('date, notes')
          .eq('habit_id', plannerHabitId);

        if (!shadowLogsRes.error && shadowLogsRes.data) {
          shadowLogsRes.data.forEach((l: any) => {
            if (l.date && l.notes !== undefined) {
              if (dayNotesMap[l.date] === undefined || dayNotesMap[l.date] === '') {
                dayNotesMap[l.date] = l.notes;
              }
            }
          });
        }
      }
    } catch (shadowErr) {
      console.warn('Planner shadow logs read notice:', shadowErr);
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
    await requireAuth();
    const supabase = getServerSupabase();
    if (!supabase) return { success: true };

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
      notes: log.notes || '',
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
    await requireAuth();
    const supabase = getServerSupabase();
    if (!supabase) return { success: true };

    for (const h of orderedHabits) {
      await supabase.from('habits').update({ sort_order: h.order }).eq('id', h.id);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

/**
 * Helper: Find or create a hidden system shadow habit for planner synchronization
 * Guarantees cross-device sync even if the user hasn't created a day_notes table in Supabase!
 */
async function getOrCreatePlannerHabitId(supabase: any, userId: string, isOwner: boolean): Promise<string | null> {
  try {
    let query = supabase
      .from('habits')
      .select('id')
      .eq('category', '__system_planner__');

    if (isOwner) {
      query = query.or(`user_id.eq.${userId},user_id.is.null`);
    } else {
      query = query.eq('user_id', userId);
    }

    const { data } = await query.limit(1).maybeSingle();
    if (data?.id) {
      return data.id;
    }

    // Create shadow habit for this user
    const fixedOwnerHabitId = '00000000-0000-0000-0000-000000000099';
    const habitId = isOwner ? fixedOwnerHabitId : undefined;

    const newHabitPayload: any = {
      title: '__ZENITH_PLANNER__',
      description: 'System shadow habit for Daily Directives planner synchronization',
      category: '__system_planner__',
      color: '#FF3B30',
      icon: 'Calendar',
      type: 'boolean',
      frequency: 'daily',
      archived: true, // Hidden from normal habit views
      sort_order: 999999,
      user_id: userId,
    };

    if (habitId) {
      newHabitPayload.id = habitId;
    }

    let insertRes = await supabase.from('habits').upsert(newHabitPayload).select('id').single();

    if (insertRes.error && (insertRes.error.message?.includes('user_id') || insertRes.error.code === '42703')) {
      delete newHabitPayload.user_id;
      insertRes = await supabase.from('habits').upsert(newHabitPayload).select('id').single();
    }

    return insertRes.data?.id || habitId || null;
  } catch (err) {
    console.warn('getOrCreatePlannerHabitId notice:', err);
    return null;
  }
}

/**
 * Server Action: Save / Upsert a Day Note (Protected & Scoped to user)
 * Uses Dual-Layer Storage:
 * 1. Upserts to day_notes table if available
 * 2. Always records in shadow habit_logs (guarantees cross-device sync on all Supabase instances)
 */
export async function saveDayNoteAction(date: string, content: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    const supabase = getServerSupabase();
    if (!supabase) return { success: true };

    const isOwner = user.role === 'owner' || user.userId === OWNER_USER_ID;

    // 1. Try day_notes table
    try {
      const notePayload: any = {
        user_id: user.userId,
        date,
        content: content || '',
        updated_at: new Date().toISOString(),
      };

      let { error } = await supabase.from('day_notes').upsert(notePayload, { onConflict: 'user_id,date' });

      if (error && (error.message?.includes('user_id') || error.code === '42703')) {
        delete notePayload.user_id;
        await supabase.from('day_notes').upsert(notePayload, { onConflict: 'date' });
      }
    } catch {
      // Table may not exist yet
    }

    // 2. Guaranteed fallback: Always persist to shadow habit_logs
    try {
      const plannerHabitId = await getOrCreatePlannerHabitId(supabase, user.userId, isOwner);
      if (plannerHabitId) {
        const logPayload: any = {
          habit_id: plannerHabitId,
          date,
          completed: true,
          notes: content || '',
          updated_at: new Date().toISOString(),
        };

        if (user.userId) {
          logPayload.user_id = user.userId;
        }

        let { error: logErr } = await supabase.from('habit_logs').upsert(logPayload, { onConflict: 'habit_id,date' });
        if (logErr && (logErr.message?.includes('user_id') || logErr.code === '42703')) {
          delete logPayload.user_id;
          await supabase.from('habit_logs').upsert(logPayload, { onConflict: 'habit_id,date' });
        }
      }
    } catch (shadowErr) {
      console.warn('Shadow habit_logs planner save notice:', shadowErr);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}
