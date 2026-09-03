'use client';

import { useState, useEffect, useCallback } from 'react';
import { Habit, HabitLog } from './types';
import { 
  getHabitsAndLogsAction, 
  saveHabitAction, 
  deleteHabitAction, 
  saveHabitLogAction, 
  reorderHabitsAction,
  saveDayNoteAction
} from './server/actions';

const HABITS_STORAGE_KEY = 'zenith_habits_v1';
const LOGS_STORAGE_KEY = 'zenith_logs_v1';
const DAY_NOTES_STORAGE_KEY = 'zenith_day_notes_v1';
const INITIALIZED_KEY = 'zenith_initialized_v1';

const INITIAL_DEFAULT_HABITS: Habit[] = [];

// Global in-memory state
let globalHabits: Habit[] = [];
let globalLogs: Record<string, HabitLog> = {};
let globalDayNotes: Record<string, string> = {};
let globalCurrentUser: { id: string; username: string; role: string } | null = null;
let globalIsCloudReady = true;
let globalIsSyncing = false;
let globalSyncError: string | null = null;
let isStorageLoaded = false;
let listeners: Array<() => void> = [];

// Mutation Safety Trackers (Prevents split-second disappear/reappear race conditions)
const pendingDeletedHabitIds = new Set<string>();
const pendingAddedHabits = new Map<string, Habit>();
let lastLocalMutationTime = 0;

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

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
        emitChange();
      }
    };
  } catch (e) {}
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
    } catch (e) {}
  }
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function persistLocally(newHabits: Habit[], newLogs: Record<string, HabitLog>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(newHabits));
    localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(newLogs));
  } catch (e) {
    console.error('Failed to save to localStorage', e);
  }
}

function loadLocalDataFromStorage() {
  if (typeof window === 'undefined' || isStorageLoaded) return;
  try {
    const storedHabits = localStorage.getItem(HABITS_STORAGE_KEY);
    const storedLogs = localStorage.getItem(LOGS_STORAGE_KEY);
    const storedDayNotes = localStorage.getItem(DAY_NOTES_STORAGE_KEY);

    if (storedHabits) {
      globalHabits = JSON.parse(storedHabits);
    } else {
      globalHabits = INITIAL_DEFAULT_HABITS;
      localStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(INITIAL_DEFAULT_HABITS));
    }

    if (storedLogs) {
      globalLogs = JSON.parse(storedLogs);
    } else {
      globalLogs = {};
    }

    if (storedDayNotes) {
      try {
        globalDayNotes = JSON.parse(storedDayNotes);
      } catch (err) {
        globalDayNotes = {};
      }
    } else {
      globalDayNotes = {};
    }

    isStorageLoaded = true;
    emitChange();
  } catch (e) {
    console.error('Failed to read from localStorage', e);
  }
}

// Unified Single Cloud Sync Executor
async function executeCloudSync(isBackground = false) {
  // If user performed a local action (add, delete, toggle) within the last 3.5s, skip sync to avoid race conditions
  if (isBackground && Date.now() - lastLocalMutationTime < 3500) {
    return;
  }

  const requestStartTime = Date.now();
  if (!isBackground) {
    globalIsSyncing = true;
    emitChange();
  }

  try {
    const res = await getHabitsAndLogsAction();
    if (!res.success) {
      if (res.error) globalSyncError = res.error;
      return;
    }

    globalIsCloudReady = Boolean(res.isConfigured);
    globalSyncError = null;

    if (res.user) {
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

      // Backfill any local notes that do not exist on the server yet
      Object.entries(globalDayNotes).forEach(([dateStr, content]) => {
        if (content && !serverDayNotes[dateStr]) {
          saveDayNoteAction(dateStr, content).catch(() => {});
        }
      });

      const dayNotesChanged = JSON.stringify(mergedDayNotes) !== JSON.stringify(globalDayNotes);
      if (dayNotesChanged) {
        globalDayNotes = mergedDayNotes;
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(DAY_NOTES_STORAGE_KEY, JSON.stringify(globalDayNotes));
          } catch (e) {
            console.error('Failed to save day notes to localStorage', e);
          }
        }
      }

      if (habitsChanged || logsChanged || dayNotesChanged) {
        globalHabits = mergedHabits;
        globalLogs = cleanLogs;
        persistLocally(globalHabits, globalLogs);
        emitChange();
        broadcastLocalUpdate();
      }
    }
  } catch (err: any) {
    console.warn('Server sync notice:', err?.message || err);
    globalSyncError = err?.message || 'Sync failed';
  } finally {
    if (!isBackground) {
      globalIsSyncing = false;
      emitChange();
    }
  }
}

