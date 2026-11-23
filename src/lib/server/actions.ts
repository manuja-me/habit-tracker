'use server';

import { requireAuth } from './auth';
import { OWNER_USER_ID, isOwnerUser, canAccessUserRecord, isValidUuid } from './auth-utils';
import { getCleanSupabaseConfig, getServerSupabase } from './supabase';
import { purgeUserData, purgeExpiredDeactivatedUsers } from './user-management';
import type { Habit, HabitCategory, HabitFrequency, HabitLog, HabitType, Project, ProjectGroup, ProjectStatus, ProjectTask } from '../types';
import { getPlannerCutoffDate, getPlannerCutoffDateString, isPlannerNoteExpired } from '../utils/date';
import { parseHabitDescription, serializeHabitDescription } from '../utils/habit-serialization';

/**
 * Permanently delete planner day_notes older than 3 months after creation date
 */
async function purgeExpiredDayNotes(
  supabaseClient?: ReturnType<typeof getServerSupabase>,
  now: Date = new Date()
): Promise<void> {
  const supabase = supabaseClient || getServerSupabase();
  if (!supabase) return;

  const cutoffIso = getPlannerCutoffDate(now).toISOString();
  const cutoffDateStr = getPlannerCutoffDateString(now);

  try {
    await Promise.allSettled([
      supabase.from('day_notes').delete().lte('created_at', cutoffIso),
      supabase.from('day_notes').delete().lte('date', cutoffDateStr),
    ]);
  } catch {
    // Ignore cleanup errors on unmigrated tables
  }
}

interface DbHabitRecord {
  id: string;
  user_id?: string | null;
  title: string;
  description?: string | null;
  category: HabitCategory;
  color: string;
  icon: string;
  type: HabitType;
  target_value: number;
  target_unit?: string | null;
  frequency: HabitFrequency;
  custom_days?: number[] | null;
  archived?: boolean | null;
  sort_order?: number | null;
  created_at: string;
  updated_at?: string | null;
}

interface DbLogRecord {
  id: string;
  habit_id: string;
  date: string;
  completed: boolean;
  value: number;
  created_at: string;
  updated_at: string;
}

type LogPage = {
  data: DbLogRecord[] | null;
  count: number | null;
  error: { code: string; message: string } | null;
};

async function readLogs(readPage: (start: number, end: number) => PromiseLike<LogPage>) {
  const rows: DbLogRecord[] = [];
  const pageSize = 500;
  for (;;) {
    const page = await readPage(rows.length, rows.length + pageSize - 1);
    if (page.error) return { data: null, error: page.error };
    if (!page.data?.length) return { data: rows, error: null };
    rows.push(...page.data);
    if (page.count !== null && rows.length >= page.count) return { data: rows, error: null };
  }
}

interface DbDayNoteRecord {
  date: string;
  content: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AdminUserRecord {
  id: string;
  username: string;
  role: 'owner' | 'member';
  created_at: string;
  last_login_at: string | null;
  deactivated_at?: string | null;
}

interface DbAdminUserRow {
  id: string;
  username: string;
  role: 'owner' | 'member';
  created_at: string;
  last_login_at?: string | null;
  updated_at?: string | null;
  deactivated_at?: string | null;
}

function getErrorMessage(err: unknown, defaultMessage = 'An unexpected error occurred'): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') return err.message;
  return defaultMessage;
}

function isMissingColumn(error: { code: string; message: string } | null, column: string) {
  return (error?.code === '42703' || error?.code === 'PGRST204') && error.message.includes(column);
}

async function requireExpectedAccount(expectedUserId?: string) {
  const user = await requireAuth();
  if (expectedUserId !== undefined && user.userId !== expectedUserId) {
    throw new Error('The signed-in account changed. Lock and unlock Zenith to continue.');
  }
  return user;
}

/**
 * Server Action: Fetch habits and logs scoped to the authenticated user
 */
