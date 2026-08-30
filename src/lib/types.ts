export type HabitCategory = 
  | 'productivity' 
  | 'health' 
  | 'fitness' 
  | 'mindfulness' 
  | 'learning' 
  | 'finance' 
  | 'lifestyle';

export type HabitFrequency = 'daily' | 'weekdays' | 'weekends' | 'custom';

export type HabitType = 'boolean' | 'number';

export interface Habit {
  id: string;
  user_id?: string;
  title: string;
  description?: string;
  category: HabitCategory;
  color: string;
  icon: string;
  type: HabitType;
  target_value: number;
  target_unit?: string;
  frequency: HabitFrequency;
  custom_days?: number[]; // [0, 1, 2, 3, 4, 5, 6] where 0=Sun, 1=Mon...
  archived: boolean;
  order: number;
  created_at: string;
  updated_at?: string;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  date: string; // YYYY-MM-DD format
  completed: boolean;
  value: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface HabitStats {
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  completionRate30Days: number;
  isCompletedToday: boolean;
  todayValue: number;
}

export interface DailySummary {
  date: string;
  totalHabits: number;
  completedHabits: number;
  completionPercentage: number;
}

export interface HeatmapDay {
  date: string;
  count: number;
  total: number;
  level: 0 | 1 | 2 | 3 | 4;
  completedHabits: string[];
}
