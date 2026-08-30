'use client';

import { useState, useEffect, useCallback } from 'react';
import { Habit, HabitLog } from './types';
import { 
  getHabitsAndLogsAction, 
  saveHabitAction, 
  deleteHabitAction, 
  saveHabitLogAction, 
  reorderHabitsAction 
} from './server/actions';

const HABITS_STORAGE_KEY = 'zenith_habits_v1';
const LOGS_STORAGE_KEY = 'zenith_logs_v1';
const INITIALIZED_KEY = 'zenith_initialized_v1';

const INITIAL_DEFAULT_HABITS: Habit[] = [
  {
    id: 'f1a1a1a1-1111-4111-8111-111111111111',
    title: 'Morning Deep Work',
    description: '90 minutes of focused, distraction-free work',
    category: 'productivity',
    color: '#6366F1',
    icon: 'Focus',
    type: 'boolean',
    target_value: 1,
    frequency: 'weekdays',
    archived: false,
    order: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: 'f2a2a2a2-2222-4222-8222-222222222222',
    title: 'Drink 2.5L Water',
    description: 'Stay hydrated throughout the day',
    category: 'health',
    color: '#06B6D4',
    icon: 'Droplets',
    type: 'number',
    target_value: 2500,
    target_unit: 'ml',
    frequency: 'daily',
    archived: false,
    order: 1,
    created_at: new Date().toISOString(),
  },
  {
    id: 'f3a3a3a3-3333-4333-8333-333333333333',
    title: 'Daily Movement / Workout',
    description: 'Gym, running, or 30-min brisk walk',
    category: 'fitness',
    color: '#10B981',
    icon: 'Dumbbell',
    type: 'boolean',
    target_value: 1,
    frequency: 'daily',
    archived: false,
    order: 2,
    created_at: new Date().toISOString(),
  },
  {
    id: 'f4a4a4a4-4444-4444-8444-444444444444',
    title: 'Read 20 Pages',
    description: 'Books on technology, philosophy, or growth',
    category: 'learning',
    color: '#F59E0B',
    icon: 'BookOpen',
    type: 'number',
    target_value: 20,
    target_unit: 'pages',
    frequency: 'daily',
    archived: false,
    order: 3,
    created_at: new Date().toISOString(),
  },
  {
    id: 'f5a5a5a5-5555-4555-8555-555555555555',
    title: 'Evening Reflection & Journal',
    description: 'Review wins, lessons, and tomorrow\'s plan',
    category: 'mindfulness',
    color: '#EC4899',
    icon: 'Sparkles',
    type: 'boolean',
    target_value: 1,
    frequency: 'daily',
    archived: false,
    order: 4,
    created_at: new Date().toISOString(),
  },
];

let globalHabits: Habit[] = [];
let globalLogs: Record<string, HabitLog> = {};
let globalIsCloudReady = true;
let listeners: Array<() => void> = [];

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
        emitChange();
      }
    };
  } catch (e) {
    // Unsupported or restricted environment
  }
}

