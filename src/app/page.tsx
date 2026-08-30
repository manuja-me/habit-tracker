'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useHabitStore } from '../lib/store';
import { Habit } from '../lib/types';
import { calculateHabitStats, isDaySuccessful } from '../lib/utils/streaks';
import { getTodayDateString, isHabitDueOnDate } from '../lib/utils/date';
import { triggerDailyCelebration } from '../lib/utils/confetti';
import { playCheckSound, playUncheckSound, playMilestoneSound, isSoundEnabled, setSoundEnabled } from '../lib/utils/sound';
import { checkSessionAction, lockSessionAction } from '../lib/server/auth';
import { Header } from '../components/Header';
import { ViewTabs, ActiveTab } from '../components/ViewTabs';
import { MinimalHabitItem } from '../components/MinimalHabitItem';
import { WeeklyGrid } from '../components/WeeklyGrid';
import { MinimalHeatmap } from '../components/MinimalHeatmap';
import { AnalyticsView } from '../components/AnalyticsView';
import { HabitModal } from '../components/HabitModal';
import { SyncSettingsModal } from '../components/SyncSettingsModal';
import { ShortcutsModal } from '../components/ShortcutsModal';
import { ShareStreakModal } from '../components/ShareStreakModal';
import { NotificationModal } from '../components/NotificationModal';
import { PinLockScreen } from '../components/PinLockScreen';
import { LoadingScreen } from '../components/LoadingScreen';
import { Plus, Sparkles, ShieldOff } from 'lucide-react';

