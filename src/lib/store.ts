'use client';

import { useEffect, useCallback, useSyncExternalStore } from 'react';
import { OWNER_USER_ID, type Habit, type HabitLog } from './types';
import { 
  getHabitsAndLogsAction, 
  saveHabitAction, 
  deleteHabitAction, 
  saveHabitLogAction, 
  reorderHabitsAction,
  saveDayNoteAction
} from './server/actions';
import {
  generateId,
  INITIALIZED_KEY,
  LAST_USER_KEY,
  persistLocalData,
  persistDayNotes,
  pruneExpiredDayNotes,
  loadLocalData,
} from './utils/storage';
import { isPlannerNoteExpired } from './utils/date';
import { getUnlockedTabUserId } from './utils/tab-session';

export { generateId };

export interface HabitStoreState {
  habits: Habit[];
  activeHabits: Habit[];
  logs: Record<string, HabitLog>;
  dayNotes: Record<string, string>;
  currentUser: { id: string; username: string; role: string } | null;
  lastAccountActiveAt: string | null;
  isLoading: boolean;
  isInitialSyncDone: boolean;
  isSyncing: boolean;
  syncError: string | null;
  isCloudReady: boolean;
}

// Global in-memory state
let globalHabits: Habit[] = [];
let globalLogs: Record<string, HabitLog> = {};
let globalDayNotes: Record<string, string> = {};
let globalCurrentUser: { id: string; username: string; role: string } | null = null;
let globalLastAccountActiveAt: string | null = null;
let globalIsCloudReady = true;
let globalIsSyncing = false;
let globalSyncError: string | null = null;
let isStorageLoaded = false;
let isInitialSyncDone = false;
let sessionGeneration = 0;
let listeners: Array<() => void> = [];

const INITIAL_STATE: HabitStoreState = {
  habits: [],
  activeHabits: [],
  logs: {},
  dayNotes: {},
  currentUser: null,
  lastAccountActiveAt: null,
  isLoading: true,
  isInitialSyncDone: false,
  isSyncing: false,
  syncError: null,
  isCloudReady: true,
};

let storeSnapshot: HabitStoreState = INITIAL_STATE;

function updateStoreSnapshot() {
  storeSnapshot = {
    habits: globalHabits,
    activeHabits: globalHabits.filter((h) => !h.archived).sort((a, b) => a.order - b.order),
    logs: globalLogs,
    dayNotes: globalDayNotes,
    currentUser: globalCurrentUser,
    lastAccountActiveAt: globalLastAccountActiveAt,
    isLoading: !isStorageLoaded,
    isInitialSyncDone,
    isSyncing: globalIsSyncing,
    syncError: globalSyncError,
    isCloudReady: globalIsCloudReady,
  };
  for (const listener of listeners) {
    listener();
  }
}

type CloudWrite = () => Promise<{ success: boolean; error?: string }>;
const pendingWrites = new Map<string, CloudWrite>();
let activeWritePromise: Promise<boolean> | null = null;
let lastLocalMutationTime = 0;
let localRevision = 0;

function isUnlocked() {
  return typeof window !== 'undefined' && !!globalCurrentUser &&
    getUnlockedTabUserId() === globalCurrentUser.id;
}

function recordPendingKey(userId: string, key: string) {
  if (typeof window === 'undefined' || !userId) return;
  try {
    const raw = localStorage.getItem(`zenith_pending_keys_${userId}`);
    const set = new Set(raw ? JSON.parse(raw) : []);
    set.add(key);
    localStorage.setItem(`zenith_pending_keys_${userId}`, JSON.stringify([...set]));
  } catch {}
}

function removePendingKey(userId: string, key: string) {
  if (typeof window === 'undefined' || !userId) return;
  try {
    const raw = localStorage.getItem(`zenith_pending_keys_${userId}`);
    if (!raw) return;
    const set = new Set(JSON.parse(raw));
    set.delete(key);
    if (set.size > 0) {
      localStorage.setItem(`zenith_pending_keys_${userId}`, JSON.stringify([...set]));
    } else {
      localStorage.removeItem(`zenith_pending_keys_${userId}`);
    }
  } catch {}
}

