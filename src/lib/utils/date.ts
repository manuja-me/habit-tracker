import { format, parseISO, subDays, addDays, startOfWeek, getDay } from 'date-fns';
import { Habit } from '../types';

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

export function isHabitDueOnDate(habit: Habit, dateStr: string): boolean {
  if (habit.archived) return false;

  const todayStr = getTodayDateString();
  const createdDateStr = habit.created_at ? habit.created_at.split('T')[0] : todayStr;

  // A habit is not due on dates before it was created
  if (dateStr < createdDateStr) {
    return false;
  }

  const date = parseISO(dateStr);
  const dayOfWeek = getDay(date); // 0 = Sun, 1 = Mon, ..., 6 = Sat

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
