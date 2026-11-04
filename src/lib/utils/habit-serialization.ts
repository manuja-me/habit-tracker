import type { Habit } from '../types';

export function parseHabitDescription(rawDesc?: string | null): {
  cleanDescription: string;
  isDont: boolean;
  weaningConfig?: Habit['weaning'];
  replacement_habit_id?: string;
} {
  const desc = rawDesc || '';
  const isDont = desc.includes('[NATURE:DONT]');
  let weaningConfig: Habit['weaning'] = undefined;
  const weaningMatch = desc.match(/\[WEANING:(.*?)\]/);
  if (weaningMatch && weaningMatch[1]) {
    try {
      weaningConfig = JSON.parse(weaningMatch[1]);
    } catch {}
  }
  let replacement_habit_id: string | undefined = undefined;
  const replaceMatch = desc.match(/\[REPLACE:(.*?)\]/);
  if (replaceMatch && replaceMatch[1]) {
    replacement_habit_id = replaceMatch[1].trim();
  }
  const cleanDescription = desc
    .replace(/\s*\[NATURE:DONT\]/g, '')
    .replace(/\s*\[WEANING:.*?\]/g, '')
    .replace(/\s*\[REPLACE:.*?\]/g, '')
    .trim();

  return { cleanDescription, isDont, weaningConfig, replacement_habit_id };
}

export function serializeHabitDescription(habit: Habit): string {
  const rawDesc = habit.description || '';
  let storedDesc = rawDesc
    .replace(/\s*\[NATURE:DONT\]/g, '')
    .replace(/\s*\[WEANING:.*?\]/g, '')
    .replace(/\s*\[REPLACE:.*?\]/g, '')
    .trim();

  if (habit.nature === 'dont') {
    storedDesc = storedDesc ? `${storedDesc} [NATURE:DONT]` : '[NATURE:DONT]';
    if (habit.weaning?.enabled) {
      storedDesc += ` [WEANING:${JSON.stringify(habit.weaning)}]`;
    }
    if (habit.replacement_habit_id) {
      storedDesc += ` [REPLACE:${habit.replacement_habit_id.trim()}]`;
    }
  }
  return storedDesc;
}
