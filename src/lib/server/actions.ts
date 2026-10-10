'use server';

import { requireAuth } from './auth';
import { OWNER_USER_ID, isOwnerUser, canAccessUserRecord } from './auth-utils';
import { getCleanSupabaseConfig, getServerSupabase } from './supabase';
import { purgeUserData, purgeExpiredDeactivatedUsers } from './user-management';
import { Habit, HabitCategory, HabitFrequency, HabitLog, HabitType, Project, ProjectGroup, ProjectStatus, ProjectTask } from '../types';

export { purgeExpiredDeactivatedUsers };

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

interface DbDayNoteRecord {
  date: string;
  content: string;
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
  return defaultMessage;
}

function parseHabitDescription(rawDesc?: string | null): {
  cleanDescription: string;
  isDont: boolean;
  weaningConfig?: Habit['weaning'];
} {
  const desc = rawDesc || '';
  const isDont = desc.includes('[NATURE:DONT]');
  let weaningConfig: Habit['weaning'] = undefined;
  const weaningMatch = desc.match(/\[WEANING:(.*?)\]/);
  if (weaningMatch && weaningMatch[1]) {
    try {
      weaningConfig = JSON.parse(weaningMatch[1]);
    } catch {}
  }
  const cleanDescription = desc
    .replace(/\s*\[NATURE:DONT\]/g, '')
    .replace(/\s*\[WEANING:.*?\]/g, '')
    .trim();

  return { cleanDescription, isDont, weaningConfig };
}

