import type { Habit, HabitLog } from '../types';

export function isHabitChecked(habit: Habit, log?: HabitLog) {
  if (habit.nature !== 'dont') return Boolean(log?.completed);
  return log?.completed !== false && (habit.type !== 'number' || (log?.value ?? 0) <= habit.target_value);
}

export function getToggledLog(habit: Habit, log?: HabitLog) {
  const completed = !isHabitChecked(habit, log);
  if (habit.nature !== 'dont') return { completed, value: completed ? habit.target_value : 0 };
  if (habit.type !== 'number') return { completed, value: completed ? 0 : 1 };
  const current = log?.value ?? 0;
  const value = completed ? Math.min(current, habit.target_value) : Math.max(current, habit.target_value + 1);
  return { completed, value };
}

export function getHabitStep(habit: Habit) {
  return habit.target_value >= 1000 ? 250 : habit.target_value >= 50 ? 10 : habit.target_value >= 20 ? 5 : 1;
}

export function getSteppedLog(habit: Habit, log: HabitLog | undefined, amount: number) {
  const current = log?.value ?? (habit.nature !== 'dont' && log?.completed ? habit.target_value : 0);
  const value = Math.max(0, current + amount);
  return { value, completed: habit.nature === 'dont' ? value <= habit.target_value : value >= habit.target_value };
}