export async function getHabitsAndLogsAction(expectedUserId?: string): Promise<{
  success: boolean;
  isConfigured: boolean;
  habits?: Habit[];
  logs?: Record<string, HabitLog>;
  dayNotes?: Record<string, string>;
  lastActiveAt?: string | null;
  error?: string;
  user?: { id: string; username: string; role: string };
}> {
  try {
    const user = await requireExpectedAccount(expectedUserId);
    if (!isValidUuid(user.userId)) {
      throw new Error('Invalid authenticated user ID.');
    }

    const config = getCleanSupabaseConfig();
    if (!config) {
      return { success: true, isConfigured: false, habits: [], logs: {}, dayNotes: {}, user: { id: user.userId, username: user.username, role: user.role } };
    }

    const supabase = getServerSupabase();
    if (!supabase) {
      return { success: true, isConfigured: false, habits: [], logs: {}, dayNotes: {}, user: { id: user.userId, username: user.username, role: user.role } };
    }

    const isOwner = isOwnerUser(user);

    // Compute date cutoffs: 370 days for habit_logs (52-week heatmap), 3 months for planner day_notes
    const now = new Date();
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - 370);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    const plannerCutoffDateStr = getPlannerCutoffDateString(now);

    // Decouple day notes purge from critical read path
    void purgeExpiredDayNotes(supabase, now).catch(() => {});

    // Query habits, habit_logs (scoped by user_id with fallback), day_notes, and app_users concurrently in 1 round-trip
    const [habitsRes, logsRes, notesRes, userRes] = await Promise.all([
      supabase
        .from('habits')
        .select('*')
        .eq('archived', false)
        .or(isOwner ? `user_id.eq.${user.userId},user_id.is.null` : `user_id.eq.${user.userId}`)
        .order('sort_order', { ascending: true }),
      readLogs((start, end) => supabase
        .from('habit_logs')
        .select('id, habit_id, date, completed, value, created_at, updated_at', { count: 'exact' })
        .gte('date', cutoffDateStr)
        .or(isOwner ? `user_id.eq.${user.userId},user_id.is.null` : `user_id.eq.${user.userId}`)
        .order('date', { ascending: false })
        .order('id')
        .range(start, end)),
      supabase
        .from('day_notes')
        .select('date, content, created_at, updated_at')
        .gt('date', plannerCutoffDateStr)
        .or(isOwner ? `user_id.eq.${user.userId},user_id.is.null` : `user_id.eq.${user.userId}`),
      supabase
        .from('app_users')
        .select('updated_at, last_login_at')
        .eq('id', user.userId)
        .maybeSingle(),
    ]);

    let habitsData: DbHabitRecord[] = [];
    if (habitsRes.error) {
      // Fallback for pre-migration databases: owner gets all, new member gets empty
      if (!isMissingColumn(habitsRes.error, 'user_id')) throw habitsRes.error;
      if (isOwner) {
        const fallbackRes = await supabase
          .from('habits')
          .select('*')
          .eq('archived', false)
          .order('sort_order', { ascending: true });
        if (fallbackRes.error) throw fallbackRes.error;
        habitsData = (fallbackRes.data as DbHabitRecord[]) || [];
      } else {
        habitsData = [];
      }
    } else {
      habitsData = (habitsRes.data as DbHabitRecord[]) || [];
    }

    const validHabitIdSet = new Set(habitsData.map((h) => h.id));
    let logsData: DbLogRecord[] = [];

    if (logsRes.error) {
      // Fallback for pre-migration databases without user_id column on habit_logs
      if (!isMissingColumn(logsRes.error, 'user_id')) throw logsRes.error;
      const userHabitIds = habitsData.map((h) => h.id);
      if (userHabitIds.length > 0) {
        const fallbackLogsRes = await readLogs((start, end) => supabase
          .from('habit_logs')
          .select('id, habit_id, date, completed, value, created_at, updated_at', { count: 'exact' })
          .in('habit_id', userHabitIds)
          .gte('date', cutoffDateStr)
          .order('date', { ascending: false })
          .order('id')
          .range(start, end));
        if (fallbackLogsRes.error) throw fallbackLogsRes.error;
        logsData = (fallbackLogsRes.data || []) as DbLogRecord[];
      }
    } else if (logsRes.data) {
      logsData = (logsRes.data as DbLogRecord[]).filter((l) => validHabitIdSet.has(l.habit_id));
    }

    const dayNotesMap: Record<string, string> = {};

    let latestMs = 0;
    const trackTime = (iso?: string | null) => {
      if (!iso) return;
      const t = Date.parse(iso);
      if (Number.isFinite(t) && t > latestMs) latestMs = t;
    };

    const userRow = userRes.data as { updated_at?: string | null; last_login_at?: string | null } | null;
    trackTime(userRow?.last_login_at);
    trackTime(userRow?.updated_at);
    habitsData.forEach((h) => {
      trackTime(h.updated_at);
      trackTime(h.created_at);
    });
    logsData.forEach((l) => {
      trackTime(l.updated_at);
      trackTime(l.created_at);
    });

    let notesData = notesRes.data;
    if (notesRes.error) {
      if (!isMissingColumn(notesRes.error, 'user_id')) throw notesRes.error;
      if (isOwner) {
        const legacyNotes = await supabase
          .from('day_notes')
          .select('date, content, updated_at')
          .gt('date', plannerCutoffDateStr);
        if (legacyNotes.error) throw legacyNotes.error;
        notesData = legacyNotes.data?.map((note) => ({ ...note, created_at: null })) ?? [];
      }
    }
    if (notesData) {
      (notesData as DbDayNoteRecord[]).forEach((dn) => {
        trackTime(dn.updated_at);
        if (
          dn.date &&
          typeof dn.content === 'string' &&
          dn.content.trim() !== '' &&
          !isPlannerNoteExpired(dn.date, dn.created_at, now)
        ) {
          dayNotesMap[dn.date] = dn.content;
        }
      });
    }

    const formattedHabits: Habit[] = habitsData.map((h) => {
      const { cleanDescription, isDont, weaningConfig, replacement_habit_id } = parseHabitDescription(h.description);

      return {
        id: h.id,
        title: h.title,
        description: cleanDescription,
        category: h.category,
        color: h.color,
        icon: h.icon,
        type: h.type,
        nature: (isDont ? 'dont' : 'do') as Habit['nature'],
        weaning: weaningConfig || (isDont ? { enabled: true, protocol: 'exponential' } : undefined),
        replacement_habit_id: replacement_habit_id || (h as unknown as Record<string, unknown>).replacement_habit_id as string | undefined || undefined,
        target_value: Number(h.target_value) || 1,
        target_unit: h.target_unit || '',
        frequency: h.frequency,
        custom_days: h.custom_days || [],
        archived: Boolean(h.archived),
        order: h.sort_order || 0,
        created_at: h.created_at,
        updated_at: h.updated_at || undefined,
      };
    });

    const mappedLogs: Record<string, HabitLog> = {};
    logsData.forEach((l) => {
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

    return {
      success: true,
      isConfigured: true,
      habits: formattedHabits,
      logs: mappedLogs,
      dayNotes: dayNotesMap,
      lastActiveAt: latestMs > 0 ? new Date(latestMs).toISOString() : null,
      user: { id: user.userId, username: user.username, role: user.role },
    };
  } catch (err: unknown) {
    return {
      success: false,
      isConfigured: Boolean(getCleanSupabaseConfig()),
      error: getErrorMessage(err, 'Failed to fetch data'),
    };
  }
}

/**
 * Server Action: Record account-level visit timestamp across devices
 */
export async function recordAccountVisitAction(expectedUserId?: string): Promise<{ success: boolean }> {
  try {
    const user = await requireExpectedAccount(expectedUserId);
    const supabase = getServerSupabase();
    if (!supabase) return { success: true };

    const { error } = await supabase
      .from('app_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.userId);
    return { success: !error };
  } catch {
    return { success: false };
  }
}

/**
 * Server Action: Save / Upsert a Habit (Protected & Scoped to user)
 */
export async function saveHabitAction(habit: Habit, expectedUserId?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireExpectedAccount(expectedUserId);
    if (!habit || !isValidUuid(habit.id)) {
      return { success: false, error: 'Invalid habit ID.' };
    }
    if (!habit.title || typeof habit.title !== 'string' || !habit.title.trim()) {
      return { success: false, error: 'Habit title is required.' };
    }
    const cleanTitle = habit.title.trim().slice(0, 200);
    const cleanTargetValue = Number.isFinite(Number(habit.target_value)) ? Math.max(0, Number(habit.target_value)) : 1;
    const supabase = getServerSupabase();
    if (!supabase) return { success: true };

    // Verify ownership if habit already exists (Prevents IDOR overwrite)
    const { data: existingHabit, error: lookupError } = await supabase
      .from('habits')
      .select('id, user_id')
      .eq('id', habit.id)
      .maybeSingle();

    const legacyOwner = isOwnerUser(user) && isMissingColumn(lookupError, 'user_id');
    if (lookupError && !legacyOwner) throw lookupError;
    if (existingHabit && !canAccessUserRecord(user, existingHabit.user_id)) {
      return { success: false, error: 'Unauthorized: Cannot modify habit belonging to another user.' };
    }

    const storedDesc = serializeHabitDescription(habit);

    const habitPayload: Record<string, unknown> = {
      id: habit.id,
      user_id: user.userId,
      title: cleanTitle,
      description: storedDesc,
      category: habit.category,
      color: habit.color,
      icon: habit.icon,
      type: habit.type,
      target_value: cleanTargetValue,
      target_unit: habit.target_unit ? String(habit.target_unit).slice(0, 50) : '',
      frequency: habit.frequency,
      custom_days: habit.custom_days || [],
      archived: Boolean(habit.archived),
      sort_order: habit.order,
      updated_at: new Date().toISOString(),
      replacement_habit_id: habit.nature === 'dont' ? (habit.replacement_habit_id || null) : null,
    };

    if (legacyOwner) delete habitPayload.user_id;
    const persist = () => {
      const table = supabase.from('habits');
      if (legacyOwner) return table.upsert(habitPayload);
      if (!existingHabit) return table.insert(habitPayload);
      const update = table.update(habitPayload).eq('id', habit.id);
      return existingHabit.user_id === null
        ? update.is('user_id', null)
        : update.eq('user_id', user.userId);
    };
    let { error } = await persist();
    if (isMissingColumn(error, 'replacement_habit_id')) {
      delete habitPayload.replacement_habit_id;
      ({ error } = await persist());
    }

    if (error) throw error;
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, 'Failed to save habit') };
  }
}

