import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

test('habit store ignores another tab’s account and sync replies received after locking', async () => {
  let receive;
  let finishSync;
  globalThis.window = globalThis;
  globalThis.BroadcastChannel = class {
    set onmessage(handler) { receive = handler; }
  };
  globalThis.localStorage = {
    getItem: () => null,
    setItem() {},
    removeItem() {},
  };
  globalThis.sessionStorage = { getItem: () => 'true' };
  globalThis.getTestHabits = () => new Promise((resolve) => { finishSync = resolve; });

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
          url: 'data:text/javascript,export const getHabitsAndLogsAction = () => globalThis.getTestHabits(); export const saveHabitAction = () => {}, deleteHabitAction = () => {}, saveHabitLogAction = () => {}, reorderHabitsAction = () => {}, saveDayNoteAction = () => {};',
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

  const { useHabitStore, setCurrentUser, clearLocalUserData } = await import('../src/lib/store.ts');
  const user = { id: 'account-a', username: 'A', role: 'member' };
  const habit = { id: 'habit-a', title: 'Private habit' };
  setCurrentUser(user);
  receive({ data: { type: 'SYNC_STATE', userId: 'account-b', habits: [{ id: 'habit-b' }] } });
  assert.deepEqual(useHabitStore().habits, []);
  receive({ data: { type: 'SYNC_STATE', userId: user.id, habits: [habit] } });
  assert.deepEqual(useHabitStore().habits, [habit]);

  const syncing = useHabitStore().syncWithCloud();
  clearLocalUserData();
  finishSync({ success: true, isConfigured: true, user, habits: [habit] });
  await syncing;
  assert.equal(useHabitStore().currentUser, null);
  assert.deepEqual(useHabitStore().habits, []);
});
