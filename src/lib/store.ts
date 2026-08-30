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

const INITIAL_DEFAULT_HABITS: Habit[] = [
  {
    id: 'habit-1',
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
    id: 'habit-2',
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
    id: 'habit-3',
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
    id: 'habit-4',
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
    id: 'habit-5',
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
let listeners: Array<() => void> = [];

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'h_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

export function useHabitStore() {
  const [habits, setHabits] = useState<Habit[]>(globalHabits);
  const [logs, setLogs] = useState<Record<string, HabitLog>>(globalLogs);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const persistLocally = (newHabits: Habit[], newLogs: Record<string, HabitLog>) => {
    try {
      localStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(newHabits));
      localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(newLogs));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  };

  // Sync with Server (Protected Server Action Proxy)
  const syncWithCloud = useCallback(async () => {
    setIsSyncing(true);
    setSyncError(null);

    try {
      const res = await getHabitsAndLogsAction();
      if (!res.success) {
        if (res.error) setSyncError(res.error);
        return;
      }

      if (res.habits && res.habits.length > 0) {
        globalHabits = res.habits;
        setHabits(res.habits);
      } else if (globalHabits.length > 0) {
        // Seed server database with initial habits
        for (const h of globalHabits) {
          await saveHabitAction(h);
        }
      }

      if (res.logs) {
        globalLogs = res.logs;
        setLogs(res.logs);
      }

      persistLocally(globalHabits, globalLogs);
    } catch (err: any) {
      console.warn('Server sync notice:', err?.message || err);
      setSyncError(err?.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
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
  }, [loadLocalData, syncWithCloud]);

  useEffect(() => {
    const handleUpdate = () => {
      setHabits([...globalHabits]);
      setLogs({ ...globalLogs });
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

    if (updatedHabitObj) {
      saveHabitAction(updatedHabitObj).catch((e) => {
        console.error('Background server habit update error:', e);
      });
    }
  };

  // 4. Delete Habit
  const deleteHabit = async (habitId: string) => {
    globalHabits = globalHabits.filter((h) => h.id !== habitId);
    
    const newLogs: Record<string, HabitLog> = {};
    Object.entries(globalLogs).forEach(([key, log]) => {
      if (log.habit_id !== habitId) {
        newLogs[key] = log;
      }
    });
    globalLogs = newLogs;

    persistLocally(globalHabits, globalLogs);
    emitChange();

    deleteHabitAction(habitId).catch((e) => {
      console.error('Background server habit delete error:', e);
    });
  };

  // 5. Reorder Habits
  const reorderHabits = async (orderedHabits: Habit[]) => {
    const updated = orderedHabits.map((h, index) => ({ ...h, order: index }));
    globalHabits = updated;
    persistLocally(globalHabits, globalLogs);
    emitChange();

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
    isCloudReady: true,
    toggleHabit,
    addHabit,
    updateHabit,
    deleteHabit,
    reorderHabits,
    syncWithCloud,
  };
}