/**
 * Server Action: Delete a Habit (Protected & Scoped to user)
 */
export async function deleteHabitAction(habitId: string, expectedUserId?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireExpectedAccount(expectedUserId);
    if (!isValidUuid(habitId)) {
      return { success: false, error: 'Invalid habit ID.' };
    }
    const supabase = getServerSupabase();
    if (!supabase) return { success: true };

    // The foreign key deletes logs in the same transaction as the habit.
    const owned = supabase.from('habits').delete().eq('id', habitId);
    const result = await (isOwnerUser(user)
      ? owned.or(`user_id.eq.${user.userId},user_id.is.null`)
      : owned.eq('user_id', user.userId));
    if (isOwnerUser(user) && isMissingColumn(result.error, 'user_id')) {
      const legacy = await supabase.from('habits').delete().eq('id', habitId);
      if (legacy.error) throw legacy.error;
    } else if (result.error) {
      throw result.error;
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, 'Failed to delete habit') };
  }
}

/**
 * Server Action: Save / Upsert a Habit Log (Protected & Scoped to user)
 */
export async function saveHabitLogAction(log: HabitLog, expectedUserId?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireExpectedAccount(expectedUserId);
    if (!log || !isValidUuid(log.habit_id)) {
      return { success: false, error: 'Invalid habit ID.' };
    }
    if (!log.date || typeof log.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(log.date)) {
      return { success: false, error: 'Invalid date format.' };
    }
    const supabase = getServerSupabase();
    if (!supabase) return { success: true };

    // Verify parent habit exists and belongs to the authenticated user
    const { data: parentHabit, error: parentError } = await supabase
      .from('habits')
      .select('id, user_id')
      .eq('id', log.habit_id)
      .maybeSingle();

    if (parentError) {
      if (!isOwnerUser(user) || !isMissingColumn(parentError, 'user_id')) throw parentError;
      const legacy = await supabase.from('habits').select('id').eq('id', log.habit_id).single();
      if (legacy.error) throw legacy.error;
    } else if (!parentHabit) {
      return { success: false, error: 'Habit not found.' };
    } else if (!canAccessUserRecord(user, parentHabit.user_id)) {
      return { success: false, error: 'Unauthorized: Cannot log progress for another user\'s habit.' };
    }

    const logPayload = {
      habit_id: log.habit_id,
      user_id: user.userId,
      date: log.date,
      completed: log.completed,
      value: log.value,
      updated_at: new Date().toISOString(),
    };

    let { error } = await supabase.from('habit_logs').upsert(logPayload, { onConflict: 'habit_id,date' });

    // Fallback if user_id column doesn't exist yet
    if (isOwnerUser(user) && isMissingColumn(error, 'user_id')) {
      const fallbackPayload: Record<string, unknown> = { ...logPayload };
      delete fallbackPayload.user_id;
      const retry = await supabase.from('habit_logs').upsert(fallbackPayload, { onConflict: 'habit_id,date' });
      error = retry.error;
    }

    if (error) throw error;
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, 'Failed to save habit log') };
  }
}

