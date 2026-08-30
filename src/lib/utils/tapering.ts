import { Habit, HabitLog } from '../types';
import { getTodayDateString } from './date';
import { differenceInCalendarDays, parseISO, format, addDays } from 'date-fns';

export type WeaningProtocol = 'exponential' | 'linear' | 'rapid' | 'custom' | 'none';

export interface WeaningLevel {
  level: number;
  targetDaysClean: number;
  title: string;
}

export const WEANING_PROTOCOLS: Record<WeaningProtocol, number[]> = {
  // Exponential Expansion: 1d -> 2d -> 4d -> 7d -> 14d -> 21d -> 30d -> 60d
  exponential: [1, 2, 4, 7, 14, 21, 30, 60],
  // Linear Step: +1 day clean added after every success
  linear: [1, 2, 3, 4, 5, 6, 7, 8, 10, 14, 21, 30],
  // Rapid Fading: 2d -> 5d -> 10d -> 20d -> 30d
  rapid: [2, 5, 10, 20, 30, 60],
  custom: [2, 4, 8, 16, 30],
  none: [],
};

export interface WeaningStatus {
  enabled: boolean;
  protocol: WeaningProtocol;
  currentLevel: number;
  totalLevels: number;
  targetDaysClean: number;
  daysClean: number;
  progressPercent: number;
  targetDate: string;
  isGoalReached: boolean;
  statusMessage: string;
  nextLevelTarget?: number;
}

/**
 * Calculates current tapering / weaning progress for an addiction habit.
 */
export function calculateWeaningStatus(
  habit: Habit,
  logs: Record<string, HabitLog>
): WeaningStatus {
  const isWeaning = habit.nature === 'dont' && (habit.weaning?.enabled ?? true);
  const protocol: WeaningProtocol = habit.weaning?.protocol || 'exponential';
  const intervals = WEANING_PROTOCOLS[protocol] || WEANING_PROTOCOLS.exponential;

  if (!isWeaning || intervals.length === 0) {
    return {
      enabled: false,
      protocol: 'none',
      currentLevel: 1,
      totalLevels: 1,
      targetDaysClean: 1,
      daysClean: 0,
      progressPercent: 0,
      targetDate: getTodayDateString(),
      isGoalReached: false,
      statusMessage: '',
    };
  }

  // Find the date of the most recent slip-up
  const slipUpDates = Object.values(logs)
    .filter((l) => l.habit_id === habit.id && l.completed === false)
    .map((l) => l.date)
    .sort();

  const todayStr = getTodayDateString();
  const lastSlipUpDateStr = slipUpDates.length > 0 ? slipUpDates[slipUpDates.length - 1] : null;

  let daysClean = 0;
  if (!lastSlipUpDateStr) {
    // No slip-ups logged yet: count days since habit creation
    const createdStr = habit.created_at ? habit.created_at.split('T')[0] : todayStr;
    try {
      daysClean = Math.max(0, differenceInCalendarDays(parseISO(todayStr), parseISO(createdStr)));
    } catch {
      daysClean = 1;
    }
  } else {
    try {
      daysClean = Math.max(0, differenceInCalendarDays(parseISO(todayStr), parseISO(lastSlipUpDateStr)));
    } catch {
      daysClean = 0;
    }
  }

  // Determine current weaning level based on days clean or stored level
  let currentLevelIdx = 0;
  for (let i = 0; i < intervals.length; i++) {
    if (daysClean >= intervals[i]) {
      currentLevelIdx = i;
    } else {
      currentLevelIdx = i;
      break;
    }
  }

  const targetDaysClean = intervals[currentLevelIdx] || intervals[intervals.length - 1];
  const progressPercent = Math.min(100, Math.round((daysClean / targetDaysClean) * 100));
  const isGoalReached = daysClean >= targetDaysClean;

  const baseDate = lastSlipUpDateStr ? parseISO(lastSlipUpDateStr) : parseISO(todayStr);
  const targetDate = format(addDays(baseDate, targetDaysClean), 'yyyy-MM-dd');

  let statusMessage = '';
  if (isGoalReached) {
    if (currentLevelIdx >= intervals.length - 1) {
      statusMessage = `🏆 FULL FREEDOM: ${daysClean} Days Clean!`;
    } else {
      const nextTarget = intervals[currentLevelIdx + 1];
      statusMessage = `🎯 Stage ${currentLevelIdx + 1} Target Met (${targetDaysClean}d). Next Goal: ${nextTarget}d Clean.`;
    }
  } else {
    const remaining = targetDaysClean - daysClean;
    statusMessage = `⏳ Stage ${currentLevelIdx + 1}: ${daysClean}/${targetDaysClean}d Clean (${remaining}d until next milestone)`;
  }

  return {
    enabled: true,
    protocol,
    currentLevel: currentLevelIdx + 1,
    totalLevels: intervals.length,
    targetDaysClean,
    daysClean,
    progressPercent,
    targetDate,
    isGoalReached,
    statusMessage,
    nextLevelTarget: intervals[currentLevelIdx + 1],
  };
}
