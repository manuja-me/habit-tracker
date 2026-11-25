import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

const userId = 'a7cb6833-441f-479c-bfd4-6a291f58c555';
const otherUserId = 'ef6cd57b-cf36-485e-b4fa-a4f61d445681';
const ownerUserId = '00000000-0000-0000-0000-000000000001';
const habitId = '3b81350a-3d27-4351-b6ca-4daf9e696a20';
const replacementHabitId = '9c11350a-3d27-4351-b6ca-4daf9e696a21';
const otherHabitId = '8d22350a-3d27-4351-b6ca-4daf9e696a22';
const logs = Array.from({ length: 1001 }, (_, i) => ({
  id: String(i),
  habit_id: habitId,
  date: String(i),
  completed: true,
  value: 1,
}));
let failTable;
let calls = [];
let habitRowsById = {};
let lastMutations = [];

globalThis.dataTestAuth = async () => ({ userId, username: 'test', role: 'member' });
globalThis.dataTestDb = {
  from(table) {
    calls.push(table);
    let eqFilters = {};
    let isMaybeSingle = false;
    let mutation = null;
    const query = {
      select: () => query,
      eq: (col, val) => {
        eqFilters[col] = val;
        return query;
      },
      is: () => query,
      or: () => query,
      gte: () => query,
      gt: () => query,
      lte: () => query,
      order: () => query,
      maybeSingle: () => {
        isMaybeSingle = true;
        return query;
      },
      single: () => {
        isMaybeSingle = true;
        return query;
      },
      delete: () => {
        mutation = { table, op: 'delete' };
        return query;
      },
      insert: (payload) => {
        mutation = { table, op: 'insert', payload };
        lastMutations.push(mutation);
        return query;
      },
      update: (payload) => {
        mutation = { table, op: 'update', payload };
        lastMutations.push(mutation);
        return query;
      },
      upsert: (payload) => {
        mutation = { table, op: 'upsert', payload };
        lastMutations.push(mutation);
        return query;
      },
      range(start, end) {
        if (failTable === table) return Promise.resolve({ error: { code: '08006', message: 'connection failed' } });
        return Promise.resolve({ data: logs.slice(start, end + 1), count: logs.length, error: null });
      },
      then(resolve) {
        if (failTable === table) return resolve({ error: { code: '08006', message: 'connection failed' } });
        if (isMaybeSingle && table === 'habits' && eqFilters.id) {
          const row = habitRowsById[eqFilters.id] ?? null;
          return resolve({ data: row, error: null });
        }
        if (isMaybeSingle && table === 'app_users') {
          return resolve({ data: null, error: null });
        }
        const data = mutation ? null : (table === 'habits' ? [{ id: habitId, target_value: 1 }] : []);
        return resolve({ data, error: null });
      },
    };
    return query;
  },
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    const mock = {
      './auth': 'export const requireAuth = (...args) => globalThis.dataTestAuth(...args);',
      './supabase': 'export const getCleanSupabaseConfig = () => true, getServerSupabase = () => globalThis.dataTestDb;',
    }[specifier];
    if (mock) return { url: 'data:text/javascript,' + mock, shortCircuit: true };
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (!specifier.startsWith('.') || specifier.endsWith('.ts')) throw error;
      return nextResolve(specifier + '.ts', context);
    }
  },
});

const {
  getHabitsAndLogsAction,
  saveHabitAction,
  saveHabitLogAction,
  reorderHabitsAction,
  saveDayNoteAction,
  saveProjectAction,
  adminDeleteUserAction,
} = await import('../src/lib/server/actions.ts');

function makeValidHabit(overrides = {}) {
  return {
    id: habitId,
    title: 'Meditate',
    description: 'Morning session',
    category: 'mindfulness',
    color: '#FE8019',
    icon: 'Flame',
    type: 'boolean',
    nature: 'do',
    target_value: 1,
    target_unit: '',
    frequency: 'daily',
    custom_days: [],
    archived: false,
    order: 0,
    created_at: '2026-11-23T00:00:00.000Z',
    ...overrides,
  };
}