/**
 * Server Action: Reorder Habits (Protected & Scoped to user)
 */
export async function reorderHabitsAction(orderedHabits: Habit[], expectedUserId?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireExpectedAccount(expectedUserId);
    if (!isValidUuid(user.userId)) {
      throw new Error('Invalid authenticated user ID.');
    }
    const supabase = getServerSupabase();
    if (!supabase) return { success: true };

    const isOwner = isOwnerUser(user);

    const results = await Promise.all(
      orderedHabits.map((h) => {
        const query = supabase.from('habits').update({ sort_order: h.order }).eq('id', h.id);
        return isOwner
          ? query.or(`user_id.eq.${user.userId},user_id.is.null`)
          : query.eq('user_id', user.userId);
      })
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, 'Failed to reorder habits') };
  }
}

/**
 * Server Action: Save / Upsert a Day Note (Protected & Scoped to user)
 * Directly persists to public.day_notes table in Supabase.
 */
export async function saveDayNoteAction(date: string, content: string, expectedUserId?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireExpectedAccount(expectedUserId);
    if (!isValidUuid(user.userId)) {
      throw new Error('Invalid authenticated user ID.');
    }
    if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { success: false, error: 'Invalid date format.' };
    }
    const supabase = getServerSupabase();
    if (!supabase) return { success: true };

    await purgeExpiredDayNotes(supabase);

    const cleanContent = typeof content === 'string' ? content.slice(0, 50000) : '';
    if (!cleanContent.trim() || isPlannerNoteExpired(date)) {
      const delRes = await supabase
        .from('day_notes')
        .delete()
        .eq('user_id', user.userId)
        .eq('date', date);
      if (isOwnerUser(user) && isMissingColumn(delRes.error, 'user_id')) {
        const retry = await supabase.from('day_notes').delete().eq('date', date);
        if (retry.error) throw retry.error;
      } else if (delRes.error) {
        throw delRes.error;
      }
      return { success: true };
    }

    const notePayload = {
      user_id: user.userId,
      date,
      content: cleanContent,
      updated_at: new Date().toISOString(),
    };

    let { error } = await supabase.from('day_notes').upsert(notePayload, { onConflict: 'user_id,date' });

    // Fallback only if legacy day_notes table lacks user_id column entirely (owner only)
    if (isOwnerUser(user) && isMissingColumn(error, 'user_id')) {
      const fallbackPayload: Record<string, unknown> = { ...notePayload };
      delete fallbackPayload.user_id;
      const retry = await supabase.from('day_notes').upsert(fallbackPayload, { onConflict: 'date' });
      error = retry.error;
    }

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, 'Failed to save note') };
  }
}

