'use client';

import { useEffect } from 'react';
import { Habit, HabitLog } from '../types';
import { ActiveTab } from '../../components/ViewTabs';
import { getTodayDateString } from '../utils/date';

interface UseAppShortcutsOptions {
  isUnlocked: boolean | null;
  hasOpenModal: boolean;
  displayedDailyHabits: Habit[];
  safeFocusedIndex: number;
  setFocusedIndex: React.Dispatch<React.SetStateAction<number>>;
  logs: Record<string, HabitLog>;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  toggleHabit: (habitId: string, date: string, completed?: boolean, value?: number) => void;
  onOpenAddModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenShortcutsModal: () => void;
  setActiveTab: (tab: ActiveTab) => void;
  isAdmin?: boolean;
}

export function useAppShortcuts({
  isUnlocked,
  hasOpenModal,
  displayedDailyHabits,
  safeFocusedIndex,
  setFocusedIndex,
  logs,
  selectedDate,
  setSelectedDate,
  toggleHabit,
  onOpenAddModal,
  onOpenSettingsModal,
  onOpenShortcutsModal,
  setActiveTab,
  isAdmin = false,
}: UseAppShortcutsOptions) {
  useEffect(() => {
    if (!isUnlocked) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (hasOpenModal) return;

      const key = e.key.toLowerCase();

      // Navigation: j / Down, k / Up
      if (key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(displayedDailyHabits.length - 1, prev + 1));
      } else if (key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(0, prev - 1));
      } 
      // Toggle: Space or x
      else if (e.key === ' ' || key === 'x') {
        e.preventDefault();
        const focusedHabit = displayedDailyHabits[safeFocusedIndex];
        if (focusedHabit) {
          const isDone = Boolean(logs[`${focusedHabit.id}_${selectedDate}`]?.completed);
          toggleHabit(focusedHabit.id, selectedDate, !isDone, !isDone ? focusedHabit.target_value : 0);
        }
      }
      // Stepper: + / =
      else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        const focusedHabit = displayedDailyHabits[safeFocusedIndex];
        if (focusedHabit && focusedHabit.type === 'number') {
          const curVal = logs[`${focusedHabit.id}_${selectedDate}`]?.value ?? 0;
          const step = focusedHabit.target_value >= 1000 ? 250 : focusedHabit.target_value >= 50 ? 10 : 5;
          const nextVal = curVal + step;
          const nextCompleted = nextVal >= focusedHabit.target_value;
          toggleHabit(focusedHabit.id, selectedDate, nextCompleted, nextVal);
        }
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        const focusedHabit = displayedDailyHabits[safeFocusedIndex];
        if (focusedHabit && focusedHabit.type === 'number') {
          const curVal = logs[`${focusedHabit.id}_${selectedDate}`]?.value ?? 0;
          const step = focusedHabit.target_value >= 1000 ? 250 : focusedHabit.target_value >= 50 ? 10 : 5;
          const nextVal = Math.max(0, curVal - step);
          const nextCompleted = nextVal >= focusedHabit.target_value;
          toggleHabit(focusedHabit.id, selectedDate, nextCompleted, nextVal);
        }
      }
      // New Habit: n
      else if (key === 'n') {
        e.preventDefault();
        onOpenAddModal();
      }
      // Settings: s or ,
      else if (key === 's' || key === ',') {
        e.preventDefault();
        onOpenSettingsModal();
      }
      // Jump to Today: t
      else if (key === 't') {
        e.preventDefault();
        setSelectedDate(getTodayDateString());
      }
      // Switch tabs: 1..7
      else if (e.key === '1') {
        e.preventDefault();
        setActiveTab('today');
      } else if (e.key === '2') {
        e.preventDefault();
        setActiveTab('week');
      } else if (e.key === '3') {
        e.preventDefault();
        setActiveTab('planner');
      } else if (e.key === '4') {
        e.preventDefault();
        setActiveTab('projects');
      } else if (e.key === '5') {
        e.preventDefault();
        setActiveTab('heatmap');
      } else if (e.key === '6') {
        e.preventDefault();
        setActiveTab('analytics');
      } else if (e.key === '7' && isAdmin) {
        e.preventDefault();
        setActiveTab('admin');
      }
      // Toggle Shortcuts modal: ?
      else if (e.key === '?') {
        e.preventDefault();
        onOpenShortcutsModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isUnlocked,
    hasOpenModal,
    displayedDailyHabits,
    safeFocusedIndex,
    setFocusedIndex,
    logs,
    selectedDate,
    setSelectedDate,
    toggleHabit,
    onOpenAddModal,
    onOpenSettingsModal,
    onOpenShortcutsModal,
    setActiveTab,
    isAdmin,
  ]);
}
