import type { Habit, HabitLog } from '../types';
import { OWNER_USER_ID } from '../types';
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
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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
    if (typeof content !== 'string' || !content.trim() || isPlannerNoteExpired(dateStr, createdAtIso, now)) {
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
    const uid = userId;
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
    const uid = userId;
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
    const uid = userId;
    const legacyOwnerId = uid === OWNER_USER_ID ? 'owner' : undefined;
    const allowLegacyFallback = !uid || uid === OWNER_USER_ID || uid === 'owner';
    const storedHabits =
      localStorage.getItem(getHabitsStorageKey(uid)) ??
      (legacyOwnerId ? localStorage.getItem(getHabitsStorageKey(legacyOwnerId)) : null) ??
      (allowLegacyFallback ? localStorage.getItem(HABITS_STORAGE_KEY) : null);
    const storedLogs =
      localStorage.getItem(getLogsStorageKey(uid)) ??
      (legacyOwnerId ? localStorage.getItem(getLogsStorageKey(legacyOwnerId)) : null) ??
      (allowLegacyFallback ? localStorage.getItem(LOGS_STORAGE_KEY) : null);
    const storedDayNotes =
      localStorage.getItem(getDayNotesStorageKey(uid)) ??
      (legacyOwnerId ? localStorage.getItem(getDayNotesStorageKey(legacyOwnerId)) : null) ??
      (allowLegacyFallback ? localStorage.getItem(DAY_NOTES_STORAGE_KEY) : null);
    const storedDayNotesMeta =
      localStorage.getItem(getDayNotesMetaStorageKey(uid)) ??
      (legacyOwnerId ? localStorage.getItem(getDayNotesMetaStorageKey(legacyOwnerId)) : null) ??
      (allowLegacyFallback ? localStorage.getItem(DAY_NOTES_META_STORAGE_KEY) : null);

    let habits: Habit[] = [];
    if (storedHabits) {
      try {
        const parsed = JSON.parse(storedHabits);
        if (Array.isArray(parsed)) habits = parsed.filter(habit => habit && typeof habit.id === 'string');
      } catch {}
    }

    let logs: Record<string, HabitLog> = {};
    if (storedLogs) {
      try {
        const parsed = JSON.parse(storedLogs);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) logs = parsed;
      } catch {}
    }

    let dayNotes: Record<string, string> = {};
    if (storedDayNotes) {
      try {
        const parsed = JSON.parse(storedDayNotes);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) dayNotes = parsed;
      } catch {}
    }

    let dayNotesMeta: Record<string, string> = {};
    if (storedDayNotesMeta) {
      try {
        dayNotesMeta = JSON.parse(storedDayNotesMeta) || {};
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
