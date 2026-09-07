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
import { DailyPlanner } from '../components/DailyPlanner';
import { HabitModal } from '../components/HabitModal';
import { ShortcutsModal } from '../components/ShortcutsModal';
import { ShareStreakModal } from '../components/ShareStreakModal';
import { NotificationModal } from '../components/NotificationModal';
import { InviteFriendModal } from '../components/InviteFriendModal';
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
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [draggedHabitId, setDraggedHabitId] = useState<string | null>(null);
  const [modalInitialNature, setModalInitialNature] = useState<'do' | 'dont'>('do');

  const prevCompletionRef = useRef<boolean>(false);

  // Validate session on mount: Require PIN whenever the website was closed or in a fresh session
  useEffect(() => {
    let isMounted = true;

    // Check if the current tab session has already been unlocked with PIN
    const isSessionUnlocked =
      typeof window !== 'undefined' &&
      sessionStorage.getItem('zenith_session_unlocked') === 'true';

    if (!isSessionUnlocked) {
      // Fresh session, new tab, or website was closed: Lock immediately & ensure server cookie is purged
      setIsUnlocked(false);
      lockSessionAction().catch(() => {});
      return;
    }

    // Existing active tab session (e.g. page reload): Verify server session
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
      const hasOpenModal = isHabitModalOpen || isInviteModalOpen || isShortcutsModalOpen || isShareModalOpen || isNotificationModalOpen;
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
    isInviteModalOpen,
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
        onOpenInviteModal={() => setIsInviteModalOpen(true)}
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
          <div className="w-full max-w-6xl mx-auto px-3.5 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Habit Protocols */}
              <div className="lg:col-span-7 space-y-3 sm:space-y-4 min-w-0">
                {/* Filter pills */}
            <div className="flex items-center justify-between gap-3 mb-4 sm:mb-5">
              <div className="flex items-center bg-card p-1 rounded-none border border-main shadow-xs">
                {[
                  { id: 'all', label: 'ALL' },
                  { id: 'pending', label: 'PENDING' },
                  { id: 'completed', label: 'COMPLETED' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilterCategory(f.id)}
                    className={`h-10 sm:h-8 px-4 sm:px-3 rounded-none text-xs font-sans font-black tracking-tight uppercase transition-all cursor-pointer touch-manipulation select-none flex items-center justify-center active:scale-95 ${
                      filterCategory === f.id
                        ? 'bg-subtle text-main font-black border border-main border-b-2 border-b-[#FF3B30]'
                        : 'text-sub hover:text-main hover:bg-subtle/50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <span className="text-xs font-mono font-bold text-sub flex-shrink-0 uppercase tracking-wider">
                {String(displayedDailyHabits.length).padStart(2, '0')} PROTOCOLS
              </span>
            </div>

            {/* Habit Lists: DO Routines and DONT Routines with Divider */}
            {displayedDailyHabits.length === 0 ? (
              <div className="p-8 sm:p-14 text-center rounded-none bg-card border border-main transition-colors">
                <div className="w-12 h-12 rounded-none bg-subtle text-[#FF3B30] border border-main flex items-center justify-center mx-auto mb-4 font-black text-xl">
                  ✚
                </div>
                <h3 className="text-base sm:text-lg font-black font-sans uppercase tracking-tight text-main mb-1.5">
                  {filterCategory === 'completed'
                    ? 'No protocols completed yet today'
                    : filterCategory === 'pending'
                    ? 'All clear. Zero pending protocols.'
                    : 'No protocols scheduled for today'}
                </h3>
                <p className="text-xs font-mono text-sub max-w-sm mx-auto mb-6 uppercase tracking-wider">
                  {filterCategory === 'all'
                    ? 'Initialize daily building routines or configure addiction breakers.'
                    : 'System consistency maintained.'}
                </p>
                {filterCategory === 'all' && (
                  <button
                    onClick={() => handleOpenAddModal('do')}
                    className="inline-flex items-center gap-2 h-12 sm:h-9 px-5 sm:px-4 rounded-none text-xs font-sans font-black uppercase tracking-tight bg-[#FF3B30] hover:bg-[#E02D24] text-white border border-[#FF3B30] active:scale-95 transition-all cursor-pointer touch-manipulation shadow-xs"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>ADD ROUTINE</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-6 sm:space-y-6">
                {/* 1. DO ROUTINES (BUILD) */}
                {doHabits.length > 0 && (
                  <div className="space-y-3 sm:space-y-2.5">
                    <div className="flex items-center justify-between px-1 pb-2 border-b border-subtle">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-mono font-black text-[#FF3B30]">01 //</span>
                        <h2 className="text-sm font-black font-sans text-main uppercase tracking-tight">
                          DO ROUTINES (BUILD)
                        </h2>
                      </div>
                      <span className="text-xs font-mono text-sub uppercase">
                        {String(doHabits.length).padStart(2, '0')} PROTOCOLS
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:gap-2.5">
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
                <div className="pt-4 space-y-3 sm:space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap px-1 pb-2 border-b border-subtle">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-mono font-black text-[#FF3B30]">02 //</span>
                      <h2 className="text-sm font-black font-sans text-main uppercase tracking-tight">
                        DONT ROUTINES (QUIT & BREAK)
                      </h2>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-[#FF3B30] bg-[#FF3B30]/10 border border-[#FF3B30]/30 px-2 py-0.5 uppercase tracking-wider">
                      AUTO-CLEAN PROTOCOL
                    </span>
                  </div>

                  {dontHabits.length === 0 ? (
                    <div className="p-6 rounded-none bg-card border border-main text-center space-y-3">
                      <p className="text-xs font-mono text-sub uppercase tracking-wider">
                        Zero addiction or habit-breaking routines configured.
                      </p>
                      <button
                        onClick={() => handleOpenAddModal('dont')}
                        className="inline-flex items-center gap-2 h-12 sm:h-9 px-5 sm:px-4 text-xs font-sans font-black uppercase tracking-tight bg-card hover:bg-[#FF3B30]/10 hover:border-[#FF3B30] border border-main text-main hover:text-[#FF3B30] transition-colors cursor-pointer touch-manipulation active:scale-95"
                      >
                        <Plus className="w-4 h-4" />
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

          {/* Right Column: Daily Planner Desktop Side Panel (hidden on mobile) */}
          <div className="lg:col-span-5 hidden lg:block bg-card p-4 sm:p-5 border border-main rounded-none shadow-xs sticky top-6">
            <DailyPlanner
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          </div>
        </div>
      </div>
    )}

        {activeTab === 'planner' && (
          <div className="w-full max-w-4xl mx-auto px-3.5 sm:px-6">
            <div className="bg-card p-4 sm:p-6 border border-main rounded-none shadow-xs">
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
