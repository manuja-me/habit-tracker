import { format, parseISO, subDays, addDays, subMonths, addMonths, startOfWeek, getDay } from 'date-fns';
import type { Habit } from '../types';

export const PLANNER_RETENTION_MONTHS = 3;

export function getPlannerCutoffDate(now: Date = new Date()): Date {
  return subMonths(now, PLANNER_RETENTION_MONTHS);
}

export function getPlannerCutoffDateString(now: Date = new Date()): string {
  return format(getPlannerCutoffDate(now), 'yyyy-MM-dd');
}

export function isPlannerNoteExpired(
  dateStr: string,
  createdAtIso?: string | null,
  now: Date = new Date()
): boolean {
  const cutoffDate = getPlannerCutoffDate(now);
  const cutoffDateStr = format(cutoffDate, 'yyyy-MM-dd');

  if (createdAtIso) {
    const createdDate = /^\d{4}-\d{2}-\d{2}$/.test(createdAtIso)
      ? parseISO(createdAtIso)
      : new Date(createdAtIso);
    if (!isNaN(createdDate.getTime())) {
      if (addMonths(createdDate, PLANNER_RETENTION_MONTHS).getTime() <= now.getTime()) {
        return true;
      }
      if (createdDate.getTime() <= cutoffDate.getTime()) {
        return true;
      }
    }
  }

  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const noteDate = parseISO(dateStr);
    const todayStart = parseISO(format(now, 'yyyy-MM-dd'));
    if (
      !isNaN(noteDate.getTime()) &&
      addMonths(noteDate, PLANNER_RETENTION_MONTHS).getTime() <= todayStart.getTime()
    ) {
      return true;
    }
    if (dateStr <= cutoffDateStr) {
      return true;
    }
  }

  return false;
}

export function getTodayDateString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function parseDate(dateStr: string): Date {
  return parseISO(dateStr);
}

export function formatDisplayDate(dateStr: string): string {
  const date = parseISO(dateStr);
  return format(date, 'EEEE, MMMM d');
}

export function formatShortDate(dateStr: string): string {
  const date = parseISO(dateStr);
  return format(date, 'MMM d');
}

export function formatDayName(dateStr: string): string {
  const date = parseISO(dateStr);
  return format(date, 'EEE');
}

export function formatRelativeDate(dateStr: string): string {
  const today = getTodayDateString();
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  if (dateStr === tomorrow) return 'Tomorrow';
  return formatDisplayDate(dateStr);
}

export function getWeekDays(referenceDateStr: string = getTodayDateString()): string[] {
  const refDate = parseISO(referenceDateStr);
  // Start week on Monday
  const weekStart = startOfWeek(refDate, { weekStartsOn: 1 });
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(format(addDays(weekStart, i), 'yyyy-MM-dd'));
  }
  return days;
}

export function getLastNDays(n: number): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    days.push(format(subDays(today, i), 'yyyy-MM-dd'));
  }
  return days;
}

export function getHabitCreatedDateString(habit: Habit, fallbackStr?: string): string {
  if (!habit.created_at) return fallbackStr || getTodayDateString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(habit.created_at)) return habit.created_at;
  const parsed = new Date(habit.created_at);
  if (isNaN(parsed.getTime())) return habit.created_at.split('T')[0];
  return format(parsed, 'yyyy-MM-dd');
}

export function isHabitDueOnDate(
  habit: Habit,
  dateStr: string,
  createdDateStr?: string,
  dayOfWeekOverride?: number
): boolean {
  if (habit.archived) return false;

  const createdStr = createdDateStr || getHabitCreatedDateString(habit);

  // A habit is not due on dates before it was created
  if (dateStr < createdStr) {
    return false;
  }

  const dayOfWeek = dayOfWeekOverride !== undefined ? dayOfWeekOverride : getDay(parseISO(dateStr)); // 0 = Sun, 1 = Mon, ..., 6 = Sat

  switch (habit.frequency) {
    case 'daily':
      return true;
    case 'weekdays':
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    case 'weekends':
      return dayOfWeek === 0 || dayOfWeek === 6;
    case 'custom':
      if (!habit.custom_days || habit.custom_days.length === 0) return true;
      return habit.custom_days.includes(dayOfWeek);
    default:
      return true;
  }
}

