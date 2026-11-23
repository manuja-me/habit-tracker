import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

const userId = 'a7cb6833-441f-479c-bfd4-6a291f58c555';
const habitId = '3b81350a-3d27-4351-b6ca-4daf9e696a20';
const logs = Array.from({ length: 1001 }, (_, i) => ({
  id: String(i),
  habit_id: habitId,
  date: String(i),
  completed: true,
  value: 1,
}));
let failTable;
let calls = [];

globalThis.dataTestAuth = async () => ({ userId, username: 'test', role: 'member' });
globalThis.dataTestDb = {
  from(table) {
    calls.push(table);
    const query = {
      select: () => query,
      eq: () => query,
      or: () => query,
      gte: () => query,
      gt: () => query,
      lte: () => query,
      order: () => query,
      maybeSingle: () => query,
      delete: () => query,
      range(start, end) {
        if (failTable === table) return Promise.resolve({ error: { code: '08006', message: 'connection failed' } });
        return Promise.resolve({ data: logs.slice(start, end + 1), count: logs.length, error: null });
      },
      then(resolve) {
        if (failTable === table) return resolve({ error: { code: '08006', message: 'connection failed' } });
        const data = table === 'habits' ? [{ id: habitId, target_value: 1 }] : [];
        return resolve({ data, error: null });
      },
    };
    return query;
  },
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    const mock = {
      './auth': 'export const requireAuth = globalThis.dataTestAuth;',
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

const { getHabitsAndLogsAction, saveDayNoteAction, saveProjectAction } = await import('../src/lib/server/actions.ts');

test('server rejects stale-tab reads and writes before any database query', async () => {
  calls = [];
  const otherId = 'ef6cd57b-cf36-485e-b4fa-a4f61d445681';
  assert.match((await getHabitsAndLogsAction(otherId)).error, /account changed/i);
  assert.match((await saveDayNoteAction('2026-11-23', 'note', otherId)).error, /account changed/i);
  assert.match((await saveProjectAction({}, otherId)).error, /account changed/i);
  assert.deepEqual(calls, []);
});

test('cloud reads retain progress beyond the API row limit', async () => {
  const result = await getHabitsAndLogsAction(userId);
  assert.equal(result.success, true);
  assert.equal(Object.keys(result.logs).length, 1001);
});

test('cloud reads report a query failure instead of returning an empty snapshot', async () => {
  for (const table of ['habit_logs', 'day_notes']) {
    failTable = table;
    const result = await getHabitsAndLogsAction(userId);
    assert.equal(result.success, false);
    assert.equal(result.error, 'connection failed');
    assert.equal(result.logs, undefined);
    assert.equal(result.dayNotes, undefined);
  }
});
