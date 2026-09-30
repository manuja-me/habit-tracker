import { Habit, HabitLog } from '../types';

export const HABITS_STORAGE_KEY = 'zenith_habits_v1';
export const LOGS_STORAGE_KEY = 'zenith_logs_v1';
export const DAY_NOTES_STORAGE_KEY = 'zenith_day_notes_v1';
export const INITIALIZED_KEY = 'zenith_initialized_v1';

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

export function persistLocalData(
  habits: Habit[], 
  logs: Record<string, HabitLog>, 
  userId?: string
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getHabitsStorageKey(userId), JSON.stringify(habits));
    localStorage.setItem(getLogsStorageKey(userId), JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to save to localStorage', e);
  }
}

export function persistDayNotes(
  dayNotes: Record<string, string>,
  userId?: string
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getDayNotesStorageKey(userId), JSON.stringify(dayNotes));
  } catch (e) {
    console.error('Failed to save day notes to localStorage', e);
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
    const storedHabits = localStorage.getItem(getHabitsStorageKey(userId));
    const storedLogs = localStorage.getItem(getLogsStorageKey(userId));
    const storedDayNotes = localStorage.getItem(getDayNotesStorageKey(userId));

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

    return { habits, logs, dayNotes };
  } catch (e) {
    console.error('Failed to read from localStorage', e);
    return { habits: [], logs: {}, dayNotes: {} };
  }
}