// Singleton Sync Loop (Runs once across all components)
let hasStartedSyncLoop = false;
function initGlobalSyncCoordinator() {
  if (typeof window === 'undefined' || hasStartedSyncLoop) return;
  hasStartedSyncLoop = true;

  loadLocalDataFromStorage();
  executeCloudSync();

  // Background polling every 5s when tab is active
  setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      executeCloudSync(true);
    }
  }, 5000);

  // Sync on tab focus or visibility change only when no recent local action took place
  const handleFocusOrVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      if (Date.now() - lastLocalMutationTime < 3500) return;
      executeCloudSync(true);
    }
  };

  window.addEventListener('focus', handleFocusOrVisibility);
  document.addEventListener('visibilitychange', handleFocusOrVisibility);

  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === HABITS_STORAGE_KEY && e.newValue) {
      try {
        globalHabits = JSON.parse(e.newValue);
        emitChange();
      } catch (err) {}
    }
    if (e.key === LOGS_STORAGE_KEY && e.newValue) {
      try {
        globalLogs = JSON.parse(e.newValue);
        emitChange();
      } catch (err) {}
    }
    if (e.key === DAY_NOTES_STORAGE_KEY && e.newValue) {
      try {
        globalDayNotes = JSON.parse(e.newValue);
        emitChange();
      } catch (err) {}
    }
  });
}

export function useHabitStore() {
  const [habits, setHabits] = useState<Habit[]>(globalHabits);
  const [logs, setLogs] = useState<Record<string, HabitLog>>(globalLogs);
  const [dayNotes, setDayNotes] = useState<Record<string, string>>(globalDayNotes);
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string; role: string } | null>(globalCurrentUser);
  const [isLoading, setIsLoading] = useState<boolean>(!isStorageLoaded);
  const [isSyncing, setIsSyncing] = useState<boolean>(globalIsSyncing);
  const [syncError, setSyncError] = useState<string | null>(globalSyncError);
  const [isCloudReady, setIsCloudReady] = useState<boolean>(globalIsCloudReady);

  useEffect(() => {
    initGlobalSyncCoordinator();

    const handleUpdate = () => {
      setHabits([...globalHabits]);
      setLogs({ ...globalLogs });
      setDayNotes({ ...globalDayNotes });
      setCurrentUser(globalCurrentUser);
      setIsLoading(!isStorageLoaded);
      setIsSyncing(globalIsSyncing);
      setSyncError(globalSyncError);
      setIsCloudReady(globalIsCloudReady);
    };

    listeners.push(handleUpdate);
    return () => {
      listeners = listeners.filter((l) => l !== handleUpdate);
    };
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
      notes: currentLog?.notes || '',
      created_at: currentLog?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Update memory & local storage immediately
    globalLogs = {
      ...globalLogs,
      [key]: updatedLog,
    };
    persistLocally(globalHabits, globalLogs);
    emitChange();
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
    persistLocally(globalHabits, globalLogs);
    emitChange();
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

    persistLocally(globalHabits, globalLogs);
    emitChange();
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
    persistLocally(globalHabits, globalLogs);
    emitChange();
    broadcastLocalUpdate();

    // 4. Delete on the server cloud database
    try {
      const res = await deleteHabitAction(habitId);
      if (!res.success && res.error) {
        console.error('Server habit delete error:', res.error);
        globalSyncError = res.error;
      }
    } catch (e: any) {
      console.error('Background server habit delete error:', e);
      globalSyncError = e?.message || 'Failed to delete on server';
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
    persistLocally(globalHabits, globalLogs);
    emitChange();
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
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(DAY_NOTES_STORAGE_KEY, JSON.stringify(globalDayNotes));
      } catch (e) {
        console.error('Failed to save day notes to localStorage', e);
      }
    }
    emitChange();
    broadcastLocalUpdate();

    // Persist to server in background
    saveDayNoteAction(dateStr, content).catch((e) => {
      console.warn('Background saveDayNoteAction error:', e);
    });
  };

  return {
    habits: habits.filter((h) => !h.archived).sort((a, b) => a.order - b.order),
    allHabits: habits,
    logs,
    dayNotes,
    currentUser,
    isLoading,
    isSyncing,
    syncError,
    isCloudReady,
    toggleHabit,
    addHabit,
    updateHabit,
    deleteHabit,
    reorderHabits,
    syncWithCloud,
    saveDayNote,
  };
}
