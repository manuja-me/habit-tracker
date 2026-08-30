'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useHabitStore } from '../lib/store';
import { Habit } from '../lib/types';
import { calculateHabitStats } from '../lib/utils/streaks';
import { getTodayDateString, isHabitDueOnDate } from '../lib/utils/date';
import { triggerDailyCelebration } from '../lib/utils/confetti';
import { Header } from '../components/Header';
import { ViewTabs, ActiveTab } from '../components/ViewTabs';
import { MinimalHabitItem } from '../components/MinimalHabitItem';
import { WeeklyGrid } from '../components/WeeklyGrid';
import { MinimalHeatmap } from '../components/MinimalHeatmap';
import { AnalyticsView } from '../components/AnalyticsView';
import { HabitModal } from '../components/HabitModal';
import { AuthModal } from '../components/AuthModal';
import { Plus, Sparkles, Filter, CheckCircle2, ListFilter } from 'lucide-react';

export default function HabitTrackerPage() {
  const {
    habits,
    logs,
    isLoading,
    toggleHabit,
    addHabit,
    updateHabit,
    deleteHabit,
  } = useHabitStore();

  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [activeTab, setActiveTab] = useState<ActiveTab>('today');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [isHabitModalOpen, setIsHabitModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Track previous completion state to trigger confetti only on completion milestone
  const prevCompletionRef = useRef<boolean>(false);

  // Filter habits due on selectedDate
  const dueHabits = useMemo(() => {
    return habits.filter((h) => isHabitDueOnDate(h, selectedDate));
  }, [habits, selectedDate]);

  // Compute habit stats map
  const statsMap = useMemo(() => {
    const map: Record<string, ReturnType<typeof calculateHabitStats>> = {};
    habits.forEach((h) => {
      map[h.id] = calculateHabitStats(h, logs);
    });
    return map;
  }, [habits, logs]);

  // Count completions on selectedDate
  const { completedCount, totalCount } = useMemo(() => {
    const total = dueHabits.length;
    const completed = dueHabits.filter((h) => {
      const log = logs[`${h.id}_${selectedDate}`];
      return Boolean(log?.completed);
    }).length;
    return { completedCount: completed, totalCount: total };
  }, [dueHabits, logs, selectedDate]);

  // Trigger confetti when 100% is reached
  useEffect(() => {
    const isAllDone = totalCount > 0 && completedCount === totalCount;
    if (isAllDone && !prevCompletionRef.current) {
      triggerDailyCelebration();
    }
    prevCompletionRef.current = isAllDone;
  }, [completedCount, totalCount]);

  // Filtered habits for the daily list view
  const displayedDailyHabits = useMemo(() => {
    return dueHabits.filter((h) => {
      if (filterCategory === 'all') return true;
      if (filterCategory === 'completed') {
        return Boolean(logs[`${h.id}_${selectedDate}`]?.completed);
      }
      if (filterCategory === 'pending') {
        return !logs[`${h.id}_${selectedDate}`]?.completed;
      }
      return h.category === filterCategory;
    });
  }, [dueHabits, filterCategory, logs, selectedDate]);

  const handleOpenAddModal = () => {
    setEditingHabit(null);
    setIsHabitModalOpen(true);
  };

  const handleEditHabit = (habit: Habit) => {
    setEditingHabit(habit);
    setIsHabitModalOpen(true);
  };

  const handleSaveHabit = (data: any) => {
    if (editingHabit) {
      updateHabit(editingHabit.id, data);
    } else {
      addHabit(data);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#090A0F] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          <span className="text-xs font-mono text-neutral-400">Loading Zenith...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] pb-20 selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Top Header */}
      <Header
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        onOpenAddModal={handleOpenAddModal}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        completedCount={completedCount}
        totalCount={totalCount}
      />

      {/* Navigation Tabs */}
      <ViewTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main View Content */}
      <main className="w-full">
        {activeTab === 'today' && (
          <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 space-y-4">
            {/* Filter pills */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 text-xs">
              <div className="flex items-center gap-1.5">
                {[
                  { id: 'all', label: 'All Habits' },
                  { id: 'pending', label: 'To Do' },
                  { id: 'completed', label: 'Completed' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilterCategory(f.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      filterCategory === f.id
                        ? 'bg-neutral-800 text-white font-semibold border border-neutral-700'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <span className="text-xs text-neutral-500 font-mono">
                {displayedDailyHabits.length} items
              </span>
            </div>

            {/* Habit List */}
            {displayedDailyHabits.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-neutral-900/40 border border-neutral-800/60 backdrop-blur-md">
                <div className="w-12 h-12 rounded-2xl bg-neutral-800/60 text-neutral-400 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">
                  {filterCategory === 'completed'
                    ? 'No habits completed yet today'
                    : filterCategory === 'pending'
                    ? 'All clear! Everything is completed.'
                    : 'No habits scheduled for today'}
                </h3>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto mb-6">
                  {filterCategory === 'all'
                    ? 'Start building your daily routines by creating your first custom habit.'
                    : 'Great job maintaining your consistency!'}
                </p>
                {filterCategory === 'all' && (
                  <button
                    onClick={handleOpenAddModal}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add a Habit</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {displayedDailyHabits.map((habit) => (
                  <MinimalHabitItem
                    key={habit.id}
                    habit={habit}
                    log={logs[`${habit.id}_${selectedDate}`]}
                    stats={statsMap[habit.id] || {
                      currentStreak: 0,
                      longestStreak: 0,
                      totalCompletions: 0,
                      completionRate30Days: 0,
                      isCompletedToday: false,
                      todayValue: 0,
                    }}
                    dateStr={selectedDate}
                    onToggle={toggleHabit}
                    onEdit={handleEditHabit}
                    onDelete={deleteHabit}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'week' && (
          <WeeklyGrid
            habits={habits}
            logs={logs}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onToggle={toggleHabit}
          />
        )}

        {activeTab === 'heatmap' && (
          <MinimalHeatmap habits={habits} logs={logs} />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView habits={habits} logs={logs} />
        )}
      </main>

      {/* Habit Create / Edit Modal */}
      <HabitModal
        isOpen={isHabitModalOpen}
        onClose={() => setIsHabitModalOpen(false)}
        onSave={handleSaveHabit}
        editingHabit={editingHabit}
      />

      {/* Auth & Sync Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}
