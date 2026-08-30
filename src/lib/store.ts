'use client';

import { useState, useEffect, useCallback } from 'react';
import { Habit, HabitLog } from './types';
import { supabase, isSupabaseConfigured } from './supabase';
import { getTodayDateString } from './utils/date';

const HABITS_STORAGE_KEY = 'zenith_habits_v1';
const LOGS_STORAGE_KEY = 'zenith_logs_v1';
const USER_SETTINGS_KEY = 'zenith_settings_v1';

const INITIAL_DEFAULT_HABITS: Habit[] = [
  {
    id: 'habit-1',
    title: 'Morning Deep Work',
    description: '90 minutes of focused, distraction-free work',
    category: 'productivity',
    color: '#6366F1', // Indigo
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
    color: '#06B6D4', // Cyan
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
    color: '#10B981', // Emerald
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
    color: '#F59E0B', // Amber
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
    color: '#EC4899', // Pink / Rose
    icon: 'Sparkles',
    type: 'boolean',
    target_value: 1,
    frequency: 'daily',
    archived: false,
    order: 4,
    created_at: new Date().toISOString(),
  },
];

export interface StoreState {
  habits: Habit[];
  logs: Record<string, HabitLog>; // Key: `${habit_id}_${date}`
  isLoading: boolean;
  isSyncing: boolean;
  syncError: string | null;
  user: any | null;
  theme: 'dark' | 'light' | 'oled';
}

// Global in-memory cache to prevent re-fetch flicker across components
let globalHabits: Habit[] = [];
let globalLogs: Record<string, HabitLog> = {};
let globalUser: any = null;
let listeners: Array<() => void> = [];

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

// Generate unique ID
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'h_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

