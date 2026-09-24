import { subDays, format, parseISO, differenceInCalendarDays } from 'date-fns';
import { Habit, HabitLog, HabitStats, HeatmapDay } from '../types';
import { getTodayDateString, isHabitDueOnDate } from './date';

/**
 * Checks if a habit was successful (clean/completed) on a specific date.
 * A habit can only be successful on or after its creation date and not in the future.
 * For 'do' habits: requires log?.completed === true.
 * For 'dont' (addiction/quit) habits: clean by default on/after creation date unless explicitly logged as a slip-up.
 */
export function isDaySuccessful(habit: Habit, dateStr: string, logs: Record<string, HabitLog>): boolean {
  const todayStr = getTodayDateString();
  const createdDateStr = habit.created_at ? habit.created_at.split('T')[0] : todayStr;
  
  // A habit cannot be successful on dates before its creation date
  if (dateStr < createdDateStr) {
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
  const todayStr = getTodayDateString();
  const createdDateStr = habit.created_at ? habit.created_at.split('T')[0] : todayStr;
  const todayLog = logs[`${habit.id}_${todayStr}`];
  const isCompletedToday = isDaySuccessful(habit, todayStr, logs);
  const todayValue = todayLog?.value ?? 0;

  let daysSinceCreation = 0;
  try {
    daysSinceCreation = Math.min(365, Math.max(0, differenceInCalendarDays(new Date(), parseISO(createdDateStr))));
  } catch {
    daysSinceCreation = 0;
  }

  // Calculate total completions since creation
  let totalCompletions = 0;
  for (let i = 0; i <= daysSinceCreation; i++) {
    const dStr = format(subDays(new Date(), i), 'yyyy-MM-dd');
    if (dStr >= createdDateStr && isHabitDueOnDate(habit, dStr)) {
      if (isDaySuccessful(habit, dStr, logs)) {
        totalCompletions++;
      }
    }
  }

  // Calculate current streak
  let currentStreak = 0;
  let checkDate = new Date();
  
  // If not completed today, we check starting from yesterday to see if streak is active
  if (!isCompletedToday) {
    checkDate = subDays(checkDate, 1);
  }

  // Iterate backwards day by day to count consecutive completed/clean scheduled days
  let daysChecked = 0;
  while (daysChecked <= daysSinceCreation) {
    const dateStr = format(checkDate, 'yyyy-MM-dd');

    // Stop counting before habit was created
    if (dateStr < createdDateStr) {
      break;
    }

    const isDue = isHabitDueOnDate(habit, dateStr);

    if (isDue) {
      const isPassed = isDaySuccessful(habit, dateStr, logs);
      if (isPassed) {
        currentStreak++;
      } else {
        // Streak broken (missed habit or slipped up on quit habit)
        break;
      }
    }
    checkDate = subDays(checkDate, 1);
    daysChecked++;
  }

  // Calculate longest streak since creation
  let longestStreak = currentStreak;
  let tempStreak = 0;
  let historyDate = subDays(new Date(), daysSinceCreation);
  
  for (let i = 0; i <= daysSinceCreation; i++) {
    const dateStr = format(historyDate, 'yyyy-MM-dd');
    const isDue = isHabitDueOnDate(habit, dateStr);

    if (isDue) {
      const isPassed = isDaySuccessful(habit, dateStr, logs);
      if (isPassed) {
        tempStreak++;
        if (tempStreak > longestStreak) {
          longestStreak = tempStreak;
        }
      } else {
        tempStreak = 0;
      }
    }
    historyDate = subDays(historyDate, -1); // move forward 1 day
  }

  // Calculate 30-day completion rate
  let dueDaysCount30 = 0;
  let completedDaysCount30 = 0;
  for (let i = 0; i < 30; i++) {
    const dStr = format(subDays(new Date(), i), 'yyyy-MM-dd');
    if (dStr >= createdDateStr && isHabitDueOnDate(habit, dStr)) {
      dueDaysCount30++;
      if (isDaySuccessful(habit, dStr, logs)) {
        completedDaysCount30++;
      }
    }
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
    ? habits.filter(h => h.id === filterHabitId) 
    : habits.filter(h => !h.archived);

  const heatmap: HeatmapDay[] = [];
  const today = new Date();

  for (let i = daysCount - 1; i >= 0; i--) {
    const date = subDays(today, i);
    const dateStr = format(date, 'yyyy-MM-dd');

    const dueHabits = activeHabits.filter(h => isHabitDueOnDate(h, dateStr));
    const totalDue = dueHabits.length;

    const completedHabits: string[] = [];
    if (totalDue > 0) {
      dueHabits.forEach(h => {
        if (isDaySuccessful(h, dateStr, logs)) {
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

export interface MilestoneBadge {
  id: string;
  days: number;
  title: string;
  subtitle: string;
  iconName: string;
  color: string;
  unlocked: boolean;
  progressPercent: number;
}

export const MILESTONE_DEFINITIONS = [
  { id: 'm-3', days: 3, title: 'SPARK', subtitle: '3 Days Consecutive', iconName: 'Zap', color: '#38BDF8' },
  { id: 'm-7', days: 7, title: 'IGNITION', subtitle: '1 Week Unbroken', iconName: 'Flame', color: '#F59E0B' },
  { id: 'm-14', days: 14, title: 'MOMENTUM', subtitle: '2 Weeks Strong', iconName: 'TrendingUp', color: '#FF3B30' },
  { id: 'm-21', days: 21, title: 'HABIT LOOP', subtitle: '21 Days Formed', iconName: 'Activity', color: '#06B6D4' },
  { id: 'm-30', days: 30, title: 'IRON WILL', subtitle: '1 Month Discipline', iconName: 'ShieldCheck', color: '#6366F1' },
  { id: 'm-60', days: 60, title: 'DIAMOND', subtitle: '60 Days Automatic', iconName: 'Sparkles', color: '#8B5CF6' },
  { id: 'm-100', days: 100, title: 'CENTURY', subtitle: '100 Days Triple Digits', iconName: 'Trophy', color: '#EC4899' },
  { id: 'm-180', days: 180, title: 'HALF YEAR', subtitle: '6 Months Mastery', iconName: 'Star', color: '#F43F5E' },
  { id: 'm-365', days: 365, title: 'LEGEND', subtitle: '1 Full Year Elite', iconName: 'Crown', color: '#EAB308' },
  { id: 'm-500', days: 500, title: 'TITAN', subtitle: '500 Days Unstoppable', iconName: 'Medal', color: '#F97316' },
  { id: 'm-1000', days: 1000, title: 'IMMORTAL', subtitle: '1,000 Days Pantheon', iconName: 'Flame', color: '#FF3B30' },
];

export function calculateMilestones(bestStreak: number): MilestoneBadge[] {
  return MILESTONE_DEFINITIONS.map((m) => {
    const unlocked = bestStreak >= m.days;
    const progressPercent = Math.min(100, Math.round((bestStreak / m.days) * 100));
    return {
      ...m,
      unlocked,
      progressPercent,
    };
  });
}
