'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Habit, HabitLog } from '../lib/types';
import { calculateHabitStats } from '../lib/utils/streaks';
import { MinimalHabitItem } from './MinimalHabitItem';

interface DailyHabitsListProps {
  habits: Habit[];
  displayedDailyHabits: Habit[];
  doHabits: Habit[];
  dontHabits: Habit[];
  filterCategory: string;
  onSelectFilterCategory: (category: string) => void;
  logs: Record<string, HabitLog>;
  statsMap: Record<string, ReturnType<typeof calculateHabitStats>>;
  selectedDate: string;
  safeFocusedIndex: number;
  onToggleHabit: (habitId: string, date: string, completed?: boolean, value?: number) => void;
  onEditHabit: (habit: Habit) => void;
  onDeleteHabit: (habitId: string) => void;
  onReorderHabits: (habits: Habit[]) => void;
  onOpenAddModal: (nature?: 'do' | 'dont') => void;
}

export function DailyHabitsList({
  habits,
  displayedDailyHabits,
  doHabits,
  dontHabits,
  filterCategory,
  onSelectFilterCategory,
  logs,
  statsMap,
  selectedDate,
  safeFocusedIndex,
  onToggleHabit,
  onEditHabit,
  onDeleteHabit,
  onReorderHabits,
  onOpenAddModal,
}: DailyHabitsListProps) {
  const [draggedHabitId, setDraggedHabitId] = useState<string | null>(null);

  const handleDragStart = (habitId: string) => {
    setDraggedHabitId(habitId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetHabitId: string) => {
    if (!draggedHabitId || draggedHabitId === targetHabitId) return;

    const updated = [...habits];
    const fromIndex = updated.findIndex((h) => h.id === draggedHabitId);
    const toIndex = updated.findIndex((h) => h.id === targetHabitId);

    if (fromIndex !== -1 && toIndex !== -1) {
      const [movedItem] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, movedItem);
      onReorderHabits(updated);
    }
    setDraggedHabitId(null);
  };

  return (
    <div className="xl:col-span-7 space-y-4">
      {/* Filter pills & count */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center bg-card p-0.5 border border-main">
          {[
            { id: 'all', label: 'All' },
            { id: 'pending', label: 'Pending' },
            { id: 'completed', label: 'Completed' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => onSelectFilterCategory(f.id)}
              className={`h-7 px-3 text-xs font-sans font-bold uppercase tracking-tight transition-colors cursor-pointer select-none ${
                filterCategory === f.id
                  ? 'bg-subtle text-main border-b-2 border-b-[#FF3B30]'
                  : 'text-sub hover:text-main'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <span className="text-xs font-mono text-sub">
          {displayedDailyHabits.length} {displayedDailyHabits.length === 1 ? 'habit' : 'habits'}
        </span>
      </div>

      {/* Habit Lists */}
      {displayedDailyHabits.length === 0 ? (
        <div className="p-8 sm:p-12 text-center bg-card border border-main">
          <h3 className="text-sm sm:text-base font-bold font-sans uppercase tracking-tight text-main mb-1">
            {filterCategory === 'completed'
              ? 'No habits completed yet today'
              : filterCategory === 'pending'
              ? 'All clear! No pending habits'
              : 'No habits scheduled for today'}
          </h3>
          <p className="text-xs font-mono text-sub max-w-sm mx-auto mb-5">
            {filterCategory === 'all'
              ? 'Create daily routines to track your consistency.'
              : 'Great job staying on track.'}
          </p>
          {filterCategory === 'all' && (
            <button
              onClick={() => onOpenAddModal('do')}
              className="inline-flex items-center gap-1.5 h-8 px-4 text-xs font-sans font-black uppercase tracking-tight bg-[#FF3B30] hover:bg-[#E02D24] text-white transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Add Habit</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {/* 1. Daily Habits (Do) */}
          {doHabits.length > 0 && (
            <div className="space-y-2.5">
              {dontHabits.length > 0 && (
                <div className="flex items-center justify-between pb-1 text-xs font-mono text-sub uppercase">
                  <span>Daily Habits ({doHabits.length})</span>
                </div>
              )}
              <div className="grid grid-cols-1 gap-2.5">
                {doHabits.map((habit) => {
                  const globalIdx = displayedDailyHabits.findIndex((h) => h.id === habit.id);
                  return (
                    <MinimalHabitItem
                      key={habit.id}
                      habit={habit}
                      log={logs[`${habit.id}_${selectedDate}`]}
                      allLogs={logs}
                      stats={
                        statsMap[habit.id] || {
                          currentStreak: 0,
                          longestStreak: 0,
                          totalCompletions: 0,
                          completionRate30Days: 0,
                          isCompletedToday: false,
                          todayValue: 0,
                        }
                      }
                      dateStr={selectedDate}
                      isFocused={globalIdx === safeFocusedIndex}
                      isDraggable={true}
                      onToggle={onToggleHabit}
                      onEdit={onEditHabit}
                      onDelete={onDeleteHabit}
                      onDragStart={() => handleDragStart(habit.id)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(habit.id)}
                      onDragEnd={() => setDraggedHabitId(null)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Habits to Break (Don't) */}
          {dontHabits.length > 0 && (
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between pb-1 text-xs font-mono text-[#FF3B30] uppercase">
                <span>Habits to Break ({dontHabits.length})</span>
              </div>
              <div className="grid grid-cols-1 gap-2.5">
                {dontHabits.map((habit) => {
                  const globalIdx = displayedDailyHabits.findIndex((h) => h.id === habit.id);
                  return (
                    <MinimalHabitItem
                      key={habit.id}
                      habit={habit}
                      log={logs[`${habit.id}_${selectedDate}`]}
                      allLogs={logs}
                      stats={
                        statsMap[habit.id] || {
                          currentStreak: 0,
                          longestStreak: 0,
                          totalCompletions: 0,
                          completionRate30Days: 0,
                          isCompletedToday: false,
                          todayValue: 0,
                        }
                      }
                      dateStr={selectedDate}
                      isFocused={globalIdx === safeFocusedIndex}
                      isDraggable={true}
                      onToggle={onToggleHabit}
                      onEdit={onEditHabit}
                      onDelete={onDeleteHabit}
                      onDragStart={() => handleDragStart(habit.id)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(habit.id)}
                      onDragEnd={() => setDraggedHabitId(null)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
