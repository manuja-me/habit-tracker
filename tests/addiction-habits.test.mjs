import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { format, subDays } from 'date-fns';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'next/headers') {
      return {
        url: 'data:text/javascript,export const cookies = () => ({ get: () => undefined, set: () => {}, delete: () => {} }); export const headers = () => new Map();',
        shortCircuit: true,
      };
    }
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw err;
    }
  },
});

const { getTodayDateString } = await import('../src/lib/utils/date.ts');
const { isDaySuccessful, calculateHabitStats } = await import('../src/lib/utils/streaks.ts');
const { calculateWeaningStatus } = await import('../src/lib/utils/tapering.ts');
const { calculateGamificationProfile } = await import('../src/lib/utils/gamification.ts');
const { parseHabitDescription, serializeHabitDescription } = await import('../src/lib/utils/habit-serialization.ts');

function makeHabit(overrides = {}) {
  return {
    id: 'habit-quit-1',
    title: 'Stop Doomscrolling',
    description: '',
    category: 'mindfulness',
    color: '#FE8019',
    icon: 'ShieldOff',
    type: 'boolean',
    nature: 'dont',
    target_value: 1,
    frequency: 'daily',
    archived: false,
    order: 0,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

test('Addiction Streaks: today slip immediately zeroes current streak for DONT habits', () => {
  const now = new Date();
  const d0 = format(now, 'yyyy-MM-dd');
  const d4 = format(subDays(now, 4), 'yyyy-MM-dd');

  const dontHabit = makeHabit({
    id: 'h-dont-today',
    nature: 'dont',
    created_at: d4,
  });

  // 1. Without today's log, habit is clean from d4 to d0 (5 clean days)
  const cleanLogs = {};
  const statsClean = calculateHabitStats(dontHabit, cleanLogs);
  assert.equal(statsClean.isCompletedToday, true);
  assert.equal(statsClean.currentStreak, 5, 'Clean every day should have streak of 5');

  // 2. Slip logged TODAY (d0)
  const slipTodayLogs = {
    [`h-dont-today_${d0}`]: {
      id: 'slip-0',
      habit_id: 'h-dont-today',
      date: d0,
      completed: false,
      value: 1,
      created_at: d0,
      updated_at: d0,
    },
  };

  const statsSlippedToday = calculateHabitStats(dontHabit, slipTodayLogs);
  assert.equal(statsSlippedToday.isCompletedToday, false);
  assert.equal(
    statsSlippedToday.currentStreak,
    0,
    "Today's slip must immediately break current streak to 0 (no grace period for DONT habits)"
  );
  assert.equal(
    statsSlippedToday.longestStreak,
    4,
    'Longest streak should preserve the 4 prior clean days (d4..d1)'
  );
  // Total completions: d4, d3, d2, d1 = 4. Today was slipped = not completed.
  assert.equal(statsSlippedToday.totalCompletions, 4);
});

test('Harm Reduction: DONT number habits enforce ceiling (<= target clean, > target slip)', () => {
  const todayStr = getTodayDateString();
  const habitCeiling = makeHabit({
    id: 'h-ceiling',
    nature: 'dont',
    type: 'number',
    target_value: 3, // Max 3 cups of coffee allowed per day
    created_at: todayStr,
  });

  // Default / no log (0 consumed) is clean
  assert.equal(isDaySuccessful(habitCeiling, todayStr, {}), true);

  // Under ceiling: 2 cups -> clean
  const logUnder = {
    [`h-ceiling_${todayStr}`]: {
      id: 'l1',
      habit_id: 'h-ceiling',
      date: todayStr,
      completed: true,
      value: 2,
      created_at: todayStr,
      updated_at: todayStr,
    },
  };
  assert.equal(isDaySuccessful(habitCeiling, todayStr, logUnder), true);

  // At ceiling: 3 cups -> clean
  const logAt = {
    [`h-ceiling_${todayStr}`]: {
      id: 'l2',
      habit_id: 'h-ceiling',
      date: todayStr,
      completed: true,
      value: 3,
      created_at: todayStr,
      updated_at: todayStr,
    },
  };
  assert.equal(isDaySuccessful(habitCeiling, todayStr, logAt), true);

  // Over ceiling: 4 cups -> slipped up
  const logOver = {
    [`h-ceiling_${todayStr}`]: {
      id: 'l3',
      habit_id: 'h-ceiling',
      date: todayStr,
      completed: false,
      value: 4,
      created_at: todayStr,
      updated_at: todayStr,
    },
  };
  assert.equal(isDaySuccessful(habitCeiling, todayStr, logOver), false);
});

test('Tapering milestones: baseDate uses creation date when no slips, and isGoalReached triggers at milestone', () => {
  const now = new Date();
  const todayStr = getTodayDateString();
  const d4 = format(subDays(now, 4), 'yyyy-MM-dd');

  const habit = makeHabit({
    id: 'h-taper',
    nature: 'dont',
    created_at: d4,
    weaning: { enabled: true, protocol: 'exponential' }, // intervals: [1, 2, 4, 7, 14, 21, 30, 60]
  });

  // At 4 days clean: exact milestone 4 (Stage 3 target)
  const status = calculateWeaningStatus(habit, {});
  assert.equal(status.daysClean, 4);
  assert.equal(status.targetDaysClean, 4);
  assert.equal(status.isGoalReached, true, 'Reaching exactly 4 days clean should mark stage complete');
  assert.equal(status.currentLevel, 3);
  assert.equal(status.nextLevelTarget, 7);
  assert.ok(status.statusMessage.includes('Stage 3 Target Met (4d)'));

  // Target date should be stable relative to created_at (d4 + 4 days = today)
  assert.equal(status.targetDate, todayStr);
});

test('Gamification: quantitative DONT habit does not award proportional XP when exceeding ceiling', () => {
  const now = new Date();
  const d0 = format(now, 'yyyy-MM-dd');
  const habit = makeHabit({
    id: 'h-smoke',
    nature: 'dont',
    type: 'number',
    target_value: 5, // ceiling: 5
    created_at: d0,
  });

  // Case A: stayed under ceiling (3 consumed) -> successful day -> awards 20 clean XP + 50 Perfect Day bonus
  const logsClean = {
    [`h-smoke_${d0}`]: { id: '1', habit_id: 'h-smoke', date: d0, completed: true, value: 3, created_at: d0, updated_at: d0 },
  };
  const profileClean = calculateGamificationProfile([habit], logsClean, d0);
  assert.equal(profileClean.totalXp, 70, 'Clean day should award 20 clean XP + 50 Perfect Day bonus');

  // Case B: exceeded ceiling (8 consumed) -> slipped up -> must NOT award proportional XP
  const logsExceeded = {
    [`h-smoke_${d0}`]: { id: '2', habit_id: 'h-smoke', date: d0, completed: false, value: 8, created_at: d0, updated_at: d0 },
  };
  const profileExceeded = calculateGamificationProfile([habit], logsExceeded, d0);
  assert.equal(profileExceeded.totalXp, 0, 'Exceeding ceiling should award 0 XP for that habit');
});

test('Description tag serialization and deserialization for replacement habit (real actions.ts functions)', () => {
  const habit = {
    nature: 'dont',
    description: 'Quit late night phone use',
    replacement_habit_id: 'habit-read-pages',
    weaning: { enabled: true, protocol: 'exponential' },
  };

  const serialized = serializeHabitDescription(habit);
  assert.ok(serialized.includes('[REPLACE:habit-read-pages]'));
  assert.ok(serialized.includes('[NATURE:DONT]'));
  assert.ok(serialized.includes('[WEANING:'));

  const parsed = parseHabitDescription(serialized);
  assert.equal(parsed.isDont, true);
  assert.equal(parsed.replacement_habit_id, 'habit-read-pages');
  assert.equal(parsed.cleanDescription, 'Quit late night phone use');
  assert.equal(parsed.weaningConfig?.protocol, 'exponential');
});

test('Tapering: quantitative ceiling breach resets days clean in calculateWeaningStatus', () => {
  const habit = makeHabit({
    id: 'h-numeric-taper',
    nature: 'dont',
    type: 'number',
    target_value: 3, // ceiling 3 drinks
    created_at: format(subDays(new Date(), 10), 'yyyy-MM-dd'),
    weaning: { enabled: true, protocol: 'exponential' },
  });

  // Yesterday, user logged 5 drinks (> 3 ceiling) -> slip-up
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const logsWithBreach = {
    [`h-numeric-taper_${yesterdayStr}`]: {
      id: 'breach-1',
      habit_id: 'h-numeric-taper',
      date: yesterdayStr,
      completed: true, // even if completed flag was true in DB, value > target_value is detected
      value: 5,
      created_at: yesterdayStr,
      updated_at: yesterdayStr,
    },
  };

  const status = calculateWeaningStatus(habit, logsWithBreach);
  // Last slip-up was yesterday, so days clean is 1 (today)
  assert.equal(status.daysClean, 1);
  assert.equal(status.targetDaysClean, 1);
  assert.equal(status.isGoalReached, true);
});

test('Abstinence Violation Effect: rolling 30d clean rate remains high when streak zeroes today', () => {
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const d20 = format(subDays(now, 20), 'yyyy-MM-dd');

  const habit = makeHabit({
    id: 'h-ave',
    nature: 'dont',
    created_at: d20, // 21 days due
  });

  // User slips today (d0)
  const logs = {
    [`h-ave_${todayStr}`]: {
      id: 'slip-today',
      habit_id: 'h-ave',
      date: todayStr,
      completed: false,
      value: 1,
      created_at: todayStr,
      updated_at: todayStr,
    },
  };

  const stats = calculateHabitStats(habit, logs);
  assert.equal(stats.currentStreak, 0, 'Current streak must reset to 0');
  // 20 clean days out of 21 total days = 95%
  assert.equal(stats.completionRate30Days, 95, 'Rolling 30d adherence preserves 20/21 (95%) to mitigate AVE');
  assert.equal(stats.isCompletedToday, false);
});