interface DbProjectRecord {
  id: string;
  title: string;
  notes: string;
  status: ProjectStatus;
  group_id: string | null;
  tasks: ProjectTask[];
  sort_order: number;
  created_at: string;
}

/**
 * Server Action: Fetch projects + their owning orgs/people, scoped to the authenticated user
 */
export async function getProjectsAction(expectedUserId?: string): Promise<{
  success: boolean;
  isConfigured: boolean;
  projects?: Project[];
  groups?: ProjectGroup[];
  error?: string;
}> {
  try {
    const user = await requireExpectedAccount(expectedUserId);
    const supabase = getServerSupabase();
    if (!supabase) return { success: true, isConfigured: false, projects: [], groups: [] };

    const [projectsRes, groupsRes] = await Promise.all([
      supabase
        .from('projects')
        .select('id, title, notes, status, group_id, tasks, sort_order, created_at')
        .eq('user_id', user.userId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('project_groups')
        .select('*')
        .eq('user_id', user.userId)
        .order('name', { ascending: true }),
    ]);
    if (projectsRes.error) throw projectsRes.error;
    if (groupsRes.error) throw groupsRes.error;

    const projects = ((projectsRes.data || []) as DbProjectRecord[]).map((p) => ({
      id: p.id,
      title: p.title,
      notes: p.notes || '',
      status: p.status,
      group_id: p.group_id ?? null,
      tasks: Array.isArray(p.tasks) ? p.tasks : [],
      order: p.sort_order,
      created_at: p.created_at,
    }));
    return { success: true, isConfigured: true, projects, groups: (groupsRes.data || []).map(({ id, name, kind, color }) => ({ id, name, kind, color })) };
  } catch (err: unknown) {
    return { success: false, isConfigured: true, error: getErrorMessage(err, 'Failed to load projects') };
  }
}

/**
 * Server Action: Create / update a Project (Protected & Scoped to user)
 */
export async function saveProjectAction(project: Project, expectedUserId?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireExpectedAccount(expectedUserId);
    const supabase = getServerSupabase();
    if (!supabase) return { success: true };

    const title = String(project?.title ?? '').trim().slice(0, 200);
    const groupId = project?.group_id ?? null;
    if (!isValidUuid(project?.id)) return { success: false, error: 'Invalid project id.' };
    if (!title) return { success: false, error: 'Project title is required.' };
    if (project.status !== 'active' && project.status !== 'planned') return { success: false, error: 'Invalid status.' };
    if (!Array.isArray(project.tasks) || project.tasks.length > 500) return { success: false, error: 'Invalid subtasks.' };

    // Only allow assigning to an org/person owned by this user
    if (groupId !== null) {
      if (!isValidUuid(groupId)) return { success: false, error: 'Invalid organization.' };
      const { data: group } = await supabase
        .from('project_groups')
        .select('id')
        .eq('id', groupId)
        .eq('user_id', user.userId)
        .maybeSingle();
      if (!group) return { success: false, error: 'Organization / person not found.' };
    }

    const tasks: ProjectTask[] = project.tasks.map((t) => ({
      id: String(t.id).slice(0, 64),
      title: String(t.title ?? '').slice(0, 500),
      done: Boolean(t.done),
    }));

    // Block overwriting another user's project via a known id
    const { data: existing, error: lookupError } = await supabase.from('projects').select('user_id').eq('id', project.id).maybeSingle();
    if (lookupError) throw lookupError;
    if (existing && existing.user_id !== user.userId) {
      return { success: false, error: 'Unauthorized: Cannot modify other users data.' };
    }

    const projectPayload = {
      id: project.id,
      user_id: user.userId,
      title,
      notes: String(project.notes ?? '').slice(0, 20000),
      status: project.status,
      group_id: groupId,
      tasks,
      sort_order: Number.isFinite(project.order) ? Math.trunc(project.order) : 0,
    };
    const table = supabase.from('projects');
    const { error } = existing
      ? await table.update(projectPayload).eq('id', project.id).eq('user_id', user.userId)
      : await table.insert(projectPayload);
    if (error) throw error;
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, 'Failed to save project') };
  }
}