function rehydratePendingWrites(userId: string) {
  if (typeof window === 'undefined' || !userId) return;
  try {
    const raw = localStorage.getItem(`zenith_pending_keys_${userId}`);
    if (!raw) return;
    const keys: string[] = JSON.parse(raw);
    for (const key of keys) {
      if (pendingWrites.has(key)) continue;
      if (key.startsWith('log:')) {
        const logKey = key.slice(4);
        const log = globalLogs[logKey];
        if (log) {
          pendingWrites.set(key, () => saveHabitLogAction(log, userId));
        }
      } else if (key.startsWith('habit:')) {
        const habitId = key.slice(6);
        const habit = globalHabits.find((h) => h.id === habitId);
        if (habit) {
          pendingWrites.set(key, () => saveHabitAction(habit, userId));
        } else {
          pendingWrites.set(key, () => deleteHabitAction(habitId, userId));
        }
      } else if (key.startsWith('note:')) {
        const dateStr = key.slice(5);
        const content = globalDayNotes[dateStr] || '';
        pendingWrites.set(key, () => saveDayNoteAction(dateStr, content, userId));
      } else if (key === 'order') {
        pendingWrites.set('order', () => reorderHabitsAction(globalHabits, userId));
      }
    }
  } catch {}
}

function flushPendingWrites() {
  if (activeWritePromise) return activeWritePromise;
  if (!pendingWrites.size) return Promise.resolve(true);

  const generation = sessionGeneration;
  activeWritePromise = (async () => {
    let failure = '';
    // Attempt each queued revision once. A later sync retries failed revisions.
    const attempted = new Set<CloudWrite>();
    while (generation === sessionGeneration && isUnlocked()) {
      const next = [...pendingWrites].find(([, write]) => !attempted.has(write));
      if (!next) break;
      const [key, write] = next;
      attempted.add(write);
      let result;
      try {
        result = await write();
      } catch {
        result = { success: false, error: 'Could not save changes. Sync to retry.' };
      }
      if (generation !== sessionGeneration) return false;
      if (pendingWrites.get(key) !== write) continue;
      if (result.success) {
        pendingWrites.delete(key);
        if (globalCurrentUser) removePendingKey(globalCurrentUser.id, key);
      } else {
        failure = result.error || 'Could not save changes. Sync to retry.';
      }
    }
    if (generation !== sessionGeneration) return false;
    globalSyncError = failure || null;
    updateStoreSnapshot();
    return pendingWrites.size === 0;
  })().finally(() => {
    if (generation === sessionGeneration) activeWritePromise = null;
  });
  return activeWritePromise;
}

function queueCloudWrite(key: string, write: CloudWrite) {
  lastLocalMutationTime = Date.now();
  localRevision++;
  pendingWrites.set(key, write);
  if (globalCurrentUser) recordPendingKey(globalCurrentUser.id, key);
  queueMicrotask(() => { void flushPendingWrites(); });
}

// Cross-tab synchronization via BroadcastChannel
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel('zenith_cross_tab_sync');
    broadcastChannel.onmessage = (event) => {
      if (
        event.data?.type === 'SYNC_STATE' &&
        globalCurrentUser &&
        event.data.userId === globalCurrentUser.id &&
        !pendingWrites.size &&
        isUnlocked()
      ) {
        localRevision++;
        if (Array.isArray(event.data.habits)) {
          globalHabits = event.data.habits;
        }
        if (event.data.logs) {
          globalLogs = event.data.logs;
        }
        if (event.data.dayNotes) {
          globalDayNotes = event.data.dayNotes;
        }
        updateStoreSnapshot();
      }
    };
  } catch {}
}

function broadcastLocalUpdate() {
  if (broadcastChannel && globalCurrentUser) {
    try {
      broadcastChannel.postMessage({
        type: 'SYNC_STATE',
        userId: globalCurrentUser.id,
        habits: globalHabits,
        logs: globalLogs,
        dayNotes: globalDayNotes,
      });
    } catch {}
  }
}