export function useHabitStore() {
  const [habits, setHabits] = useState<Habit[]>(globalHabits);
  const [logs, setLogs] = useState<Record<string, HabitLog>>(globalLogs);
  const [user, setUser] = useState<any>(globalUser);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);

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

  // Save to local storage
  const persistLocally = (newHabits: Habit[], newLogs: Record<string, HabitLog>) => {
    try {
      localStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(newHabits));
      localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(newLogs));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  };

  // Sync with Supabase (Cloud Sync)
  const syncWithCloud = useCallback(async (currentUser?: any) => {
    if (!isSupabaseConfigured || !supabase) return;
    const activeUser = currentUser || user;
    if (!activeUser) return;

    setIsSyncing(true);
    setSyncError(null);

    try {
      // 1. Fetch habits from cloud
      const { data: cloudHabits, error: habitsErr } = await supabase
        .from('habits')
        .select('*')
        .order('sort_order', { ascending: true });

      if (habitsErr) throw habitsErr;

      // 2. Fetch logs from cloud (last 365 days)
      const { data: cloudLogs, error: logsErr } = await supabase
        .from('habit_logs')
        .select('*')
        .limit(2000);

      if (logsErr) throw logsErr;

      if (cloudHabits && cloudHabits.length > 0) {
        // Map cloud habits
        const formattedHabits: Habit[] = cloudHabits.map((h: any) => ({
          id: h.id,
          user_id: h.user_id,
          title: h.title,
          description: h.description || '',
          category: h.category,
          color: h.color,
          icon: h.icon,
          type: h.type,
          target_value: Number(h.target_value) || 1,
          target_unit: h.target_unit || '',
          frequency: h.frequency,
          custom_days: h.custom_days || [],
          archived: Boolean(h.archived),
          order: h.sort_order || 0,
          created_at: h.created_at,
          updated_at: h.updated_at,
        }));

        globalHabits = formattedHabits;
        setHabits(formattedHabits);
      }

      if (cloudLogs && cloudLogs.length > 0) {
        const mappedLogs: Record<string, HabitLog> = {};
        cloudLogs.forEach((l: any) => {
          mappedLogs[`${l.habit_id}_${l.date}`] = {
            id: l.id,
            habit_id: l.habit_id,
            date: l.date,
            completed: Boolean(l.completed),
            value: Number(l.value) || 0,
            notes: l.notes || '',
            created_at: l.created_at,
            updated_at: l.updated_at,
          };
        });
        globalLogs = mappedLogs;
        setLogs(mappedLogs);
      }

      persistLocally(globalHabits, globalLogs);
    } catch (err: any) {
      console.warn('Supabase sync warning:', err?.message || err);
      setSyncError(err?.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  }, [user]);

  // Initialize store and auth listener
  useEffect(() => {
    loadLocalData();

    if (isSupabaseConfigured && supabase) {
      // Check current session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          globalUser = session.user;
          setUser(session.user);
          syncWithCloud(session.user);
        }
      });

      // Listen for auth changes
      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        globalUser = session?.user || null;
        setUser(session?.user || null);
        if (session?.user) {
          syncWithCloud(session.user);
        }
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
  }, [loadLocalData, syncWithCloud]);

  // Subscribe to in-memory updates
  useEffect(() => {
    const handleUpdate = () => {
      setHabits([...globalHabits]);
      setLogs({ ...globalLogs });
      setUser(globalUser);
    };

    listeners.push(handleUpdate);
    return () => {
      listeners = listeners.filter((l) => l !== handleUpdate);
    };
  }, []);

  // 1. Instant Optimistic Toggle Habit Log (0ms UI latency)
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

    // Background async sync to Supabase
    if (isSupabaseConfigured && supabase && globalUser) {
      try {
        await supabase.from('habit_logs').upsert({
          habit_id: habitId,
          user_id: globalUser.id,
          date: dateStr,
          completed: newCompleted,
          value: newValue,
          notes: updatedLog.notes,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'habit_id,date' });
      } catch (e) {
        console.error('Background cloud sync error:', e);
      }
    }
  };

  // 2. Add New Habit (Optimistic)
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

    // Background cloud sync
    if (isSupabaseConfigured && supabase && globalUser) {
      try {
        await supabase.from('habits').insert({
          id: newHabit.id,
          user_id: globalUser.id,
          title: newHabit.title,
          description: newHabit.description || '',
          category: newHabit.category,
          color: newHabit.color,
          icon: newHabit.icon,
          type: newHabit.type,
          target_value: newHabit.target_value,
          target_unit: newHabit.target_unit || '',
          frequency: newHabit.frequency,
          custom_days: newHabit.custom_days || [],
          archived: false,
          sort_order: newHabit.order,
        });
      } catch (e) {
        console.error('Cloud add habit error:', e);
      }
    }

    return newHabit;
  };

  // 3. Update Existing Habit (Optimistic)
  const updateHabit = async (habitId: string, updates: Partial<Habit>) => {
    globalHabits = globalHabits.map((h) => 
      h.id === habitId ? { ...h, ...updates, updated_at: new Date().toISOString() } : h
    );
    persistLocally(globalHabits, globalLogs);
    emitChange();

    // Background cloud sync
    if (isSupabaseConfigured && supabase && globalUser) {
      try {
        const updatePayload: any = { ...updates, updated_at: new Date().toISOString() };
        if (updates.order !== undefined) updatePayload.sort_order = updates.order;
        await supabase.from('habits').update(updatePayload).eq('id', habitId);
      } catch (e) {
        console.error('Cloud update habit error:', e);
      }
    }
  };

  // 4. Delete Habit (Optimistic)
  const deleteHabit = async (habitId: string) => {
    globalHabits = globalHabits.filter((h) => h.id !== habitId);
    
    // Also remove logs
    const newLogs: Record<string, HabitLog> = {};
    Object.entries(globalLogs).forEach(([key, log]) => {
      if (log.habit_id !== habitId) {
        newLogs[key] = log;
      }
    });
    globalLogs = newLogs;

    persistLocally(globalHabits, globalLogs);
    emitChange();

    // Background cloud sync
    if (isSupabaseConfigured && supabase && globalUser) {
      try {
        await supabase.from('habits').delete().eq('id', habitId);
      } catch (e) {
        console.error('Cloud delete habit error:', e);
      }
    }
  };

  // 5. Reorder Habits
  const reorderHabits = async (orderedHabits: Habit[]) => {
    const updated = orderedHabits.map((h, index) => ({ ...h, order: index }));
    globalHabits = updated;
    persistLocally(globalHabits, globalLogs);
    emitChange();

    if (isSupabaseConfigured && supabase && globalUser) {
      try {
        for (const h of updated) {
          await supabase.from('habits').update({ sort_order: h.order }).eq('id', h.id);
        }
      } catch (e) {
        console.error('Cloud reorder habits error:', e);
      }
    }
  };

  return {
    habits: habits.filter(h => !h.archived).sort((a, b) => a.order - b.order),
    allHabits: habits,
    logs,
    user,
    isLoading,
    isSyncing,
    syncError,
    isCloudReady: isSupabaseConfigured,
    toggleHabit,
    addHabit,
    updateHabit,
    deleteHabit,
    reorderHabits,
    syncWithCloud,
  };
}