test('server rejects stale-tab reads and writes before any database query', async () => {
  calls = [];
  assert.match((await getHabitsAndLogsAction(otherUserId)).error, /account changed/i);
  assert.match((await saveDayNoteAction('2026-11-23', 'note', otherUserId)).error, /account changed/i);
  assert.match((await saveProjectAction({}, otherUserId)).error, /account changed/i);
  assert.deepEqual(calls, []);
});

test('cloud reads retain progress beyond the API row limit', async () => {
  failTable = undefined;
  const result = await getHabitsAndLogsAction(userId);
  assert.equal(result.success, true);
  assert.equal(Object.keys(result.logs).length, 1001);
});

test('cloud reads report a generic query failure instead of returning an empty snapshot or leaking DB errors', async () => {
  for (const table of ['habit_logs', 'day_notes']) {
    failTable = table;
    const result = await getHabitsAndLogsAction(userId);
    assert.equal(result.success, false);
    assert.equal(result.error, 'Failed to fetch data');
    assert.doesNotMatch(result.error, /connection failed/i);
    assert.equal(result.logs, undefined);
    assert.equal(result.dayNotes, undefined);
  }
  failTable = undefined;
});

test('VULN-04: saveHabitAction validates replacement_habit_id UUID format and ownership', async () => {
  calls = [];
  lastMutations = [];
  habitRowsById = {
    [replacementHabitId]: { id: replacementHabitId, user_id: userId },
    [otherHabitId]: { id: otherHabitId, user_id: otherUserId },
  };

  // Invalid UUID format rejected before any DB query
  const badUuid = await saveHabitAction(
    makeValidHabit({ nature: 'dont', replacement_habit_id: 'not-a-uuid[NATURE:DONT]' }),
    userId
  );
  assert.equal(badUuid.success, false);
  assert.match(badUuid.error, /invalid replacement habit id/i);
  assert.deepEqual(calls, []);

  // Cross-user replacement_habit_id rejected
  const crossUser = await saveHabitAction(
    makeValidHabit({ nature: 'dont', replacement_habit_id: otherHabitId }),
    userId
  );
  assert.equal(crossUser.success, false);
  assert.match(crossUser.error, /replacement habit not found/i);
  assert.equal(lastMutations.length, 0);

  // Non-existent replacement_habit_id rejected
  const missingRep = await saveHabitAction(
    makeValidHabit({ nature: 'dont', replacement_habit_id: '00000000-0000-4000-8000-000000000999' }),
    userId
  );
  assert.equal(missingRep.success, false);
  assert.match(missingRep.error, /replacement habit not found/i);

  // Valid same-user replacement_habit_id (with whitespace) succeeds and stores trimmed UUID
  const validRep = await saveHabitAction(
    makeValidHabit({ nature: 'dont', replacement_habit_id: `  ${replacementHabitId}  ` }),
    userId
  );
  assert.equal(validRep.success, true);
  assert.equal(lastMutations.length, 1);
  assert.equal(lastMutations[0].payload.replacement_habit_id, replacementHabitId);
  assert.match(lastMutations[0].payload.description, new RegExp(`\\[REPLACE:${replacementHabitId}\\]`));

  // When nature is 'do', replacement_habit_id is forced to null
  lastMutations = [];
  const doHabit = await saveHabitAction(
    makeValidHabit({ nature: 'do', replacement_habit_id: otherHabitId }),
    userId
  );
  assert.equal(doHabit.success, true);
  assert.equal(lastMutations[0].payload.replacement_habit_id, null);
});