/**
 * Server Action: Create / rename an Organization or Person (Protected & Scoped to user)
 */
export async function saveProjectGroupAction(group: ProjectGroup, expectedUserId?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireExpectedAccount(expectedUserId);
    const supabase = getServerSupabase();
    if (!supabase) return { success: true };

    const name = String(group?.name ?? '').trim().slice(0, 100);
    if (!isValidUuid(group?.id)) return { success: false, error: 'Invalid id.' };
    if (!name) return { success: false, error: 'Name is required.' };
    if (group.kind !== 'org' && group.kind !== 'person') return { success: false, error: 'Invalid type.' };

    const { data: existing, error: lookupError } = await supabase.from('project_groups').select('user_id').eq('id', group.id).maybeSingle();
    if (lookupError) throw lookupError;
    if (existing && existing.user_id !== user.userId) {
      return { success: false, error: 'Unauthorized: Cannot modify other users data.' };
    }

    const groupPayload: Record<string, unknown> = {
      id: group.id,
      user_id: user.userId,
      name,
      kind: group.kind,
      color: group.color || '#FE8019',
    };

    const persist = () => {
      const table = supabase.from('project_groups');
      return existing
        ? table.update(groupPayload).eq('id', group.id).eq('user_id', user.userId)
        : table.insert(groupPayload);
    };
    let { error } = await persist();
    // Graceful fallback if color column isn't migrated in DB yet
    if (isMissingColumn(error, 'color')) {
      delete groupPayload.color;
      const retry = await persist();
      error = retry.error;
    }
    if (error) throw error;
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, 'Failed to save organization') };
  }
}

/**
 * Server Action: Delete an Organization or Person. Its projects become Unassigned (FK ON DELETE SET NULL).
 */
