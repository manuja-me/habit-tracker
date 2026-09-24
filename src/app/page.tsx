'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
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
import { DailyPlanner } from '../components/DailyPlanner';
import { HabitModal } from '../components/HabitModal';
import { SettingsModal } from '../components/SettingsModal';
import { ShortcutsModal } from '../components/ShortcutsModal';
import { ShareStreakModal } from '../components/ShareStreakModal';
import { NotificationModal } from '../components/NotificationModal';
import { InviteFriendModal } from '../components/InviteFriendModal';
import { PinLockScreen } from '../components/PinLockScreen';
import { LoadingScreen } from '../components/LoadingScreen';
import { Plus } from 'lucide-react';

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
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [draggedHabitId, setDraggedHabitId] = useState<string | null>(null);
  const [modalInitialNature, setModalInitialNature] = useState<'do' | 'dont'>('do');

  const prevCompletionRef = useRef<boolean>(false);

  // Validate session on mount
  useEffect(() => {
    let isMounted = true;

    const isSessionUnlocked =
      typeof window !== 'undefined' &&
      sessionStorage.getItem('zenith_session_unlocked') === 'true';

    if (!isSessionUnlocked) {
      setIsUnlocked(false);
      lockSessionAction().catch(() => {});
      return;
    }

    const checkAuth = async () => {
      try {
        const authenticated = await checkSessionAction();
        if (isMounted) {
          if (authenticated) {
            setIsUnlocked(true);
            syncWithCloud();
          } else {
            if (typeof window !== 'undefined') {
              sessionStorage.removeItem('zenith_session_unlocked');
            }
            setIsUnlocked(false);
          }
        }
      } catch (err) {
        if (isMounted) {
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('zenith_session_unlocked');
          }
          setIsUnlocked(false);
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [syncWithCloud]);

  const handleUnlockSuccess = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('zenith_session_unlocked', 'true');
    }
    setIsUnlocked(true);
    syncWithCloud();
  };

  const handleLockApp = async () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('zenith_session_unlocked');
    }
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

  const safeFocusedIndex = Math.min(focusedIndex, Math.max(0, displayedDailyHabits.length - 1));

  // Drag & Drop
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

  // Keyboard Shortcuts
  useEffect(() => {
    if (!isUnlocked) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const hasOpenModal = 
        isSettingsModalOpen ||
        isHabitModalOpen || 
        isInviteModalOpen || 
        isShortcutsModalOpen || 
        isShareModalOpen || 
        isNotificationModalOpen;
        
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
          if (!isDone) playCheckSound();
          else playUncheckSound();
          toggleHabit(focusedHabit.id, selectedDate, !isDone, !isDone ? focusedHabit.target_value : 0);
        }
      }
      // Stepper: + / -
      else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        const focusedHabit = displayedDailyHabits[safeFocusedIndex];
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
        const focusedHabit = displayedDailyHabits[safeFocusedIndex];
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
      // Settings: s or ,
      else if (key === 's' || key === ',') {
        e.preventDefault();
        setIsSettingsModalOpen(true);
      }
      // Jump to Today: t
      else if (key === 't') {
        e.preventDefault();
        setSelectedDate(getTodayDateString());
      }
      // Switch tabs: 1, 2, 3, 4, 5
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
        setActiveTab('heatmap');
      } else if (e.key === '5') {
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
    safeFocusedIndex,
    logs,
    selectedDate,
    toggleHabit,
    isSettingsModalOpen,
    isHabitModalOpen,
    isInviteModalOpen,
    isShortcutsModalOpen,
    isShareModalOpen,
    isNotificationModalOpen
  ]);

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
    <div className="min-h-screen bg-main text-main pb-16 selection:bg-[#FF3B30] selection:text-white transition-colors font-mono">
      {/* Top Header */}
      <Header
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        onOpenAddModal={() => handleOpenAddModal('do')}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        completedCount={completedCount}
        totalCount={totalCount}
      />

      {/* Navigation Tabs */}
      <ViewTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main View Content */}
      <main className="w-full">
        {activeTab === 'today' && (
          <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 space-y-4">
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
                    onClick={() => setFilterCategory(f.id)}
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
                    onClick={() => handleOpenAddModal('do')}
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
                            stats={statsMap[habit.id] || {
                              currentStreak: 0,
                              longestStreak: 0,
                              totalCompletions: 0,
                              completionRate30Days: 0,
                              isCompletedToday: false,
                              todayValue: 0,
                            }}
                            dateStr={selectedDate}
                            isFocused={globalIdx === safeFocusedIndex}
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

                {/* 2. Habits to Break (Don't) - Only rendered if user actually has dont-habits */}
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
                            stats={statsMap[habit.id] || {
                              currentStreak: 0,
                              longestStreak: 0,
                              totalCompletions: 0,
                              completionRate30Days: 0,
                              isCompletedToday: false,
                              todayValue: 0,
                            }}
                            dateStr={selectedDate}
                            isFocused={globalIdx === safeFocusedIndex}
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
              </div>
            )}
          </div>
        )}

        {activeTab === 'planner' && (
          <div className="w-full max-w-4xl mx-auto px-4 sm:px-6">
            <div className="bg-card p-4 sm:p-6 border border-main">
              <DailyPlanner
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
            </div>
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

      {/* Main Single Settings Modal (Houses all advanced features) */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onOpenInviteModal={() => setIsInviteModalOpen(true)}
        onOpenShortcutsModal={() => setIsShortcutsModalOpen(true)}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        onOpenNotificationModal={() => setIsNotificationModalOpen(true)}
        onLockApp={handleLockApp}
      />

      {/* Habit Create / Edit Modal */}
      <HabitModal
        isOpen={isHabitModalOpen}
        onClose={() => setIsHabitModalOpen(false)}
        onSave={handleSaveHabit}
        editingHabit={editingHabit}
        initialNature={modalInitialNature}
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

      {/* Invite Friend Modal */}
      <InviteFriendModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />
    </div>
  );
}