test('VULN-05: saveHabitAction, saveHabitLogAction, and reorderHabitsAction validate and bound inputs', async () => {
  calls = [];
  lastMutations = [];
  habitRowsById = { [habitId]: { id: habitId, user_id: userId } };

  // reorderHabitsAction validation before DB access
  assert.equal((await reorderHabitsAction(null, userId)).success, false);
  assert.equal((await reorderHabitsAction(Array.from({ length: 501 }, () => makeValidHabit()), userId)).success, false);
  assert.equal((await reorderHabitsAction([{ id: 'bad-id', order: 0 }], userId)).success, false);
  assert.equal((await reorderHabitsAction([{ id: habitId, order: NaN }], userId)).success, false);
  assert.equal((await reorderHabitsAction([{ id: habitId, order: Infinity }], userId)).success, false);
  assert.deepEqual(calls, []);

  const validReorder = await reorderHabitsAction([{ id: habitId, order: 2.9 }], userId);
  assert.equal(validReorder.success, true);
  assert.equal(lastMutations.at(-1).payload.sort_order, 2);

  // saveHabitAction field validation
  calls = [];
  assert.equal((await saveHabitAction(makeValidHabit({ category: 'hacked' }), userId)).success, false);
  assert.equal((await saveHabitAction(makeValidHabit({ color: 'javascript:alert(1)' }), userId)).success, false);
  assert.equal((await saveHabitAction(makeValidHabit({ icon: '<script>' }), userId)).success, false);
  assert.equal((await saveHabitAction(makeValidHabit({ type: 'other' }), userId)).success, false);
  assert.equal((await saveHabitAction(makeValidHabit({ frequency: 'yearly' }), userId)).success, false);
  assert.equal((await saveHabitAction(makeValidHabit({ custom_days: [0, 7] }), userId)).success, false);
  assert.equal((await saveHabitAction(makeValidHabit({ custom_days: [0, 1, 2, 3, 4, 5, 6, 0] }), userId)).success, false);
  assert.equal((await saveHabitAction(makeValidHabit({ order: Infinity }), userId)).success, false);
  assert.equal((await saveHabitAction(makeValidHabit({ target_value: -1 }), userId)).success, false);
  assert.equal((await saveHabitAction(makeValidHabit({ target_value: 2_000_000 }), userId)).success, false);
  assert.deepEqual(calls, []);

  // saveHabitLogAction validation and boolean coercion
  assert.equal(
    (await saveHabitLogAction({ habit_id: habitId, date: '2026-11-23', completed: true, value: -1 }, userId)).success,
    false
  );
  assert.equal(
    (await saveHabitLogAction({ habit_id: habitId, date: '2026-11-23', completed: true, value: NaN }, userId)).success,
    false
  );
  assert.equal(
    (await saveHabitLogAction({ habit_id: habitId, date: '2026-11-23', completed: true, value: 1_000_001 }, userId)).success,
    false
  );

  lastMutations = [];
  const validLog = await saveHabitLogAction(
    { habit_id: habitId, date: '2026-11-23', completed: 'truthy', value: 3 },
    userId
  );
  assert.equal(validLog.success, true);
  assert.strictEqual(lastMutations[0].payload.completed, true);
  assert.equal(lastMutations[0].payload.value, 3);
});

test('VULN-06: internal DB error messages are suppressed while intentional auth errors are preserved', async () => {
  failTable = 'day_notes';
  const noteFail = await saveDayNoteAction('2026-11-23', 'hello', userId);
  assert.equal(noteFail.success, false);
  assert.equal(noteFail.error, 'Failed to save note');
  assert.doesNotMatch(noteFail.error, /connection failed/i);

  failTable = 'habits';
  const habitFail = await saveHabitAction(makeValidHabit(), userId);
  assert.equal(habitFail.success, false);
  assert.equal(habitFail.error, 'Failed to save habit');
  assert.doesNotMatch(habitFail.error, /connection failed/i);

  const origAuth = globalThis.dataTestAuth;
  try {
    globalThis.dataTestAuth = async () => ({ userId: ownerUserId, username: 'owner', role: 'owner' });
    failTable = 'app_users';
    const adminFail = await adminDeleteUserAction(otherUserId);
    assert.equal(adminFail.success, false);
    assert.equal(adminFail.error, 'Failed to delete user.');
    assert.doesNotMatch(adminFail.error, /connection failed/i);

    globalThis.dataTestAuth = async () => {
      throw new Error('Unauthorized: Valid session required.');
    };
    const authFail = await getHabitsAndLogsAction(userId);
    assert.equal(authFail.success, false);
    assert.equal(authFail.error, 'Unauthorized: Valid session required.');
  } finally {
    globalThis.dataTestAuth = origAuth;
    failTable = undefined;
  }
});