export function clearLocalUserData() {
  sessionGeneration++;
  activeSyncPromise = null;
  activeWritePromise = null;
  globalIsCloudReady = true;
  globalIsSyncing = false;
  globalSyncError = null;
  globalHabits = [];
  globalLogs = {};
  globalDayNotes = {};
  globalCurrentUser = null;
  globalLastAccountActiveAt = null;
  lastLocalMutationTime = 0;
  pendingWrites.clear();
  isStorageLoaded = false;
  isInitialSyncDone = false;
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(LAST_USER_KEY);
    } catch {}
  }
  updateStoreSnapshot();
}

export function setCurrentUser(user: { id: string; username: string; role: string } | null) {
  if (globalCurrentUser?.id !== user?.id) clearLocalUserData();
  globalCurrentUser = user;
  if (user && typeof window !== 'undefined') {
    try {
      localStorage.setItem(LAST_USER_KEY, user.id);
    } catch {}
  }
  updateStoreSnapshot();
}

export function loadLocalDataFromStorage(userId?: string): {
  habits: Habit[];
  logs: Record<string, HabitLog>;
  dayNotes: Record<string, string>;
} {
  const uid = globalCurrentUser?.id;
  if (!isUnlocked() || !uid || (userId && userId !== uid)) {
    return { habits: [], logs: {}, dayNotes: {} };
  }
  const { habits, logs, dayNotes } = loadLocalData(uid);
  globalHabits = habits;
  globalLogs = logs;
  globalDayNotes = dayNotes;
  isStorageLoaded = true;
  rehydratePendingWrites(uid);
  updateStoreSnapshot();
  return { habits, logs, dayNotes };
}

let activeSyncPromise: Promise<void> | null = null;

async function executeCloudSync(isBackground = false): Promise<void> {
  const user = globalCurrentUser;
  if (!isUnlocked() || !user) return;
  if (activeSyncPromise) return activeSyncPromise;
  if (isBackground && Date.now() - lastLocalMutationTime < 3500) return;

  const generation = sessionGeneration;
  activeSyncPromise = (async () => {
    if (!isBackground) {
      globalIsSyncing = true;
      updateStoreSnapshot();
    }
    try {
      rehydratePendingWrites(user.id);
      if (pendingWrites.size && !(await flushPendingWrites())) return;
      if (generation !== sessionGeneration) return;
      const revision = localRevision;
      const res = await getHabitsAndLogsAction(user.id);
      if (generation !== sessionGeneration || !isUnlocked() || revision !== localRevision || pendingWrites.size) return;
      if (!res.success) {
        globalSyncError = res.error || 'Sync failed';
        return;
      }
      if (res.user?.id !== user.id) {
        globalSyncError = 'The signed-in account changed. Lock and unlock Zenith to continue.';
        return;
      }

      globalIsCloudReady = res.isConfigured;
      globalSyncError = null;
      globalLastAccountActiveAt = res.lastActiveAt ?? null;
      globalCurrentUser = res.user;
      lastSuccessfulSyncTime = Date.now();
      if (!res.isConfigured) return;

      const serverHabits = res.habits || [];
      const serverLogs = res.logs || {};
      const serverNotes = pruneExpiredDayNotes(res.dayNotes || {}).dayNotes;
      const initializedKey = `${INITIALIZED_KEY}_${user.id}`;

      // Only the built-in owner may migrate older browser-only data into an empty vault.
      if (user.id === OWNER_USER_ID && localStorage.getItem(initializedKey) !== 'true' &&
          localStorage.getItem(INITIALIZED_KEY) !== 'true' &&
          !serverHabits.length && !Object.keys(serverNotes).length) {
        for (const habit of globalHabits) {
          pendingWrites.set(`habit:${habit.id}`, () => saveHabitAction(habit, user.id));
        }
        for (const [key, log] of Object.entries(globalLogs)) {
          pendingWrites.set(`log:${key}`, () => saveHabitLogAction(log, user.id));
        }
        for (const [date, content] of Object.entries(globalDayNotes)) {
          pendingWrites.set(`note:${date}`, () => saveDayNoteAction(date, content, user.id));
        }
        if (!(await flushPendingWrites()) || generation !== sessionGeneration) return;
        localStorage.setItem(initializedKey, 'true');
        return;
      }

      localStorage.setItem(initializedKey, 'true');
      const habitsChanged = JSON.stringify(serverHabits) !== JSON.stringify(globalHabits);
      const logsChanged = JSON.stringify(serverLogs) !== JSON.stringify(globalLogs);
      const notesChanged = JSON.stringify(serverNotes) !== JSON.stringify(globalDayNotes);
      if (notesChanged) globalDayNotes = persistDayNotes(serverNotes, user.id);
      if (habitsChanged || logsChanged) {
        globalHabits = serverHabits;
        globalLogs = serverLogs;
        persistLocalData(globalHabits, globalLogs, user.id);
      }
      if (habitsChanged || logsChanged || notesChanged) broadcastLocalUpdate();
    } catch (err: unknown) {
      if (generation !== sessionGeneration) return;
      globalSyncError = err instanceof Error ? err.message : 'Sync failed';
    } finally {
      if (generation === sessionGeneration) {
        isStorageLoaded = true;
        isInitialSyncDone = true;
        if (!isBackground) globalIsSyncing = false;
        updateStoreSnapshot();
      }
    }
  })().finally(() => {
    if (generation === sessionGeneration) activeSyncPromise = null;
  });
  return activeSyncPromise;
}

