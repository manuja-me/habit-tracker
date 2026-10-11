import type { Habit, HabitLog } from '../types';
import { isPlannerNoteExpired } from './date';

export const HABITS_STORAGE_KEY = 'zenith_habits_v1';
export const LOGS_STORAGE_KEY = 'zenith_logs_v1';
export const DAY_NOTES_STORAGE_KEY = 'zenith_day_notes_v1';
export const DAY_NOTES_META_STORAGE_KEY = 'zenith_day_notes_meta_v1';
export const INITIALIZED_KEY = 'zenith_initialized_v1';
export const LAST_USER_KEY = 'zenith_last_user_id';

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getHabitsStorageKey(userId?: string): string {
  return userId ? `zenith_habits_${userId}` : HABITS_STORAGE_KEY;
}

export function getLogsStorageKey(userId?: string): string {
  return userId ? `zenith_logs_${userId}` : LOGS_STORAGE_KEY;
}

export function getDayNotesStorageKey(userId?: string): string {
  return userId ? `zenith_day_notes_${userId}` : DAY_NOTES_STORAGE_KEY;
}

export function getDayNotesMetaStorageKey(userId?: string): string {
  return userId ? `zenith_day_notes_meta_${userId}` : DAY_NOTES_META_STORAGE_KEY;
}

export function pruneExpiredDayNotes(
  dayNotes: Record<string, string>,
  meta: Record<string, string> = {},
  now: Date = new Date()
): {
  dayNotes: Record<string, string>;
  meta: Record<string, string>;
  pruned: boolean;
} {
  const cleanNotes: Record<string, string> = {};
  const cleanMeta: Record<string, string> = {};
  let pruned = false;

  for (const [dateStr, content] of Object.entries(dayNotes || {})) {
    const createdAtIso = meta[dateStr];
    if (!content || !content.trim() || isPlannerNoteExpired(dateStr, createdAtIso, now)) {
      pruned = true;
      continue;
    }
    cleanNotes[dateStr] = content;
    cleanMeta[dateStr] = createdAtIso || now.toISOString();
  }

  return { dayNotes: cleanNotes, meta: cleanMeta, pruned };
}

export function persistLocalData(
  habits: Habit[], 
  logs: Record<string, HabitLog>, 
  userId?: string
): void {
  if (typeof window === 'undefined') return;
  try {
    const uid = userId || localStorage.getItem(LAST_USER_KEY) || undefined;
    if (userId) localStorage.setItem(LAST_USER_KEY, userId);
    localStorage.setItem(getHabitsStorageKey(uid), JSON.stringify(habits));
    localStorage.setItem(getLogsStorageKey(uid), JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to save to localStorage', e);
  }
}

export function persistDayNotes(
  dayNotes: Record<string, string>,
  userId?: string
): Record<string, string> {
  if (typeof window === 'undefined') return dayNotes;
  try {
    const uid = userId || localStorage.getItem(LAST_USER_KEY) || undefined;
    if (userId) localStorage.setItem(LAST_USER_KEY, userId);
    let existingMeta: Record<string, string> = {};
    try {
      const rawMeta = localStorage.getItem(getDayNotesMetaStorageKey(uid));
      if (rawMeta) existingMeta = JSON.parse(rawMeta);
    } catch {}
    const { dayNotes: cleanNotes, meta: cleanMeta } = pruneExpiredDayNotes(dayNotes, existingMeta);
    localStorage.setItem(getDayNotesStorageKey(uid), JSON.stringify(cleanNotes));
    localStorage.setItem(getDayNotesMetaStorageKey(uid), JSON.stringify(cleanMeta));
    return cleanNotes;
  } catch (e) {
    console.error('Failed to save day notes to localStorage', e);
    return dayNotes;
  }
}

export function loadLocalData(userId?: string): {
  habits: Habit[];
  logs: Record<string, HabitLog>;
  dayNotes: Record<string, string>;
} {
  if (typeof window === 'undefined') {
    return { habits: [], logs: {}, dayNotes: {} };
  }

  try {
    const uid = userId || localStorage.getItem(LAST_USER_KEY) || undefined;
    const allowLegacyFallback = !uid || uid === 'owner';
    const storedHabits =
      localStorage.getItem(getHabitsStorageKey(uid)) ??
      (allowLegacyFallback ? localStorage.getItem(HABITS_STORAGE_KEY) : null);
    const storedLogs =
      localStorage.getItem(getLogsStorageKey(uid)) ??
      (allowLegacyFallback ? localStorage.getItem(LOGS_STORAGE_KEY) : null);
    const storedDayNotes =
      localStorage.getItem(getDayNotesStorageKey(uid)) ??
      (allowLegacyFallback ? localStorage.getItem(DAY_NOTES_STORAGE_KEY) : null);
    const storedDayNotesMeta =
      localStorage.getItem(getDayNotesMetaStorageKey(uid)) ??
      (allowLegacyFallback ? localStorage.getItem(DAY_NOTES_META_STORAGE_KEY) : null);

    let habits: Habit[] = [];
    if (storedHabits) {
      try {
        habits = JSON.parse(storedHabits);
      } catch {}
    }

    let logs: Record<string, HabitLog> = {};
    if (storedLogs) {
      try {
        logs = JSON.parse(storedLogs);
      } catch {}
    }

    let dayNotes: Record<string, string> = {};
    if (storedDayNotes) {
      try {
        dayNotes = JSON.parse(storedDayNotes);
      } catch {}
    }

    let dayNotesMeta: Record<string, string> = {};
    if (storedDayNotesMeta) {
      try {
        dayNotesMeta = JSON.parse(storedDayNotesMeta);
      } catch {}
    }

    const prunedResult = pruneExpiredDayNotes(dayNotes, dayNotesMeta);
    dayNotes = prunedResult.dayNotes;
    if (prunedResult.pruned) {
      try {
        localStorage.setItem(getDayNotesStorageKey(uid), JSON.stringify(prunedResult.dayNotes));
        localStorage.setItem(getDayNotesMetaStorageKey(uid), JSON.stringify(prunedResult.meta));
      } catch {}
    }

    return { habits, logs, dayNotes };
  } catch (e) {
    console.error('Failed to read from localStorage', e);
    return { habits: [], logs: {}, dayNotes: {} };
  }
}
