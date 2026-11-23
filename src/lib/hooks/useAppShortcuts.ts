'use client';

import { useEffect } from 'react';
import type { Habit, HabitLog } from '../types';
import type { ActiveTab } from '../../components/ViewTabs';
import { getTodayDateString } from '../utils/date';
import { getHabitStep, getSteppedLog, getToggledLog } from '../utils/habit-input';

interface UseAppShortcutsOptions {
  activeTab: ActiveTab;
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
  activeTab,
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
      if (hasOpenModal || e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target;
      if (target instanceof Element && (
        target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') ||
        (e.key === ' ' && target.closest('button, a[href], [role="button"]'))
      )) return;
      if (document.querySelector('[aria-modal="true"]')) return;

      const key = e.key.toLowerCase();
      const habit = activeTab === 'today' ? displayedDailyHabits[safeFocusedIndex] : undefined;
      if (habit && (key === 'j' || key === 'arrowdown' || key === 'k' || key === 'arrowup')) {
        e.preventDefault();
        const delta = key === 'j' || key === 'arrowdown' ? 1 : -1;
        setFocusedIndex(Math.max(0, Math.min(displayedDailyHabits.length - 1, safeFocusedIndex + delta)));
      } else if (habit && (key === ' ' || key === 'x')) {
        e.preventDefault();
        const next = getToggledLog(habit, logs[`${habit.id}_${selectedDate}`]);
        toggleHabit(habit.id, selectedDate, next.completed, next.value);
      } else if (habit?.type === 'number' && ['+', '=', '-', '_'].includes(key)) {
        e.preventDefault();
        const step = getHabitStep(habit);
        const amount = key === '+' || key === '=' ? step : -step;
        const next = getSteppedLog(habit, logs[`${habit.id}_${selectedDate}`], amount);
        toggleHabit(habit.id, selectedDate, next.completed, next.value);
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
    activeTab,
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