function serializeHabitDescription(habit: Habit): string {
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
  return storedDesc;
}

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
    let habitsData: DbHabitRecord[] = [];
    const isOwner = isOwnerUser(user);

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
        habitsData = (fallbackRes.data as DbHabitRecord[]) || [];
      } else {
        habitsData = [];
      }
    } else {
      habitsData = (habitsRes.data as DbHabitRecord[]) || [];
    }

    // 2. Compute date cutoff: past 370 days covers 52-week heatmap, year history, and day planner
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 370);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    const userHabitIds = habitsData.map((h) => h.id);
    let logsData: DbLogRecord[] = [];
    const dayNotesMap: Record<string, string> = {};

    // Run habit_logs and day_notes queries concurrently to halve serverless latency
    const [logsRes, notesRes] = await Promise.all([
      userHabitIds.length > 0
        ? supabase
            .from('habit_logs')
            .select('id, habit_id, date, completed, value, created_at, updated_at')
            .in('habit_id', userHabitIds)
            .gte('date', cutoffDateStr)
            .order('date', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('day_notes')
        .select('date, content')
        .gte('date', cutoffDateStr)
        .or(isOwner ? `user_id.eq.${user.userId},user_id.is.null` : `user_id.eq.${user.userId}`),
    ]);

    if (!logsRes.error && logsRes.data) {
      logsData = logsRes.data as DbLogRecord[];
    }

    if (!notesRes.error && notesRes.data) {
      (notesRes.data as DbDayNoteRecord[]).forEach((dn) => {
        if (dn.date && dn.content !== undefined) {
          dayNotesMap[dn.date] = dn.content;
        }
      });
    }

    const formattedHabits: Habit[] = habitsData.map((h) => {
      const { cleanDescription, isDont, weaningConfig } = parseHabitDescription(h.description);

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
 * Server Action: Save / Upsert a Habit (Protected & Scoped to user)
 */
export async function saveHabitAction(habit: Habit): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    const supabase = getServerSupabase();
    if (!supabase) return { success: true };

    // Verify ownership if habit already exists (Prevents IDOR overwrite)
    const { data: existingHabit } = await supabase
      .from('habits')
      .select('id, user_id')
      .eq('id', habit.id)
      .maybeSingle();

    if (existingHabit && !canAccessUserRecord(user, existingHabit.user_id)) {
      return { success: false, error: 'Unauthorized: Cannot modify habit belonging to another user.' };
    }

    const storedDesc = serializeHabitDescription(habit);

    const habitPayload = {
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
      const fallbackPayload: Record<string, unknown> = { ...habitPayload };
      delete fallbackPayload.user_id;
      const retry = await supabase.from('habits').upsert(fallbackPayload);
      error = retry.error;
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
export async function deleteHabitAction(habitId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    const supabase = getServerSupabase();
    if (!supabase) return { success: true };

    // Verify habit exists and check ownership before deleting
    const { data: habitRecord } = await supabase
      .from('habits')
      .select('id, user_id')
      .eq('id', habitId)
      .maybeSingle();

    if (!habitRecord) {
      return { success: false, error: 'Habit not found.' };
    }

    if (!canAccessUserRecord(user, habitRecord.user_id)) {
      return { success: false, error: 'Unauthorized: Cannot modify other users data.' };
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
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, 'Failed to delete habit') };
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

    // Verify parent habit exists and belongs to the authenticated user
    const { data: parentHabit } = await supabase
      .from('habits')
      .select('id, user_id')
      .eq('id', log.habit_id)
      .maybeSingle();

    if (parentHabit && !canAccessUserRecord(user, parentHabit.user_id)) {
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
    if (error && (error.message?.includes('user_id') || error.code === '42703')) {
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
export async function reorderHabitsAction(orderedHabits: Habit[]): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    const supabase = getServerSupabase();
    if (!supabase) return { success: true };

    const isOwner = isOwnerUser(user);

    await Promise.all(
      orderedHabits.map((h) => {
        const query = supabase.from('habits').update({ sort_order: h.order }).eq('id', h.id);
        return isOwner
          ? query.or(`user_id.eq.${user.userId},user_id.is.null`)
          : query.eq('user_id', user.userId);
      })
    );
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, 'Failed to reorder habits') };
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

    const notePayload = {
      user_id: user.userId,
      date,
      content: content ?? '',
      updated_at: new Date().toISOString(),
    };

    let { error } = await supabase.from('day_notes').upsert(notePayload, { onConflict: 'user_id,date' });

    // Fallback if day_notes table has constraint only on date
    if (error && (error.message?.includes('user_id') || error.code === '42703' || error.code === '42P10')) {
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
export async function getProjectsAction(): Promise<{
  success: boolean;
  isConfigured: boolean;
  projects?: Project[];
  groups?: ProjectGroup[];
  error?: string;
}> {
  try {
    const user = await requireAuth();
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
        .select('id, name, kind, color')
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
    return { success: true, isConfigured: true, projects, groups: (groupsRes.data || []) as ProjectGroup[] };
  } catch (err: unknown) {
    return { success: false, isConfigured: true, error: getErrorMessage(err, 'Failed to load projects') };
  }
}

/**
 * Server Action: Create / update a Project (Protected & Scoped to user)
 */
export async function saveProjectAction(project: Project): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    const supabase = getServerSupabase();
    if (!supabase) return { success: true };

    const title = String(project?.title ?? '').trim().slice(0, 200);
    const groupId = project?.group_id ?? null;
    if (!UUID_RE.test(String(project?.id))) return { success: false, error: 'Invalid project id.' };
    if (!title) return { success: false, error: 'Project title is required.' };
    if (project.status !== 'active' && project.status !== 'planned') return { success: false, error: 'Invalid status.' };
    if (!Array.isArray(project.tasks) || project.tasks.length > 500) return { success: false, error: 'Invalid subtasks.' };

    // Only allow assigning to an org/person owned by this user
    if (groupId !== null) {
      if (!UUID_RE.test(String(groupId))) return { success: false, error: 'Invalid organization.' };
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
    const { data: existing } = await supabase.from('projects').select('user_id').eq('id', project.id).maybeSingle();
    if (existing && existing.user_id !== user.userId) {
      return { success: false, error: 'Unauthorized: Cannot modify other users data.' };
    }

    const { error } = await supabase.from('projects').upsert({
      id: project.id,
      user_id: user.userId,
      title,
      notes: String(project.notes ?? '').slice(0, 20000),
      status: project.status,
      group_id: groupId,
      tasks,
      sort_order: Number.isFinite(project.order) ? Math.trunc(project.order) : 0,
    });
    if (error) throw error;
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, 'Failed to save project') };
  }
}

/**
 * Server Action: Create / rename an Organization or Person (Protected & Scoped to user)
 */
export async function saveProjectGroupAction(group: ProjectGroup): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    const supabase = getServerSupabase();
    if (!supabase) return { success: true };

    const name = String(group?.name ?? '').trim().slice(0, 100);
    if (!UUID_RE.test(String(group?.id))) return { success: false, error: 'Invalid id.' };
    if (!name) return { success: false, error: 'Name is required.' };
    if (group.kind !== 'org' && group.kind !== 'person') return { success: false, error: 'Invalid type.' };

    const { data: existing } = await supabase.from('project_groups').select('user_id').eq('id', group.id).maybeSingle();
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

    let { error } = await supabase.from('project_groups').upsert(groupPayload);
    // Graceful fallback if color column isn't migrated in DB yet
    if (error && (error.message?.includes('color') || error.code === '42703')) {
      delete groupPayload.color;
      const retry = await supabase.from('project_groups').upsert(groupPayload);
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
export async function deleteProjectGroupAction(groupId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    const supabase = getServerSupabase();
    if (!supabase) return { success: true };
    if (!UUID_RE.test(String(groupId))) return { success: false, error: 'Invalid id.' };

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
export async function deleteProjectAction(projectId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    const supabase = getServerSupabase();
    if (!supabase) return { success: true };
    if (!UUID_RE.test(String(projectId))) return { success: false, error: 'Invalid project id.' };

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

    if (caller.role !== 'owner' && caller.userId !== OWNER_USER_ID) {
      return { success: false, error: 'Unauthorized: Only the system owner can delete users.' };
    }

    if (!targetUserId || targetUserId === OWNER_USER_ID || targetUserId === caller.userId) {
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
