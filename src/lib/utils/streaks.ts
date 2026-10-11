import { subDays, format, parseISO, differenceInCalendarDays } from 'date-fns';
import type { Habit, HabitLog, HabitStats, HeatmapDay } from '../types';
import { getTodayDateString, getHabitCreatedDateString, isHabitDueOnDate } from './date';

/**
 * Checks if a habit was successful (clean/completed) on a specific date.
 * A habit can only be successful on or after its creation date and not in the future.
 * For 'do' habits: requires log?.completed === true.
 * For 'dont' (addiction/quit) habits: clean by default on/after creation date unless explicitly logged as a slip-up.
 */
export function isDaySuccessful(
  habit: Habit,
  dateStr: string,
  logs: Record<string, HabitLog>,
  todayStr: string = getTodayDateString(),
  createdDateStr?: string
): boolean {
  const createdStr = createdDateStr || getHabitCreatedDateString(habit, todayStr);

  // A habit cannot be successful on dates before its creation date
  if (dateStr < createdStr) {
    return false;
  }

  // Future dates cannot be successful yet
  if (dateStr > todayStr) {
    return false;
  }

  const log = logs[`${habit.id}_${dateStr}`];
  if (habit.nature === 'dont') {
    if (log === undefined) return true;
    return Boolean(log.completed);
  }
  return Boolean(log?.completed);
}

/**
 * Calculates current streak, longest streak, and completion rate for a given habit.
 */
export function calculateHabitStats(habit: Habit, logs: Record<string, HabitLog>): HabitStats {
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const createdDateStr = getHabitCreatedDateString(habit, todayStr);
  const todayLog = logs[`${habit.id}_${todayStr}`];
  const isCompletedToday = isDaySuccessful(habit, todayStr, logs, todayStr, createdDateStr);
  const todayValue = todayLog?.value ?? 0;

  let daysSinceCreation = 0;
  try {
    daysSinceCreation = Math.min(365, Math.max(0, differenceInCalendarDays(now, parseISO(createdDateStr))));
  } catch {
    daysSinceCreation = 0;
  }

  const maxDays = Math.max(daysSinceCreation, 29);
  let totalCompletions = 0;
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  let streakBroken = false;
  let dueDaysCount30 = 0;
  let completedDaysCount30 = 0;

  for (let i = 0; i <= maxDays; i++) {
    const date = subDays(now, i);
    const dStr = format(date, 'yyyy-MM-dd');
    if (dStr < createdDateStr) break;

    if (!isHabitDueOnDate(habit, dStr, createdDateStr, date.getDay())) {
      continue;
    }

    const isPassed = isDaySuccessful(habit, dStr, logs, todayStr, createdDateStr);

    if (i <= daysSinceCreation) {
      if (isPassed) {
        totalCompletions++;
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
        if (!streakBroken && (i > 0 || isCompletedToday)) {
          currentStreak++;
        }
      } else {
        tempStreak = 0;
        if (i > 0 || isCompletedToday) {
          streakBroken = true;
        }
      }
    }

    if (i < 30) {
      dueDaysCount30++;
      if (isPassed) completedDaysCount30++;
    }
  }

  if (currentStreak > longestStreak) {
    longestStreak = currentStreak;
  }

  const completionRate30Days = dueDaysCount30 > 0
    ? Math.round((completedDaysCount30 / dueDaysCount30) * 100)
    : (isCompletedToday ? 100 : 0);

  return {
    currentStreak,
    longestStreak,
    totalCompletions,
    completionRate30Days,
    isCompletedToday,
    todayValue,
  };
}

/**
 * Generates data for GitHub-style activity heatmaps
 */
export function generateHeatmapData(
  habits: Habit[],
  logs: Record<string, HabitLog>,
  daysCount: number = 365,
  filterHabitId?: string
): HeatmapDay[] {
  const activeHabits = filterHabitId
    ? habits.filter((h) => h.id === filterHabitId)
    : habits.filter((h) => !h.archived);

  const heatmap: HeatmapDay[] = [];
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const createdMap = new Map(activeHabits.map((h) => [h.id, getHabitCreatedDateString(h, todayStr)]));

  for (let i = daysCount - 1; i >= 0; i--) {
    const date = subDays(today, i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayOfWeek = date.getDay();

    const dueHabits = activeHabits.filter((h) =>
      isHabitDueOnDate(h, dateStr, createdMap.get(h.id), dayOfWeek)
    );
    const totalDue = dueHabits.length;

    const completedHabits: string[] = [];
    if (totalDue > 0) {
      dueHabits.forEach((h) => {
        if (isDaySuccessful(h, dateStr, logs, todayStr, createdMap.get(h.id))) {
          completedHabits.push(h.title);
        }
      });
    }

    const count = completedHabits.length;
    let level: 0 | 1 | 2 | 3 | 4 = 0;

    if (totalDue > 0 && count > 0) {
      const ratio = count / totalDue;
      if (ratio <= 0.25) level = 1;
      else if (ratio <= 0.5) level = 2;
      else if (ratio <= 0.75) level = 3;
      else level = 4;
    }

    heatmap.push({
      date: dateStr,
      count,
      total: totalDue,
      level,
      completedHabits,
    });
  }

  return heatmap;
}