function broadcastLocalUpdate() {
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({
        type: 'SYNC_STATE',
        habits: globalHabits,
        logs: globalLogs,
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

export function useHabitStore() {
  const [habits, setHabits] = useState<Habit[]>(globalHabits);
  const [logs, setLogs] = useState<Record<string, HabitLog>>(globalLogs);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isCloudReady, setIsCloudReady] = useState<boolean>(globalIsCloudReady);

  const persistLocally = (newHabits: Habit[], newLogs: Record<string, HabitLog>) => {
    try {
      localStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(newHabits));
      localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(newLogs));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  };

  // Sync with Server (Protected Server Action Proxy)
  const syncWithCloud = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsSyncing(true);
    setSyncError(null);

    try {
      const res = await getHabitsAndLogsAction();
      if (!res.success) {
        if (res.error) setSyncError(res.error);
        return;
      }

      globalIsCloudReady = Boolean(res.isConfigured);
      setIsCloudReady(globalIsCloudReady);

      if (res.isConfigured) {
        const serverHabits = res.habits || [];
        const serverLogs = res.logs || {};

        const hasBeenInitialized = typeof window !== 'undefined' && localStorage.getItem(INITIALIZED_KEY) === 'true';

        if (!hasBeenInitialized && serverHabits.length === 0 && globalHabits.length > 0) {
          // First time ever running with empty cloud DB: seed defaults
          for (const h of globalHabits) {
            await saveHabitAction(h);
          }
          if (typeof window !== 'undefined') {
            localStorage.setItem(INITIALIZED_KEY, 'true');
          }
        } else {
          // Cloud database is authoritative!
          // If a habit was deleted on another device, serverHabits will NOT contain it.
          // Replacing local habits with serverHabits ensures deleted habits disappear on this device too.
          if (typeof window !== 'undefined') {
            localStorage.setItem(INITIALIZED_KEY, 'true');
          }

          globalHabits = serverHabits;
          globalLogs = serverLogs;
          setHabits(serverHabits);
          setLogs(serverLogs);
          persistLocally(globalHabits, globalLogs);
          emitChange();
          broadcastLocalUpdate();
        }
      }
    } catch (err: any) {
      console.warn('Server sync notice:', err?.message || err);
      setSyncError(err?.message || 'Sync failed');
    } finally {
      if (!isBackground) setIsSyncing(false);
    }
  }, []);

  // Load from local storage initially
  const loadLocalData = useCallback(() => {
    try {
      const storedHabits = localStorage.getItem(HABITS_STORAGE_KEY);
      const storedLogs = localStorage.getItem(LOGS_STORAGE_KEY);

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

      setHabits(globalHabits);
      setLogs(globalLogs);
    } catch (e) {
      console.error('Failed to read from localStorage', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLocalData();
    syncWithCloud();

    // 1. Periodic background polling every 4s when window is visible
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        syncWithCloud(true);
      }
    }, 4000);

    // 2. Immediate sync on window focus (e.g. switching back to this device/tab)
    const handleFocus = () => {
      syncWithCloud(true);
    };

    // 3. Immediate sync on visibility change (e.g. unlocking phone or switching browser tab)
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        syncWithCloud(true);
      }
    };

    // 4. Cross-tab storage event
    const handleStorage = (e: StorageEvent) => {
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
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('storage', handleStorage);
    }

    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('storage', handleStorage);
      }
    };
  }, [loadLocalData, syncWithCloud]);

  useEffect(() => {
    const handleUpdate = () => {
      setHabits([...globalHabits]);
      setLogs({ ...globalLogs });
      setIsCloudReady(globalIsCloudReady);
    };

    listeners.push(handleUpdate);
    return () => {
      listeners = listeners.filter((l) => l !== handleUpdate);
    };
  }, []);

  // 1. Instant Optimistic Toggle Habit Log (0ms UI latency) + Async Server Action
  const toggleHabit = async (habitId: string, dateStr: string, completed?: boolean, value?: number) => {
    const key = `${habitId}_${dateStr}`;
    const currentLog = globalLogs[key];

    const newCompleted = completed !== undefined ? completed : !currentLog?.completed;
    const habit = globalHabits.find(h => h.id === habitId);
    
    let newValue = value !== undefined 
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

  // 2. Add New Habit (Optimistic + Server Action)
  const addHabit = async (habitData: Omit<Habit, 'id' | 'created_at' | 'order' | 'archived'>) => {
    const newHabit: Habit = {
      ...habitData,
      id: generateId(),
      archived: false,
      order: globalHabits.length,
      created_at: new Date().toISOString(),
    };

    globalHabits = [...globalHabits, newHabit];
    persistLocally(globalHabits, globalLogs);
    emitChange();
    broadcastLocalUpdate();

    saveHabitAction(newHabit).catch((e) => {
      console.error('Background server habit add error:', e);
    });

    return newHabit;
  };

  // 3. Update Existing Habit
  const updateHabit = async (habitId: string, updates: Partial<Habit>) => {
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

  // 4. Delete Habit (Optimistic + Server Action + Cascade Logs cleanup)
  const deleteHabit = async (habitId: string) => {
    // Remove habit from memory
    globalHabits = globalHabits.filter((h) => h.id !== habitId);
    
    // Remove all associated logs
    const newLogs: Record<string, HabitLog> = {};
    Object.entries(globalLogs).forEach(([key, log]) => {
      if (log.habit_id !== habitId) {
        newLogs[key] = log;
      }
    });
    globalLogs = newLogs;

    // Persist to localStorage and notify other open tabs
    persistLocally(globalHabits, globalLogs);
    emitChange();
    broadcastLocalUpdate();

    // Delete on the server cloud database
    try {
      const res = await deleteHabitAction(habitId);
      if (!res.success && res.error) {
        console.error('Server habit delete error:', res.error);
        setSyncError(res.error);
      }
    } catch (e: any) {
      console.error('Background server habit delete error:', e);
      setSyncError(e?.message || 'Failed to delete on server');
    }
  };

  // 5. Reorder Habits
  const reorderHabits = async (orderedHabits: Habit[]) => {
    const updated = orderedHabits.map((h, index) => ({ ...h, order: index }));
    globalHabits = updated;
    persistLocally(globalHabits, globalLogs);
    emitChange();
    broadcastLocalUpdate();

    reorderHabitsAction(updated).catch((e) => {
      console.error('Background server reorder error:', e);
    });
  };

  return {
    habits: habits.filter(h => !h.archived).sort((a, b) => a.order - b.order),
    allHabits: habits,
    logs,
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
  };
}
