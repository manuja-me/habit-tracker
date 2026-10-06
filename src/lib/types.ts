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

export type HabitNature = 'do' | 'dont';

export interface WeaningConfig {
  enabled: boolean;
  protocol: 'exponential' | 'linear' | 'rapid' | 'custom' | 'none';
  customIntervals?: number[];
}

export interface Habit {
  id: string;
  title: string;
  description?: string;
  category: HabitCategory;
  color: string;
  icon: string;
  type: HabitType;
  nature?: HabitNature; // 'do' for build habits, 'dont' for quit/addiction habits
  weaning?: WeaningConfig; // addiction tapering / spaced interval configuration
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

export interface DayNote {
  date: string; // YYYY-MM-DD
  content: string;
  updated_at: string;
}

export type ProjectStatus = 'active' | 'planned';

export interface ProjectTask {
  id: string;
  title: string;
  done: boolean;
}

export interface Project {
  id: string;
  title: string;
  notes: string;
  status: ProjectStatus;
  tasks: ProjectTask[];
  order: number;
  created_at: string;
}
