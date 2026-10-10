import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { format, subDays } from 'date-fns';

// Resolve extensionless relative TypeScript imports when running directly under Node's test runner
registerHooks({
  resolve(specifier, context, nextResolve) {
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

const {
  getTodayDateString,
  getHabitCreatedDateString,
  isHabitDueOnDate,
} = await import('../src/lib/utils/date.ts');
const {
  isDaySuccessful,
  calculateHabitStats,
  generateHeatmapData,
} = await import('../src/lib/utils/streaks.ts');
const { calculateWeaningStatus } = await import('../src/lib/utils/tapering.ts');
const { calculateGamificationProfile } = await import('../src/lib/utils/gamification.ts');
const {
  getHabitsStorageKey,
  getLogsStorageKey,
  getDayNotesStorageKey,
} = await import('../src/lib/utils/storage.ts');

function makeHabit(overrides = {}) {
  return {
    id: 'habit-1',
    title: 'Read 30m',
    category: 'learning',
    color: '#FE8019',
    icon: 'BookOpen',
    type: 'boolean',
    nature: 'do',
    target_value: 1,
    frequency: 'daily',
    archived: false,
    order: 0,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

test('Date & timezone handling: ISO created_at uses local calendar date so evening habits are due today', () => {
  const todayStr = getTodayDateString();
  const habit = makeHabit({ created_at: new Date().toISOString() });

  assert.equal(getHabitCreatedDateString(habit), todayStr);
  assert.equal(isHabitDueOnDate(habit, todayStr), true);

  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  assert.equal(isHabitDueOnDate(habit, yesterdayStr), false);
});

test('Streaks: calculateHabitStats single-pass matches active streak, longest streak, and 30d rate for do and dont habits', () => {
  const now = new Date();
  const d0 = format(now, 'yyyy-MM-dd');
  const d1 = format(subDays(now, 1), 'yyyy-MM-dd');
  const d2 = format(subDays(now, 2), 'yyyy-MM-dd');
  const d3 = format(subDays(now, 3), 'yyyy-MM-dd');
  const d4 = format(subDays(now, 4), 'yyyy-MM-dd');

  const doHabit = makeHabit({ id: 'h-do', created_at: d4 });
  // Completed d4, d3, missed d2, completed d1, not yet completed today (d0)
  const logs = {
    [`h-do_${d4}`]: { id: '1', habit_id: 'h-do', date: d4, completed: true, value: 1, created_at: d4, updated_at: d4 },
    [`h-do_${d3}`]: { id: '2', habit_id: 'h-do', date: d3, completed: true, value: 1, created_at: d3, updated_at: d3 },
    [`h-do_${d1}`]: { id: '3', habit_id: 'h-do', date: d1, completed: true, value: 1, created_at: d1, updated_at: d1 },
  };

  const statsPendingToday = calculateHabitStats(doHabit, logs);
  assert.equal(statsPendingToday.isCompletedToday, false);
  assert.equal(statsPendingToday.currentStreak, 1, 'Pending today should preserve yesterday streak of 1');
  assert.equal(statsPendingToday.longestStreak, 2, 'Longest streak should be 2 (d4..d3)');
  assert.equal(statsPendingToday.totalCompletions, 3);
  assert.equal(statsPendingToday.completionRate30Days, 60); // 3 of 5 days

  // Complete today (d0) -> currentStreak becomes 2
  logs[`h-do_${d0}`] = { id: '4', habit_id: 'h-do', date: d0, completed: true, value: 1, created_at: d0, updated_at: d0 };
  const statsDoneToday = calculateHabitStats(doHabit, logs);
  assert.equal(statsDoneToday.isCompletedToday, true);
  assert.equal(statsDoneToday.currentStreak, 2);
  assert.equal(statsDoneToday.longestStreak, 2);
  assert.equal(statsDoneToday.totalCompletions, 4);

  // 'dont' (quit) habit: clean by default unless logged with completed: false
  const dontHabit = makeHabit({ id: 'h-dont', nature: 'dont', created_at: d3 });
  const dontLogs = {
    [`h-dont_${d2}`]: { id: '5', habit_id: 'h-dont', date: d2, completed: false, value: 1, created_at: d2, updated_at: d2 },
  };
  assert.equal(isDaySuccessful(dontHabit, d3, dontLogs), true);
  assert.equal(isDaySuccessful(dontHabit, d2, dontLogs), false);
  assert.equal(isDaySuccessful(dontHabit, d1, dontLogs), true);
  assert.equal(isDaySuccessful(dontHabit, d0, dontLogs), true);

  const dontStats = calculateHabitStats(dontHabit, dontLogs);
  assert.equal(dontStats.currentStreak, 2); // d1 + d0 clean
  assert.equal(dontStats.totalCompletions, 3); // d3, d1, d0
});

test('Tapering: calculateWeaningStatus computes clean days and stage progression after slip-up', () => {
  const now = new Date();
  const d3 = format(subDays(now, 3), 'yyyy-MM-dd');
  const d5 = format(subDays(now, 5), 'yyyy-MM-dd');
  const habit = makeHabit({
    id: 'h-wean',
    nature: 'dont',
    created_at: d5,
    weaning: { enabled: true, protocol: 'exponential' },
  });

  const statusNoSlips = calculateWeaningStatus(habit, {});
  assert.equal(statusNoSlips.enabled, true);
  assert.equal(statusNoSlips.daysClean, 5);
  assert.equal(statusNoSlips.targetDaysClean, 7); // exponential: [1, 2, 4, 7, ...]

  const logsWithSlip = {
    [`h-wean_${d3}`]: { id: 's1', habit_id: 'h-wean', date: d3, completed: false, value: 1, created_at: d3, updated_at: d3 },
  };
  const statusAfterSlip = calculateWeaningStatus(habit, logsWithSlip);
  assert.equal(statusAfterSlip.daysClean, 3);
  assert.equal(statusAfterSlip.targetDaysClean, 4);
});

test('Gamification: calculateGamificationProfile produces identical results with precomputedStats', () => {
  const now = new Date();
  const d0 = format(now, 'yyyy-MM-dd');
  const d1 = format(subDays(now, 1), 'yyyy-MM-dd');
  const habit = makeHabit({ id: 'h-xp', created_at: d1 });
  const logs = {
    [`h-xp_${d1}`]: { id: '1', habit_id: 'h-xp', date: d1, completed: true, value: 1, created_at: d1, updated_at: d1 },
    [`h-xp_${d0}`]: { id: '2', habit_id: 'h-xp', date: d0, completed: true, value: 1, created_at: d0, updated_at: d0 },
  };

  const statsMap = { 'h-xp': calculateHabitStats(habit, logs) };
  const profileDirect = calculateGamificationProfile([habit], logs, d0);
  const profileCached = calculateGamificationProfile([habit], logs, d0, statsMap);

  assert.deepEqual(profileCached, profileDirect);
  assert.ok(profileCached.totalXp > 0);
  assert.equal(generateHeatmapData([habit], logs, 7).length, 7);
});

test('Storage keys: user-scoped keys isolate different users', () => {
  assert.notEqual(getHabitsStorageKey('user-a'), getHabitsStorageKey('user-b'));
  assert.notEqual(getLogsStorageKey('user-a'), getLogsStorageKey('user-b'));
  assert.notEqual(getDayNotesStorageKey('user-a'), getDayNotesStorageKey('user-b'));
});