export async function deleteProjectGroupAction(groupId: string, expectedUserId?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireExpectedAccount(expectedUserId);
    const supabase = getServerSupabase();
    if (!supabase) return { success: true };
    if (!isValidUuid(groupId)) return { success: false, error: 'Invalid id.' };

    const { error } = await supabase.from('project_groups').delete().eq('id', groupId).eq('user_id', user.userId);
    if (error) throw error;
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, 'Failed to delete organization') };
  }
}

/**
 * Server Action: Delete a Project (Protected & Scoped to user)
 */
export async function deleteProjectAction(projectId: string, expectedUserId?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireExpectedAccount(expectedUserId);
    const supabase = getServerSupabase();
    if (!supabase) return { success: true };
    if (!isValidUuid(projectId)) return { success: false, error: 'Invalid project id.' };

    const { error } = await supabase.from('projects').delete().eq('id', projectId).eq('user_id', user.userId);
    if (error) throw error;
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, 'Failed to delete project') };
  }
}

/**
 * Server Action: Hard delete a user without requiring their PIN (Owner Only)
 * Permanently removes user, habits, habit_logs, day_notes, and invitations.
 */
export async function adminDeleteUserAction(targetUserId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const caller = await requireAuth();

    if (!isOwnerUser(caller)) {
      return { success: false, error: 'Unauthorized: Only the system owner can delete users.' };
    }

    if (!targetUserId || !isValidUuid(targetUserId)) {
      return { success: false, error: 'Invalid user ID format.' };
    }

    if (targetUserId === OWNER_USER_ID || targetUserId === caller.userId) {
      return { success: false, error: 'The Master Owner account cannot be deleted.' };
    }

    const supabase = getServerSupabase();
    if (!supabase) {
      return { success: false, error: 'Database connection failed.' };
    }

    // Verify user exists and is not owner
    const { data: targetUser, error: checkErr } = await supabase
      .from('app_users')
      .select('id, role')
      .eq('id', targetUserId)
      .maybeSingle();

    if (checkErr) {
      return { success: false, error: checkErr.message };
    }

    if (!targetUser) {
      return { success: false, error: 'User not found in system directory.' };
    }

    if (targetUser.role === 'owner') {
      return { success: false, error: 'Owner accounts cannot be deleted.' };
    }

    const deleted = await purgeUserData(supabase, targetUserId);
    if (!deleted) {
      return { success: false, error: 'Failed to purge user records.' };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, 'Failed to delete user.') };
  }
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
    if (!isOwnerUser(user)) {
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
            deactivated_at: null,
          },
        ],
      };
    }

    // Trigger automatic purge of users whose 7-day deactivation period has expired
    await purgeExpiredDeactivatedUsers(supabase);

    // Select only safe directory fields (NEVER pin_hash, NEVER habits/logs)
    const { data, error } = await supabase
      .from('app_users')
      .select('id, username, role, created_at, last_login_at, updated_at, deactivated_at')
      .order('created_at', { ascending: true });

    if (error) {
      // Tier 1 Fallback: deactivated_at is not yet migrated, but last_login_at is present
      const fallbackWithLogin = await supabase
        .from('app_users')
        .select('id, username, role, created_at, last_login_at, updated_at')
        .order('created_at', { ascending: true });

      if (!fallbackWithLogin.error && fallbackWithLogin.data) {
        const users: AdminUserRecord[] = (fallbackWithLogin.data as DbAdminUserRow[]).map((u) => ({
          id: u.id,
          username: u.username,
          role: u.role,
          created_at: u.created_at,
          last_login_at: u.last_login_at || u.updated_at || null,
          deactivated_at: null,
        }));
        return { success: true, users };
      }

      // Tier 2 Fallback: neither deactivated_at nor last_login_at are migrated
      const fallback = await supabase
        .from('app_users')
        .select('id, username, role, created_at, updated_at')
        .order('created_at', { ascending: true });

      if (fallback.error) throw fallback.error;

      const fallbackUsers: AdminUserRecord[] = ((fallback.data || []) as DbAdminUserRow[]).map((u) => ({
        id: u.id,
        username: u.username,
        role: u.role,
        created_at: u.created_at,
        last_login_at: u.updated_at || null,
        deactivated_at: null,
      }));

      return { success: true, users: fallbackUsers };
    }

    const users: AdminUserRecord[] = ((data || []) as DbAdminUserRow[]).map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      created_at: u.created_at,
      last_login_at: u.last_login_at || u.updated_at || null,
      deactivated_at: u.deactivated_at || null,
    }));

    return { success: true, users };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, 'Failed to retrieve system users') };
  }
}
