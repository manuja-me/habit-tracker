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
import { SyncSettingsModal } from '../components/SyncSettingsModal';
import { Plus, Sparkles } from 'lucide-react';

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
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  const prevCompletionRef = useRef<boolean>(false);

  const dueHabits = useMemo(() => {
    return habits.filter((h) => isHabitDueOnDate(h, selectedDate));
  }, [habits, selectedDate]);

  const statsMap = useMemo(() => {
    const map: Record<string, ReturnType<typeof calculateHabitStats>> = {};
    habits.forEach((h) => {
      map[h.id] = calculateHabitStats(h, logs);
    });
    return map;
  }, [habits, logs]);

  const { completedCount, totalCount } = useMemo(() => {
    const total = dueHabits.length;
    const completed = dueHabits.filter((h) => {
      const log = logs[`${h.id}_${selectedDate}`];
      return Boolean(log?.completed);
    }).length;
    return { completedCount: completed, totalCount: total };
  }, [dueHabits, logs, selectedDate]);

  useEffect(() => {
    const isAllDone = totalCount > 0 && completedCount === totalCount;
    if (isAllDone && !prevCompletionRef.current) {
      triggerDailyCelebration();
    }
    prevCompletionRef.current = isAllDone;
  }, [completedCount, totalCount]);

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
      <div className="min-h-screen bg-main flex items-center justify-center font-mono">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent animate-spin" />
          <span className="text-xs font-mono text-sub">LOADING ZENITH...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-main text-main pb-20 selection:bg-emerald-500/30 selection:text-emerald-500 transition-colors font-mono">
      {/* Top Header */}
      <Header
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        onOpenAddModal={handleOpenAddModal}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
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
              <div className="flex items-center gap-1">
                {[
                  { id: 'all', label: 'ALL' },
                  { id: 'pending', label: 'TO DO' },
                  { id: 'completed', label: 'DONE' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilterCategory(f.id)}
                    className={`px-3 py-1 rounded-none text-xs font-mono font-medium transition-all cursor-pointer ${
                      filterCategory === f.id
                        ? 'bg-card text-main font-bold border border-main'
                        : 'text-sub hover:text-main hover:bg-subtle/50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <span className="text-xs text-sub font-mono">
                {displayedDailyHabits.length} HABITS
              </span>
            </div>

            {/* Habit List */}
            {displayedDailyHabits.length === 0 ? (
              <div className="p-12 text-center rounded-none bg-card border border-main transition-colors">
                <div className="w-10 h-10 rounded-none bg-subtle text-emerald-500 border border-subtle flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold font-mono uppercase text-main mb-1">
                  {filterCategory === 'completed'
                    ? 'No habits completed yet today'
                    : filterCategory === 'pending'
                    ? 'All clear! Everything is completed.'
                    : 'No habits scheduled for today'}
                </h3>
                <p className="text-xs font-mono text-sub max-w-sm mx-auto mb-6">
                  {filterCategory === 'all'
                    ? 'Start building your daily routines by creating your first custom habit.'
                    : 'Consistency maintained.'}
                </p>
                {filterCategory === 'all' && (
                  <button
                    onClick={handleOpenAddModal}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-none text-xs font-mono font-bold bg-emerald-500 hover:bg-emerald-400 text-black border border-emerald-400 active:scale-95 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>ADD HABIT</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
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

      {/* Sync Status Modal */}
      <SyncSettingsModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
      />
    </div>
  );
}