// Singleton Sync Coordinator
let hasStartedSyncLoop = false;
let lastSuccessfulSyncTime = 0;
let lastUserInteractionTime = Date.now();

function initGlobalSyncCoordinator() {
  if (typeof window === 'undefined' || hasStartedSyncLoop) return;
  hasStartedSyncLoop = true;

  // Track user presence to pause syncing when the user is away or tab left open overnight
  const recordInteraction = () => {
    const wasIdle = Date.now() - lastUserInteractionTime > 5 * 60 * 1000;
    lastUserInteractionTime = Date.now();

    // If user returns after being away (>5 min) and hasn't synced in the last 20s, sync now
    if (wasIdle && Date.now() - lastSuccessfulSyncTime > 20000) {
      executeCloudSync(true);
    }
  };

  window.addEventListener('mousemove', recordInteraction, { passive: true });
  window.addEventListener('keydown', recordInteraction, { passive: true });
  window.addEventListener('touchstart', recordInteraction, { passive: true });
  window.addEventListener('click', recordInteraction, { passive: true });

  // Intelligent Background Polling (every 60s instead of 5s)
  setInterval(() => {
    if (typeof document === 'undefined') return;
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - lastUserInteractionTime > 5 * 60 * 1000) return;
    if (Date.now() - lastLocalMutationTime < 3500) return;

    executeCloudSync(true);
  }, 60000);

  // Sync on tab focus or visibility change with a 20s throttle cooldown
  const handleFocusOrVisibility = () => {
    recordInteraction();
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      if (Date.now() - lastLocalMutationTime < 3500) return;
      if (Date.now() - lastSuccessfulSyncTime < 20000) return;
      executeCloudSync(true);
    }
  };

  window.addEventListener('focus', handleFocusOrVisibility);
  document.addEventListener('visibilitychange', handleFocusOrVisibility);
}

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot() {
  return storeSnapshot;
}

function getServerSnapshot() {
  return INITIAL_STATE;
}

