'use client';

import { useEffect, useCallback, useSyncExternalStore } from 'react';
import { Habit, HabitLog } from './types';
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
  persistLocalData,
  persistDayNotes,
  loadLocalData,
} from './utils/storage';

export { generateId };

export interface HabitStoreState {
  habits: Habit[];
  activeHabits: Habit[];
  logs: Record<string, HabitLog>;
  dayNotes: Record<string, string>;
  currentUser: { id: string; username: string; role: string } | null;
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
let globalIsCloudReady = true;
let globalIsSyncing = false;
let globalSyncError: string | null = null;
let isStorageLoaded = false;
let isInitialSyncDone = false;
let listeners: Array<() => void> = [];

const INITIAL_STATE: HabitStoreState = {
  habits: [],
  activeHabits: [],
  logs: {},
  dayNotes: {},
  currentUser: null,
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

// Mutation Safety Trackers (Prevents split-second disappear/reappear race conditions)
const pendingDeletedHabitIds = new Set<string>();
const pendingAddedHabits = new Map<string, Habit>();
let lastLocalMutationTime = 0;

// Cross-tab synchronization via BroadcastChannel
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel('zenith_cross_tab_sync');
    broadcastChannel.onmessage = (event) => {
      if (event.data?.type === 'SYNC_STATE') {
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
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({
        type: 'SYNC_STATE',
        habits: globalHabits,
        logs: globalLogs,
        dayNotes: globalDayNotes,
      });
    } catch {}
  }
}

export function clearLocalUserData() {
  globalHabits = [];
  globalLogs = {};
  globalDayNotes = {};
  globalCurrentUser = null;
  lastLocalMutationTime = 0;
  pendingDeletedHabitIds.clear();
  pendingAddedHabits.clear();
  isStorageLoaded = false;
  isInitialSyncDone = false;
  updateStoreSnapshot();
}

export function loadLocalDataFromStorage(userId?: string) {
  if (typeof window === 'undefined') return;
  const uid = userId || globalCurrentUser?.id;
  const { habits, logs, dayNotes } = loadLocalData(uid);
  globalHabits = habits;
  globalLogs = logs;
  globalDayNotes = dayNotes;
  isStorageLoaded = true;
  updateStoreSnapshot();
}

// Unified Single Cloud Sync Executor
async function executeCloudSync(isBackground = false) {
  // Skip cloud sync if current tab session is locked
  if (typeof window !== 'undefined' && sessionStorage.getItem('zenith_session_unlocked') !== 'true') {
    return;
  }

  // If user performed a local action (add, delete, toggle) within the last 3.5s, skip sync to avoid race conditions
  if (isBackground && Date.now() - lastLocalMutationTime < 3500) {
    return;
  }

  const requestStartTime = Date.now();
  if (!isBackground) {
    globalIsSyncing = true;
    updateStoreSnapshot();
  }

  try {
    const res = await getHabitsAndLogsAction();
    if (!res.success) {
      if (res.error) globalSyncError = res.error;
      return;
    }

    lastSuccessfulSyncTime = Date.now();
    globalIsCloudReady = Boolean(res.isConfigured);
    globalSyncError = null;

    if (res.user) {
      if (globalCurrentUser && globalCurrentUser.id !== res.user.id) {
        globalHabits = [];
        globalLogs = {};
        globalDayNotes = {};
        pendingDeletedHabitIds.clear();
        pendingAddedHabits.clear();
      }
      globalCurrentUser = res.user;
    }

    if (res.isConfigured) {
      // Stale response guard: If a local action happened while this request was flying, ignore outdated response
      if (requestStartTime < lastLocalMutationTime) {
        return;
      }

      const serverHabits = (res.habits || []).filter((h) => !h.archived);
      const serverLogs = res.logs || {};

      // Robust Map-based reconciliation:
      const habitMap = new Map<string, Habit>();

      // 1. Add valid habits from server (excluding pending deleted)
      serverHabits.forEach((h) => {
        if (!pendingDeletedHabitIds.has(h.id)) {
          habitMap.set(h.id, h);
        }
      });

      // 2. Retain all pending locally added habits
      pendingAddedHabits.forEach((pendingHabit, id) => {
        if (!pendingDeletedHabitIds.has(id)) {
          habitMap.set(id, pendingHabit);
        }
      });

      // 3. Preserve any local habits created recently that haven't landed on server yet
      globalHabits.forEach((localHabit) => {
        if (!habitMap.has(localHabit.id) && !pendingDeletedHabitIds.has(localHabit.id)) {
          if (pendingAddedHabits.has(localHabit.id) || Date.now() - lastLocalMutationTime < 10000) {
            habitMap.set(localHabit.id, localHabit);
          }
        }
      });

      const mergedHabits = Array.from(habitMap.values());

      // 4. Clean logs for deleted habits
      const cleanLogs: Record<string, HabitLog> = {};
      Object.entries(serverLogs).forEach(([key, log]) => {
        if (!pendingDeletedHabitIds.has(log.habit_id)) {
          cleanLogs[key] = log;
        }
      });

      const hasBeenInitialized = typeof window !== 'undefined' && localStorage.getItem(INITIALIZED_KEY) === 'true';

      if (!hasBeenInitialized && mergedHabits.length === 0 && globalHabits.length > 0) {
        for (const h of globalHabits) {
          await saveHabitAction(h);
        }
        if (typeof window !== 'undefined') {
          localStorage.setItem(INITIALIZED_KEY, 'true');
        }
      } else {
        if (typeof window !== 'undefined') {
          localStorage.setItem(INITIALIZED_KEY, 'true');
        }
      }

      const habitsChanged = JSON.stringify(mergedHabits) !== JSON.stringify(globalHabits);
      const logsChanged = JSON.stringify(cleanLogs) !== JSON.stringify(globalLogs);

      // Reconcile server Day Notes (ALWAYS runs for Mobile and Desktop sync)
      const serverDayNotes = res.dayNotes || {};
      const mergedDayNotes = { ...globalDayNotes, ...serverDayNotes };

      // Backfill any local notes that do not exist on the server yet (scoped to 370 days)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 370);
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

      Object.entries(globalDayNotes).forEach(([dateStr, content]) => {
        if (content && !serverDayNotes[dateStr] && dateStr >= cutoffDateStr) {
          saveDayNoteAction(dateStr, content).catch(() => {});
        }
      });

      const dayNotesChanged = JSON.stringify(mergedDayNotes) !== JSON.stringify(globalDayNotes);
      if (dayNotesChanged) {
        globalDayNotes = mergedDayNotes;
        persistDayNotes(globalDayNotes, res.user?.id || globalCurrentUser?.id);
      }

      if (habitsChanged || logsChanged || dayNotesChanged) {
        globalHabits = mergedHabits;
        globalLogs = cleanLogs;
        persistLocalData(globalHabits, globalLogs);
        updateStoreSnapshot();
        broadcastLocalUpdate();
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('Server sync notice:', message);
    globalSyncError = message || 'Sync failed';
  } finally {
    isStorageLoaded = true;
    isInitialSyncDone = true;
    if (!isBackground) {
      globalIsSyncing = false;
    }
    updateStoreSnapshot();
  }
}

// Singleton Sync Coordinator
let hasStartedSyncLoop = false;
let lastSuccessfulSyncTime = 0;
let lastUserInteractionTime = Date.now();

function initGlobalSyncCoordinator() {
  if (typeof window === 'undefined' || hasStartedSyncLoop) return;
  hasStartedSyncLoop = true;

  loadLocalDataFromStorage();
  executeCloudSync();

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

  window.addEventListener('storage', () => {
    loadLocalDataFromStorage();
  });
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

  // 1. Instant Optimistic Toggle Habit Log (0ms UI latency) + Async Server Action
  const toggleHabit = async (habitId: string, dateStr: string, completed?: boolean, value?: number) => {
    lastLocalMutationTime = Date.now();
    const key = `${habitId}_${dateStr}`;
    const currentLog = globalLogs[key];

    const newCompleted = completed !== undefined ? completed : !currentLog?.completed;
    const habit = globalHabits.find((h) => h.id === habitId);
    
    const newValue = value !== undefined 
      ? value 
      : (newCompleted ? (habit?.target_value || 1) : 0);

    const updatedLog: HabitLog = {
      id: currentLog?.id || generateId(),
      habit_id: habitId,
      date: dateStr,
      completed: newCompleted,
      value: newValue,
      created_at: currentLog?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Update memory & local storage immediately
    globalLogs = {
      ...globalLogs,
      [key]: updatedLog,
    };
    persistLocalData(globalHabits, globalLogs);
    updateStoreSnapshot();
    broadcastLocalUpdate();

    // Background Server Action
    saveHabitLogAction(updatedLog).catch((e) => {
      console.error('Background server log error:', e);
    });
  };

  // 2. Add New Habit (Optimistic 0ms + Protected In-flight Tracking)
  const addHabit = async (habitData: Omit<Habit, 'id' | 'created_at' | 'order' | 'archived'>) => {
    lastLocalMutationTime = Date.now();
    const newHabit: Habit = {
      ...habitData,
      id: generateId(),
      archived: false,
      order: globalHabits.length,
      created_at: new Date().toISOString(),
    };

    pendingAddedHabits.set(newHabit.id, newHabit);

    globalHabits = [...globalHabits, newHabit];
    persistLocalData(globalHabits, globalLogs);
    updateStoreSnapshot();
    broadcastLocalUpdate();

    saveHabitAction(newHabit)
      .then((res) => {
        if (!res.success && res.error) {
          console.error('Server habit add error:', res.error);
          globalSyncError = res.error;
        }
      })
      .catch((e) => {
        console.error('Background server habit add error:', e);
      })
      .finally(() => {
        // Keep in tracking map for 4s so any in-flight GET query doesn't remove it prematurely
        setTimeout(() => {
          pendingAddedHabits.delete(newHabit.id);
        }, 4000);
      });

    return newHabit;
  };

  // 3. Update Existing Habit
  const updateHabit = async (habitId: string, updates: Partial<Habit>) => {
    lastLocalMutationTime = Date.now();
    let updatedHabitObj: Habit | undefined;
    globalHabits = globalHabits.map((h) => {
      if (h.id === habitId) {
        updatedHabitObj = { ...h, ...updates, updated_at: new Date().toISOString() };
        return updatedHabitObj;
      }
      return h;
    });

    persistLocalData(globalHabits, globalLogs);
    updateStoreSnapshot();
    broadcastLocalUpdate();

    if (updatedHabitObj) {
      saveHabitAction(updatedHabitObj).catch((e) => {
        console.error('Background server habit update error:', e);
      });
    }
  };

  // 4. Delete Habit (0ms Optimistic + Guaranteed Anti-Reappearance Protection)
  const deleteHabit = async (habitId: string) => {
    lastLocalMutationTime = Date.now();
    pendingDeletedHabitIds.add(habitId);
    pendingAddedHabits.delete(habitId);

    // 1. Remove habit from memory immediately
    globalHabits = globalHabits.filter((h) => h.id !== habitId);
    
    // 2. Remove associated logs
    const newLogs: Record<string, HabitLog> = {};
    Object.entries(globalLogs).forEach(([key, log]) => {
      if (log.habit_id !== habitId) {
        newLogs[key] = log;
      }
    });
    globalLogs = newLogs;

    // 3. Persist and notify other open tabs
    persistLocalData(globalHabits, globalLogs);
    updateStoreSnapshot();
    broadcastLocalUpdate();

    // 4. Delete on the server cloud database
    try {
      const res = await deleteHabitAction(habitId);
      if (!res.success && res.error) {
        console.error('Server habit delete error:', res.error);
        globalSyncError = res.error;
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('Background server habit delete error:', message);
      globalSyncError = message || 'Failed to delete on server';
    } finally {
      // Keep in protection set for 5s so any in-flight response arriving shortly can NEVER revive it
      setTimeout(() => {
        pendingDeletedHabitIds.delete(habitId);
      }, 5000);
    }
  };

  // 5. Reorder Habits
  const reorderHabits = async (orderedHabits: Habit[]) => {
    lastLocalMutationTime = Date.now();
    const updated = orderedHabits.map((h, index) => ({ ...h, order: index }));
    globalHabits = updated;
    persistLocalData(globalHabits, globalLogs);
    updateStoreSnapshot();
    broadcastLocalUpdate();

    reorderHabitsAction(updated).catch((e) => {
      console.error('Background server reorder error:', e);
    });
  };

  // 6. Save Day Note / Tasks (Instant autosave + Broadcast sync + Cloud sync)
  const saveDayNote = (dateStr: string, content: string) => {
    lastLocalMutationTime = Date.now();
    globalDayNotes = {
      ...globalDayNotes,
      [dateStr]: content,
    };
    persistDayNotes(globalDayNotes, globalCurrentUser?.id);
    updateStoreSnapshot();
    broadcastLocalUpdate();

    // Persist to server in background
    saveDayNoteAction(dateStr, content).catch((e) => {
      console.warn('Background saveDayNoteAction error:', e);
    });
  };

  return {
    habits: store.activeHabits,
    allHabits: store.habits,
    logs: store.logs,
    dayNotes: store.dayNotes,
    currentUser: store.currentUser,
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
  };
}
