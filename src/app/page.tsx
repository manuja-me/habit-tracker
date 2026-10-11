'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useHabitStore, clearLocalUserData, loadLocalDataFromStorage } from '../lib/store';
import { Habit } from '../lib/types';
import { calculateHabitStats, isDaySuccessful } from '../lib/utils/streaks';
import { getTodayDateString, isHabitDueOnDate } from '../lib/utils/date';
import { calculateGamificationProfile } from '../lib/utils/gamification';
import { checkSessionAction, lockSessionAction } from '../lib/server/auth';
import { useAppShortcuts } from '../lib/hooks/useAppShortcuts';
import { useGamificationFeedback } from '../lib/hooks/useGamificationFeedback';

import { Header } from '../components/Header';
import { ViewTabs, ActiveTab } from '../components/ViewTabs';
import { DailyHabitsList } from '../components/DailyHabitsList';
import { WeeklyGrid } from '../components/WeeklyGrid';
import { MinimalHeatmap } from '../components/MinimalHeatmap';
import { AnalyticsView } from '../components/AnalyticsView';
import { DailyPlanner } from '../components/DailyPlanner';
import { ProjectsView } from '../components/ProjectsView';
import { AdminUsersView } from '../components/AdminUsersView';
import { HabitModal, HabitFormData } from '../components/HabitModal';
import { SettingsModal } from '../components/SettingsModal';
import { ShortcutsModal } from '../components/ShortcutsModal';
import { ShareStreakModal } from '../components/ShareStreakModal';
import { NotificationModal } from '../components/NotificationModal';
import { InviteFriendModal } from '../components/InviteFriendModal';
import { AbsenceCatchUpModal } from '../components/AbsenceCatchUpModal';
import { PinLockScreen } from '../components/PinLockScreen';
import { LoadingScreen } from '../components/LoadingScreen';
import { AppFooter } from '../components/AppFooter';
import { 
  checkInactivity, 
  recordCurrentVisit, 
  AbsenceDetectionResult,
  LAST_VISIT_STORAGE_KEY,
  LAST_ACKNOWLEDGED_ABSENCE_KEY
} from '../lib/utils/presence';

