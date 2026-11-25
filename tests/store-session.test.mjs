import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

let receive;
let finishSync;
let reads = 0;
let writes = 0;
let tabUserId = 'account-a';
let note = '';
let rejectNote = true;
const storage = new Map();
globalThis.window = globalThis;
globalThis.BroadcastChannel = class {
  set onmessage(handler) { receive = handler; }
};
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: key => storage.delete(key),
};
globalThis.sessionStorage = {
  getItem: key => key === 'zenith_session_unlocked' ? 'true' : tabUserId,
};
globalThis.getTestHabits = expectedUser => {
  reads++;
  assert.equal(expectedUser, tabUserId);
  return new Promise((resolve) => { finishSync = resolve; });
};
globalThis.writeTestNote = async (date, value, expectedUser) => {
  writes++;
  assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(expectedUser, tabUserId);
  if (rejectNote) return { success: false, error: 'Cloud unavailable' };
  note = value;
  return { success: true };
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'react') {
      return {
        url: 'data:text/javascript,export const useEffect = () => {}, useCallback = fn => fn, useSyncExternalStore = (_, snapshot) => snapshot();',
        shortCircuit: true,
      };
    }
    if (specifier === './server/actions') {
      return {
        url: 'data:text/javascript,export const getHabitsAndLogsAction = globalThis.getTestHabits; export const saveHabitAction = () => {}, deleteHabitAction = () => {}, saveHabitLogAction = () => {}, reorderHabitsAction = () => {}, saveDayNoteAction = globalThis.writeTestNote;',
        shortCircuit: true,
      };
    }
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (!specifier.startsWith('.') || specifier.endsWith('.ts')) throw error;
      return nextResolve(`${specifier}.ts`, context);
    }
  },
});

const { useHabitStore, setCurrentUser, clearLocalUserData, loadLocalDataFromStorage } = await import('../src/lib/store.ts');
const { getTodayDateString } = await import('../src/lib/utils/date.ts');
const { OWNER_USER_ID } = await import('../src/lib/types.ts');

test('habit store isolates accounts, deduplicates reads, and retries failed note writes', async () => {
  const user = { id: 'account-a', username: 'A', role: 'member' };
  const habit = { id: 'habit-a', title: 'Private habit' };
  setCurrentUser(user);
  assert.deepEqual(loadLocalDataFromStorage('account-b').habits, []);
  receive({ data: { type: 'SYNC_STATE', userId: 'account-b', habits: [{ id: 'habit-b' }] } });
  assert.deepEqual(useHabitStore().habits, []);
  receive({ data: { type: 'SYNC_STATE', userId: user.id, habits: [habit] } });
  assert.deepEqual(useHabitStore().habits, [habit]);

  const syncing = useHabitStore().syncWithCloud();
  const secondSync = useHabitStore().syncWithCloud();
  assert.equal(reads, 1);
  clearLocalUserData();
  finishSync({ success: true, isConfigured: true, user, habits: [habit] });
  await Promise.all([syncing, secondSync]);
  assert.equal(useHabitStore().currentUser, null);
  assert.deepEqual(useHabitStore().habits, []);

  setCurrentUser(user);
  const date = getTodayDateString();
  const oldSessionSave = useHabitStore().saveDayNote;
  oldSessionSave(date, 'draft');
  await useHabitStore().syncWithCloud();
  assert.equal(reads, 1);
  assert.equal(useHabitStore().dayNotes[date], 'draft');
  assert.equal(useHabitStore().syncError, 'Cloud unavailable');
  assert.equal(JSON.parse(storage.get('zenith_day_notes_account-a'))[date], 'draft');

  rejectNote = false;
  const retry = useHabitStore().syncWithCloud();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes, 2);
  assert.equal(note, 'draft');
  assert.equal(reads, 2);
  finishSync({ success: true, isConfigured: true, user, dayNotes: { [date]: note } });
  await retry;
  assert.equal(useHabitStore().syncError, null);
  assert.equal(useHabitStore().dayNotes[date], 'draft');

  tabUserId = 'account-b';
  setCurrentUser({ id: tabUserId, username: 'B', role: 'member' });
  oldSessionSave(date, 'stale draft');
  assert.equal(useHabitStore().dayNotes[date], undefined);
  assert.equal(writes, 2);

  storage.set('zenith_habits_owner', JSON.stringify([habit]));
  assert.deepEqual(loadLocalDataFromStorage(tabUserId).habits, []);
  tabUserId = OWNER_USER_ID;
  setCurrentUser({ id: tabUserId, username: 'Owner', role: 'owner' });
  assert.deepEqual(loadLocalDataFromStorage(tabUserId).habits, [habit]);
});

test('clearLocalUserData purges user-scoped vault keys when synced and preserves them when pending writes remain or in local-only mode', async () => {
  clearLocalUserData();
  storage.clear();
  reads = 0;
  writes = 0;
  rejectNote = false;
  tabUserId = 'vault-user';
  const user = { id: tabUserId, username: 'Vault', role: 'member' };
  const vaultKeys = [
    `zenith_habits_${tabUserId}`,
    `zenith_logs_${tabUserId}`,
    `zenith_day_notes_${tabUserId}`,
    `zenith_day_notes_meta_${tabUserId}`,
    `zenith_projects_v1_${tabUserId}`,
    `zenith_last_visit_at_${tabUserId}`,
    `zenith_last_ack_absence_at_${tabUserId}`,
    `zenith_pending_keys_${tabUserId}`,
    'zenith_player_level',
  ];
  const seedVaultKeys = () => {
    for (const key of vaultKeys) {
      storage.set(key, JSON.stringify({ seeded: true }));
    }
    storage.set('zenith_habits_other-user', JSON.stringify([{ id: 'other-habit' }]));
  };

  // 1. Synced cloud mode: clearLocalUserData purges all user-scoped vault keys + level
  setCurrentUser(user);
  const cloudSync = useHabitStore().syncWithCloud();
  finishSync({ success: true, isConfigured: true, user, habits: [], logs: {}, dayNotes: {} });
  await cloudSync;
  seedVaultKeys();
  clearLocalUserData();
  for (const key of vaultKeys) {
    assert.equal(storage.has(key), false, `expected ${key} to be purged on lock`);
  }
  assert.equal(storage.has('zenith_habits_other-user'), true);

  // 2. Pending writes remain: clearLocalUserData preserves vault keys to avoid data loss
  setCurrentUser(user);
  rejectNote = true;
  const date = getTodayDateString();
  useHabitStore().saveDayNote(date, 'unsynced draft');
  await useHabitStore().syncWithCloud();
  for (const key of vaultKeys) {
    if (!storage.has(key)) storage.set(key, JSON.stringify({ seeded: true }));
  }
  clearLocalUserData();
  for (const key of vaultKeys) {
    assert.equal(storage.has(key), true, `expected ${key} to be preserved when pending writes remain`);
  }

  // 3. Local-only / unconfigured mode: clearLocalUserData preserves vault keys
  setCurrentUser(user);
  rejectNote = false;
  const localSync = useHabitStore().syncWithCloud();
  await new Promise(resolve => setImmediate(resolve));
  finishSync({ success: true, isConfigured: false, user });
  await localSync;
  seedVaultKeys();
  clearLocalUserData();
  for (const key of vaultKeys) {
    assert.equal(storage.has(key), true, `expected ${key} to be preserved in local-only mode`);
  }
});