export function useHabitStore() {
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    initGlobalSyncCoordinator();
  }, []);

  const syncWithCloud = useCallback((isBackground = false) => {
    return executeCloudSync(isBackground);
  }, []);

  const sessionId = store.currentUser?.id;
  const generation = sessionGeneration;
  const hasSession = () => generation === sessionGeneration && sessionId && isUnlocked();

  function persistHabitsAndLogs() {
    persistLocalData(globalHabits, globalLogs, sessionId);
    updateStoreSnapshot();
    broadcastLocalUpdate();
  }

  const toggleHabit = async (habitId: string, dateStr: string, completed?: boolean, value?: number) => {
    const habit = globalHabits.find((h) => h.id === habitId);
    if (!hasSession() || !habit) return;
    const key = `${habitId}_${dateStr}`;
    const currentLog = globalLogs[key];
    const newCompleted = completed ?? !currentLog?.completed;
    const now = new Date().toISOString();
    const updatedLog: HabitLog = {
      id: currentLog?.id || generateId(),
      habit_id: habitId,
      date: dateStr,
      completed: newCompleted,
      value: value ?? (newCompleted ? habit.target_value || 1 : 0),
      created_at: currentLog?.created_at || now,
      updated_at: now,
    };

    globalLogs = { ...globalLogs, [key]: updatedLog };
    queueCloudWrite(`log:${key}`, () => saveHabitLogAction(updatedLog, sessionId));
    persistHabitsAndLogs();
  };

  const addHabit = async (habitData: Omit<Habit, 'id' | 'created_at' | 'order' | 'archived'>) => {
    if (!hasSession()) return;
    const newHabit: Habit = {
      ...habitData,
      id: generateId(),
      archived: false,
      order: globalHabits.reduce((max, habit) => Math.max(max, habit.order), -1) + 1,
      created_at: new Date().toISOString(),
    };
    globalHabits = [...globalHabits, newHabit];
    queueCloudWrite(`habit:${newHabit.id}`, () => saveHabitAction(newHabit, sessionId));
    persistHabitsAndLogs();
    return newHabit;
  };

  const updateHabit = async (habitId: string, updates: Partial<Habit>) => {
    if (!hasSession()) return;
    const original = globalHabits.find((habit) => habit.id === habitId);
    if (!original) return;
    const updated = { ...original, ...updates, updated_at: new Date().toISOString() };
    globalHabits = globalHabits.map((habit) => habit.id === habitId ? updated : habit);
    queueCloudWrite(`habit:${habitId}`, () => saveHabitAction(updated, sessionId));
    persistHabitsAndLogs();
  };

  const deleteHabit = async (habitId: string) => {
    if (!hasSession()) return;
    globalHabits = globalHabits.filter((habit) => habit.id !== habitId);
    globalLogs = Object.fromEntries(Object.entries(globalLogs).filter(([, log]) => log.habit_id !== habitId));
    for (const key of pendingWrites.keys()) {
      if (key.startsWith(`log:${habitId}_`)) {
        pendingWrites.delete(key);
        if (sessionId) removePendingKey(sessionId, key);
      }
    }
    queueCloudWrite(`habit:${habitId}`, () => deleteHabitAction(habitId, sessionId));
    persistHabitsAndLogs();
  };

  const reorderHabits = async (orderedHabits: Habit[]) => {
    if (!hasSession()) return;
    const order = new Map(orderedHabits.map((habit, index) => [habit.id, index]));
    globalHabits = globalHabits.map((habit) => {
      const index = order.get(habit.id);
      return index === undefined ? habit : { ...habit, order: index };
    });
    const changed = globalHabits.filter((habit) => order.has(habit.id));
    queueCloudWrite('order', () => reorderHabitsAction(changed, sessionId));
    persistHabitsAndLogs();
  };

  const saveDayNote = (dateStr: string, content: string) => {
    if (!hasSession()) return;
    const nextNotes = { ...globalDayNotes };
    if (!content.trim() || isPlannerNoteExpired(dateStr)) {
      delete nextNotes[dateStr];
    } else {
      nextNotes[dateStr] = content;
    }
    globalDayNotes = persistDayNotes(nextNotes, sessionId);
    queueCloudWrite(`note:${dateStr}`, () => saveDayNoteAction(dateStr, nextNotes[dateStr] || '', sessionId));
    updateStoreSnapshot();
    broadcastLocalUpdate();
  };

  return {
    habits: store.activeHabits,
    allHabits: store.habits,
    logs: store.logs,
    dayNotes: store.dayNotes,
    currentUser: store.currentUser,
    lastAccountActiveAt: store.lastAccountActiveAt,
    isLoading: store.isLoading,
    isInitialSyncDone: store.isInitialSyncDone,
    isSyncing: store.isSyncing,
    syncError: store.syncError,
    isCloudReady: store.isCloudReady,
    toggleHabit,
    addHabit,
    updateHabit,
    deleteHabit,
    reorderHabits,
    syncWithCloud,
    saveDayNote,
    setCurrentUser,
  };
}
