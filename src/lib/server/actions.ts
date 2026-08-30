'use server';

import { createClient } from '@supabase/supabase-js';
import { requireAuth } from './auth';
import { Habit, HabitLog } from '../types';

// Server-side private credentials
function getCleanSupabaseConfig() {
  let url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

  if (!url || !key) return null;

  // Handle accidental dashboard URL paste like https://supabase.com/dashboard/project/abcdefghijklmnop
  const dashboardMatch = url.match(/supabase\.com\/dashboard\/project\/([a-z0-9_-]+)/i);
  if (dashboardMatch && dashboardMatch[1]) {
    url = `https://${dashboardMatch[1]}.supabase.co`;
  }

  // Remove any trailing slashes and subpaths like /rest/v1 that cause PostgREST "Invalid path" error
  url = url.replace(/\/+$/, '');
  if (url.includes('/rest/v1')) {
    url = url.replace(/\/rest\/v1.*$/, '');
  }

  if (!url.startsWith('https://') || url.includes('your-project-url')) {
    return null;
  }

  return { url, key };
}

function getServerSupabase() {
  const config = getCleanSupabaseConfig();
  if (!config) return null;
  return createClient(config.url, config.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Server Action: Fetch habits and logs (Protected by requireAuth)
 */
export async function getHabitsAndLogsAction(): Promise<{
  success: boolean;
  isConfigured: boolean;
  habits?: Habit[];
  logs?: Record<string, HabitLog>;
  error?: string;
}> {
  try {
    await requireAuth();

    const config = getCleanSupabaseConfig();
    if (!config) {
      return { success: true, isConfigured: false, habits: [], logs: {} };
    }

    const supabase = getServerSupabase();
    if (!supabase) {
      return { success: true, isConfigured: false, habits: [], logs: {} };
    }

    // 1. Fetch habits
    const { data: habitsData, error: habitsErr } = await supabase
      .from('habits')
      .select('*')
      .order('sort_order', { ascending: true });

    if (habitsErr) throw habitsErr;

    // 2. Fetch logs
    const { data: logsData, error: logsErr } = await supabase
      .from('habit_logs')
      .select('*')
      .limit(3000);

    if (logsErr) throw logsErr;

    const formattedHabits: Habit[] = (habitsData || []).map((h: any) => ({
      id: h.id,
      title: h.title,
      description: h.description || '',
      category: h.category,
      color: h.color,
      icon: h.icon,
      type: h.type,
      target_value: Number(h.target_value) || 1,
      target_unit: h.target_unit || '',
      frequency: h.frequency,
      custom_days: h.custom_days || [],
      archived: Boolean(h.archived),
      order: h.sort_order || 0,
      created_at: h.created_at,
      updated_at: h.updated_at,
    }));

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

    return {
      success: true,
      isConfigured: true,
      habits: formattedHabits,
      logs: mappedLogs,
    };
  } catch (err: any) {
    return { success: false, isConfigured: Boolean(getCleanSupabaseConfig()), error: err?.message || 'Failed to fetch data' };
  }
}

/**
 * Server Action: Save / Upsert a Habit (Protected)
 */
export async function saveHabitAction(habit: Habit): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAuth();
    const supabase = getServerSupabase();
    if (!supabase) return { success: true };

    const { error } = await supabase.from('habits').upsert({
      id: habit.id,
      title: habit.title,
      description: habit.description || '',
      category: habit.category,
      color: habit.color,
      icon: habit.icon,
      type: habit.type,
      target_value: habit.target_value,
      target_unit: habit.target_unit || '',
      frequency: habit.frequency,
      custom_days: habit.custom_days || [],
      archived: habit.archived,
      sort_order: habit.order,
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

/**
 * Server Action: Delete a Habit (Protected)
 */
export async function deleteHabitAction(habitId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAuth();
    const supabase = getServerSupabase();
    if (!supabase) return { success: true };

    // Delete associated logs first to prevent foreign key errors
    await supabase.from('habit_logs').delete().eq('habit_id', habitId);

    const { error } = await supabase.from('habits').delete().eq('id', habitId);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

/**
 * Server Action: Save / Upsert a Habit Log (Protected)
 */
export async function saveHabitLogAction(log: HabitLog): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAuth();
    const supabase = getServerSupabase();
    if (!supabase) return { success: true };

    const { error } = await supabase.from('habit_logs').upsert({
      habit_id: log.habit_id,
      date: log.date,
      completed: log.completed,
      value: log.value,
      notes: log.notes || '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'habit_id,date' });

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

/**
 * Server Action: Reorder Habits (Protected)
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