export default function HabitTrackerPage() {
  const [isUnlocked, setIsUnlocked] = useState<boolean | null>(() => {
    if (typeof window === 'undefined') return null;
    const isSessionUnlocked = sessionStorage.getItem('zenith_session_unlocked') === 'true';
    if (!isSessionUnlocked) {
      clearLocalUserData();
      return false;
    }
    return null;
  });
  const [isVaultReady, setIsVaultReady] = useState<boolean>(false);

  const {
    habits,
    logs,
    currentUser,
    lastAccountActiveAt,
    isInitialSyncDone,
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
  const [absenceInfo, setAbsenceInfo] = useState<AbsenceDetectionResult | null>(null);
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);

  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [modalInitialNature, setModalInitialNature] = useState<'do' | 'dont'>('do');

  // Inactivity / 24-hour absence check after cloud sync completes (checks account-wide activity across devices)
  useEffect(() => {
    if (isUnlocked && isInitialSyncDone) {
      const timer = setTimeout(() => {
        const simulatedHours =
          typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('absence')
            : null;
        if (simulatedHours) {
          const hours = parseInt(simulatedHours, 10) || 24;
          const fakePast = new Date(Date.now() - hours * 3600 * 1000).toISOString();
          localStorage.setItem(LAST_VISIT_STORAGE_KEY, fakePast);
          localStorage.removeItem(LAST_ACKNOWLEDGED_ABSENCE_KEY);
        }

        const result = checkInactivity(
          24,
          simulatedHours ? null : lastAccountActiveAt,
          currentUser?.id
        );
        if (result.wasAway && (result.missedDates.length > 0 || result.hoursAway >= 24)) {
          setAbsenceInfo(result);
          setIsAbsenceModalOpen(true);
        } else {
          recordCurrentVisit(currentUser?.id, true);
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isUnlocked, isInitialSyncDone, lastAccountActiveAt, currentUser?.id]);

  const handleTriggerAudit = () => {
    let result = checkInactivity(24, lastAccountActiveAt, currentUser?.id);
    if (!result.wasAway || result.missedDates.length === 0) {
      const yesterday = new Date(Date.now() - 26 * 3600 * 1000);
      result = {
        wasAway: true,
        hoursAway: 26,
        daysAway: 1,
        previousVisitIso: yesterday.toISOString(),
        missedDates: [yesterday.toISOString().split('T')[0]],
      };
    }
    setAbsenceInfo(result);
    setIsAbsenceModalOpen(true);
  };

  // Periodic heartbeat & unload listener to keep visit timestamp updated
  useEffect(() => {
    if (!isUnlocked) return;
    const interval = setInterval(() => {
      recordCurrentVisit(currentUser?.id);
    }, 10 * 60 * 1000);

    const handleUnload = () => {
      recordCurrentVisit(currentUser?.id);
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [isUnlocked, currentUser?.id]);

  const handleSaveAbsenceLogs = (
    batch: Array<{ habitId: string; dateStr: string; completed: boolean; value: number }>
  ) => {
    batch.forEach(({ habitId, dateStr, completed, value }) => {
      toggleHabit(habitId, dateStr, completed, value);
    });
    recordCurrentVisit(currentUser?.id, true);
  };

  // Validate session on mount
  useEffect(() => {
    if (isUnlocked === false) {
      lockSessionAction().catch(() => {});
      return;
    }

    let isMounted = true;

    const checkAuth = async () => {
      try {
        const authenticated = await checkSessionAction();
        if (isMounted) {
          if (authenticated) {
            setIsUnlocked(true);
            loadLocalDataFromStorage();
            syncWithCloud();
          } else {
            clearLocalUserData();
            if (typeof window !== 'undefined') {
              sessionStorage.removeItem('zenith_session_unlocked');
            }
            setIsUnlocked(false);
          }
        }
      } catch {
        if (isMounted) {
          clearLocalUserData();
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
  }, [isUnlocked, syncWithCloud]);

  const handleUnlockSuccess = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('zenith_session_unlocked', 'true');
    }
    setIsUnlocked(true);
    setIsVaultReady(false);
    loadLocalDataFromStorage();
    syncWithCloud();
  };

  const handleLockApp = async () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('zenith_session_unlocked');
    }
    clearLocalUserData();
    await lockSessionAction();
    setActiveTab('today');
    setIsUnlocked(false);
    setIsVaultReady(false);
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

  const gamificationProfile = useMemo(() => {
    return calculateGamificationProfile(habits, logs, selectedDate, statsMap);
  }, [habits, logs, selectedDate, statsMap]);

  // Daily browser reminder notification check (once per day after configured HH:MM when habits remain incomplete)
  useEffect(() => {
    if (!isUnlocked || typeof window === 'undefined' || !('Notification' in window)) return;
    const checkReminder = () => {
      try {
        if (Notification.permission !== 'granted') return;
        if (localStorage.getItem('zenith_reminder_enabled') !== 'true') return;
        const reminderTime = localStorage.getItem('zenith_reminder_time') || '20:30';
        const todayStr = getTodayDateString();
        if (localStorage.getItem('zenith_reminder_last_date') === todayStr) return;
        const now = new Date();
        const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        if (hhmm < reminderTime) return;
        const pendingToday = habits.filter(
          (h) => isHabitDueOnDate(h, todayStr) && !isDaySuccessful(h, todayStr, logs, todayStr)
        );
        if (pendingToday.length > 0) {
          localStorage.setItem('zenith_reminder_last_date', todayStr);
          new Notification('Zenith Daily Check-In', {
            body: `${pendingToday.length} habit${pendingToday.length === 1 ? '' : 's'} still pending today.`,
            icon: '/icon.png',
          });
        }
      } catch {}
    };
    checkReminder();
    const id = setInterval(checkReminder, 60000);
    return () => clearInterval(id);
  }, [isUnlocked, habits, logs]);

  // Handle level-up toast, confetti, and unlock chimes
  const { levelUpToast } = useGamificationFeedback({
    isUnlocked,
    completedCount,
    totalCount,
    gamificationProfile,
  });

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

  const handleOpenAddModal = (nature: 'do' | 'dont' = 'do') => {
    setEditingHabit(null);
    setModalInitialNature(nature);
    setIsHabitModalOpen(true);
  };

  const handleEditHabit = (habit: Habit) => {
    setEditingHabit(habit);
    setIsHabitModalOpen(true);
  };

  const handleSaveHabit = (data: HabitFormData) => {
    if (editingHabit) {
      updateHabit(editingHabit.id, data);
    } else {
      addHabit(data);
    }
  };

  const hasOpenModal = 
    isSettingsModalOpen ||
    isHabitModalOpen || 
    isInviteModalOpen || 
    isShortcutsModalOpen || 
    isShareModalOpen || 
    isNotificationModalOpen ||
    isAbsenceModalOpen;

  // Global Keyboard Shortcuts
  useAppShortcuts({
    isUnlocked,
    hasOpenModal,
    displayedDailyHabits,
    safeFocusedIndex,
    setFocusedIndex,
    logs,
    selectedDate,
    setSelectedDate,
    toggleHabit,
    onOpenAddModal: () => handleOpenAddModal('do'),
    onOpenSettingsModal: () => setIsSettingsModalOpen(true),
    onOpenShortcutsModal: () => setIsShortcutsModalOpen(true),
    setActiveTab,
    isAdmin: currentUser?.role === 'owner',
  });

  if (isUnlocked === false) {
    return <PinLockScreen onUnlock={handleUnlockSuccess} />;
  }

  if (isUnlocked === null || !isVaultReady) {
    return (
      <LoadingScreen
        message={isUnlocked === null ? 'VALIDATING SECURE SESSION...' : 'CONNECTING TO DATABASE...'}
        statusText="ZENITH // SUPABASE CLOUD"
        isReady={isUnlocked === true && isInitialSyncDone}
        onComplete={() => setIsVaultReady(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-main text-main pb-16 transition-colors font-mono">
      {/* Top Header */}
      <Header
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        onOpenAddModal={() => handleOpenAddModal('do')}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        completedCount={completedCount}
        totalCount={totalCount}
        playerLevel={gamificationProfile.level}
        prestigeTier={gamificationProfile.tier}
        totalXp={gamificationProfile.totalXp}
        progressPercent={gamificationProfile.progressPercent}
      />

      {/* Navigation Tabs */}
      <ViewTabs activeTab={activeTab} onTabChange={setActiveTab} isAdmin={currentUser?.role === 'owner'} />

      {/* Main View Content */}
      <main className="w-full">
        {activeTab === 'today' && (
          <div className="w-full max-w-4xl xl:max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 xl:gap-8 items-start">
              {/* Left Column: Habits Section with Drag & Drop */}
              <DailyHabitsList
                habits={habits}
                displayedDailyHabits={displayedDailyHabits}
                doHabits={doHabits}
                dontHabits={dontHabits}
                filterCategory={filterCategory}
                onSelectFilterCategory={setFilterCategory}
                logs={logs}
                statsMap={statsMap}
                selectedDate={selectedDate}
                safeFocusedIndex={safeFocusedIndex}
                onToggleHabit={toggleHabit}
                onEditHabit={handleEditHabit}
                onDeleteHabit={deleteHabit}
                onReorderHabits={reorderHabits}
                onOpenAddModal={handleOpenAddModal}
              />

              {/* Right Column: Desktop Full-Screen Daily Planner & Notes Overview Sidebar */}
              <div className="hidden xl:block xl:col-span-5 sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto space-y-4 pr-1">
                <div className="bg-card p-4 sm:p-5 border border-main shadow-xs">
                  <DailyPlanner
                    selectedDate={selectedDate}
                    onSelectDate={setSelectedDate}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'planner' && (
          <div className="w-full max-w-4xl xl:max-w-7xl mx-auto px-4 sm:px-6">
            <div className="bg-card p-4 sm:p-6 border border-main shadow-xs">
              <DailyPlanner
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
            </div>
          </div>
        )}

        {activeTab === 'projects' && <ProjectsView />}

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
          <AnalyticsView habits={habits} logs={logs} profile={gamificationProfile} />
        )}

        {activeTab === 'admin' && currentUser?.role === 'owner' && (
          <AdminUsersView onOpenInvite={() => setIsInviteModalOpen(true)} />
        )}
      </main>

      {/* Minimal Footer */}
      <AppFooter onOpenShortcutsModal={() => setIsShortcutsModalOpen(true)} />

      {/* Main Single Settings Modal (Houses all advanced features) */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onOpenInviteModal={() => setIsInviteModalOpen(true)}
        onOpenShortcutsModal={() => setIsShortcutsModalOpen(true)}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        onOpenNotificationModal={() => setIsNotificationModalOpen(true)}
        onTriggerAbsenceCheck={handleTriggerAudit}
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
        profile={gamificationProfile}
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

      {/* 24-Hour Absence Audit Modal */}
      {absenceInfo && (
        <AbsenceCatchUpModal
          isOpen={isAbsenceModalOpen}
          absence={absenceInfo}
          habits={habits}
          logs={logs}
          onClose={() => setIsAbsenceModalOpen(false)}
          onSaveLogs={handleSaveAbsenceLogs}
        />
      )}

      {/* Level Up Celebratory Toast */}
      {levelUpToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-card border-2 border-[#FF3B30] shadow-2xl animate-in slide-in-from-bottom-5 duration-200 flex items-center gap-3">
          <div className="w-8 h-8 bg-[#FF3B30] text-white flex items-center justify-center font-black text-sm">
            ★
          </div>
          <div>
            <div className="text-[10px] font-mono text-[#FF3B30] uppercase font-bold tracking-widest">
              LEVEL UP ACHIEVED
            </div>
            <div className="text-sm font-black font-sans uppercase text-main">
              LEVEL {levelUpToast.level} • {levelUpToast.tierName}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