export default function HabitTrackerPage() {
  const [isUnlocked, setIsUnlocked] = useState<boolean | null>(null);

  const {
    habits,
    logs,
    isLoading,
    toggleHabit,
    addHabit,
    updateHabit,
    deleteHabit,
    reorderHabits,
    syncWithCloud,
  } = useHabitStore();

  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [activeTab, setActiveTab] = useState<ActiveTab>('today');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [isHabitModalOpen, setIsHabitModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);

  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [draggedHabitId, setDraggedHabitId] = useState<string | null>(null);
  const [modalInitialNature, setModalInitialNature] = useState<'do' | 'dont'>('do');

  const prevCompletionRef = useRef<boolean>(false);

  // Validate server HttpOnly session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticated = await checkSessionAction();
        setIsUnlocked(authenticated);
        if (authenticated) {
          syncWithCloud();
        }
      } catch (err) {
        setIsUnlocked(false);
      }
    };

    checkAuth();
  }, [syncWithCloud]);

  const handleUnlockSuccess = () => {
    setIsUnlocked(true);
    syncWithCloud();
  };

  const handleLockApp = async () => {
    await lockSessionAction();
    setIsUnlocked(false);
  };

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
      return isDaySuccessful(h, selectedDate, logs);
    }).length;
    return { completedCount: completed, totalCount: total };
  }, [dueHabits, logs, selectedDate]);

  useEffect(() => {
    const isAllDone = totalCount > 0 && completedCount === totalCount;
    if (isAllDone && !prevCompletionRef.current) {
      triggerDailyCelebration();
      playMilestoneSound();
    }
    prevCompletionRef.current = isAllDone;
  }, [completedCount, totalCount]);

  const displayedDailyHabits = useMemo(() => {
    return dueHabits.filter((h) => {
      if (filterCategory === 'all') return true;
      if (filterCategory === 'completed') {
        return isDaySuccessful(h, selectedDate, logs);
      }
      if (filterCategory === 'pending') {
        return !isDaySuccessful(h, selectedDate, logs);
      }
      return h.category === filterCategory;
    });
  }, [dueHabits, filterCategory, logs, selectedDate]);

  const doHabits = useMemo(() => {
    return displayedDailyHabits.filter((h) => h.nature !== 'dont');
  }, [displayedDailyHabits]);

  const dontHabits = useMemo(() => {
    return displayedDailyHabits.filter((h) => h.nature === 'dont');
  }, [displayedDailyHabits]);

  // Keep focusedIndex clamped within range
  useEffect(() => {
    if (focusedIndex >= displayedDailyHabits.length) {
      setFocusedIndex(Math.max(0, displayedDailyHabits.length - 1));
    }
  }, [displayedDailyHabits.length, focusedIndex]);

  // Keyboard Shortcuts (Vim / IDE style)
  useEffect(() => {
    if (!isUnlocked) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if typing inside an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Don't trigger if modals are open (except closing them with Esc)
      const hasOpenModal = isHabitModalOpen || isSyncModalOpen || isShortcutsModalOpen || isShareModalOpen || isNotificationModalOpen;
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
        const focusedHabit = displayedDailyHabits[focusedIndex];
        if (focusedHabit) {
          const isDone = Boolean(logs[`${focusedHabit.id}_${selectedDate}`]?.completed);
          if (!isDone) playCheckSound();
          else playUncheckSound();
          toggleHabit(focusedHabit.id, selectedDate, !isDone, !isDone ? focusedHabit.target_value : 0);
        }
      }
      // Stepper: + / -
      else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        const focusedHabit = displayedDailyHabits[focusedIndex];
        if (focusedHabit && focusedHabit.type === 'number') {
          const curVal = logs[`${focusedHabit.id}_${selectedDate}`]?.value ?? 0;
          const step = focusedHabit.target_value >= 1000 ? 250 : focusedHabit.target_value >= 50 ? 10 : 5;
          const nextVal = curVal + step;
          const nextCompleted = nextVal >= focusedHabit.target_value;
          if (nextCompleted && curVal < focusedHabit.target_value) playCheckSound();
          toggleHabit(focusedHabit.id, selectedDate, nextCompleted, nextVal);
        }
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        const focusedHabit = displayedDailyHabits[focusedIndex];
        if (focusedHabit && focusedHabit.type === 'number') {
          const curVal = logs[`${focusedHabit.id}_${selectedDate}`]?.value ?? 0;
          const step = focusedHabit.target_value >= 1000 ? 250 : focusedHabit.target_value >= 50 ? 10 : 5;
          const nextVal = Math.max(0, curVal - step);
          const nextCompleted = nextVal >= focusedHabit.target_value;
          if (!nextCompleted && curVal >= focusedHabit.target_value) playUncheckSound();
          toggleHabit(focusedHabit.id, selectedDate, nextCompleted, nextVal);
        }
      }
      // New Habit: n
      else if (key === 'n') {
        e.preventDefault();
        handleOpenAddModal();
      }
      // Jump to Today: t
      else if (key === 't') {
        e.preventDefault();
        setSelectedDate(getTodayDateString());
      }
      // Switch tabs: 1, 2, 3, 4
      else if (e.key === '1') {
        e.preventDefault();
        setActiveTab('today');
      } else if (e.key === '2') {
        e.preventDefault();
        setActiveTab('week');
      } else if (e.key === '3') {
        e.preventDefault();
        setActiveTab('heatmap');
      } else if (e.key === '4') {
        e.preventDefault();
        setActiveTab('analytics');
      }
      // Toggle Shortcuts modal: ?
      else if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsModalOpen(true);
      }
      // Toggle sound: m
      else if (key === 'm') {
        e.preventDefault();
        const current = isSoundEnabled();
        setSoundEnabled(!current);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isUnlocked,
    displayedDailyHabits,
    focusedIndex,
    logs,
    selectedDate,
    toggleHabit,
    isHabitModalOpen,
    isSyncModalOpen,
    isShortcutsModalOpen,
    isShareModalOpen,
    isNotificationModalOpen
  ]);

  // Drag & Drop Reordering handlers
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
      reorderHabits(updated);
    }
    setDraggedHabitId(null);
  };

  const handleOpenAddModal = (nature: 'do' | 'dont' = 'do') => {
    setEditingHabit(null);
    setModalInitialNature(nature);
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

  if (isUnlocked === null) {
    return (
      <LoadingScreen
        message="VALIDATING SECURE SESSION..."
        statusText="ZENITH // AUTH GATE"
      />
    );
  }

  if (!isUnlocked) {
    return <PinLockScreen onUnlock={handleUnlockSuccess} />;
  }

  if (isLoading) {
    return (
      <LoadingScreen
        message="LOADING HABIT VAULT..."
        statusText="ZENITH // ENGINE BOOT"
      />
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
        onOpenShortcutsModal={() => setIsShortcutsModalOpen(true)}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        onOpenNotificationModal={() => setIsNotificationModalOpen(true)}
        onLockApp={handleLockApp}
        completedCount={completedCount}
        totalCount={totalCount}
      />

      {/* Navigation Tabs */}
      <ViewTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main View Content */}
      <main className="w-full">
        {activeTab === 'today' && (
          <div className="w-full max-w-4xl mx-auto px-3.5 sm:px-6 space-y-3 sm:space-y-4">
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
                    className={`px-2.5 sm:px-3 py-1 rounded-none text-xs font-mono font-medium transition-all cursor-pointer touch-manipulation select-none ${
                      filterCategory === f.id
                        ? 'bg-card text-main font-bold border border-main shadow-xs'
                        : 'text-sub hover:text-main hover:bg-subtle/50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <span className="text-[11px] sm:text-xs text-sub font-mono flex-shrink-0">
                {displayedDailyHabits.length} HABITS
              </span>
            </div>

            {/* Habit Lists: DO Routines and DONT Routines with Divider */}
            {displayedDailyHabits.length === 0 ? (
              <div className="p-8 sm:p-12 text-center rounded-none bg-card border border-main transition-colors">
                <div className="w-10 h-10 rounded-none bg-subtle text-emerald-500 border border-subtle flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold font-mono uppercase text-main mb-1">
                  {filterCategory === 'completed'
                    ? 'No habits completed yet today'
                    : filterCategory === 'pending'
                    ? 'All clear! Everything is completed.'
                    : 'No habits scheduled for today'}
                </h3>
                <p className="text-[11px] sm:text-xs font-mono text-sub max-w-sm mx-auto mb-6">
                  {filterCategory === 'all'
                    ? 'Start building your daily routines or tracking addictions to quit.'
                    : 'Consistency maintained.'}
                </p>
                {filterCategory === 'all' && (
                  <button
                    onClick={() => handleOpenAddModal('do')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-none text-xs font-mono font-bold bg-emerald-500 hover:bg-emerald-400 text-black border border-emerald-400 active:scale-95 transition-all cursor-pointer touch-manipulation"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>ADD ROUTINE</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                {/* 1. DO ROUTINES (BUILD) */}
                {doHabits.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-bold font-mono text-emerald-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3" /> DO ROUTINES ({doHabits.length})
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 sm:gap-2">
                      {doHabits.map((habit) => {
                        const globalIdx = displayedDailyHabits.findIndex((h) => h.id === habit.id);
                        return (
                          <MinimalHabitItem
                            key={habit.id}
                            habit={habit}
                            log={logs[`${habit.id}_${selectedDate}`]}
                            allLogs={logs}
                            stats={statsMap[habit.id] || {
                              currentStreak: 0,
                              longestStreak: 0,
                              totalCompletions: 0,
                              completionRate30Days: 0,
                              isCompletedToday: false,
                              todayValue: 0,
                            }}
                            dateStr={selectedDate}
                            isFocused={globalIdx === focusedIndex}
                            isDraggable={true}
                            onToggle={toggleHabit}
                            onEdit={handleEditHabit}
                            onDelete={deleteHabit}
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

                {/* 2. DIVIDER & DON'T ROUTINES (QUIT & BREAK ADDICTIONS) */}
                <div className="pt-3 border-t border-subtle space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap px-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center justify-center">
                        <ShieldOff className="w-2.5 h-2.5" />
                      </div>
                      <span className="text-[11px] font-bold font-mono text-rose-400 uppercase tracking-wider">
                        DON'T ROUTINES — QUIT & BREAK ADDICTIONS ({dontHabits.length})
                      </span>
                    </div>
                    <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2">
                      AUTO-CLEAN DAILY (ONLY LOG SLIP-UPS)
                    </span>
                  </div>

                  {dontHabits.length === 0 ? (
                    <div className="p-4 rounded-none bg-card/60 border border-dashed border-subtle text-center space-y-2">
                      <p className="text-[11px] font-mono text-sub">
                        No addictions or habits to stop tracked yet.
                      </p>
                      <button
                        onClick={() => handleOpenAddModal('dont')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono font-bold bg-input hover:bg-rose-500/10 hover:border-rose-500/40 border border-main text-rose-400 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>TRACK ADDICTION / QUIT HABIT</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5 sm:gap-2">
                      {dontHabits.map((habit) => {
                        const globalIdx = displayedDailyHabits.findIndex((h) => h.id === habit.id);
                        return (
                          <MinimalHabitItem
                            key={habit.id}
                            habit={habit}
                            log={logs[`${habit.id}_${selectedDate}`]}
                            allLogs={logs}
                            stats={statsMap[habit.id] || {
                              currentStreak: 0,
                              longestStreak: 0,
                              totalCompletions: 0,
                              completionRate30Days: 0,
                              isCompletedToday: false,
                              todayValue: 0,
                            }}
                            dateStr={selectedDate}
                            isFocused={globalIdx === focusedIndex}
                            isDraggable={true}
                            onToggle={toggleHabit}
                            onEdit={handleEditHabit}
                            onDelete={deleteHabit}
                            onDragStart={() => handleDragStart(habit.id)}
                            onDragOver={handleDragOver}
                            onDrop={() => handleDrop(habit.id)}
                            onDragEnd={() => setDraggedHabitId(null)}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
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
        initialNature={modalInitialNature}
      />

      {/* Sync Status Modal */}
      <SyncSettingsModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
      />

      {/* Keyboard Shortcuts Modal */}
      <ShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* Share Streak & Stats Modal */}
      <ShareStreakModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        habits={habits}
        logs={logs}
      />

      {/* Daily Reminder Notification Modal */}
      <NotificationModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
      />
    </div>
  );
}
