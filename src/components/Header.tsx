'use client';

import React, { useState, useEffect } from 'react';
import { 
  Flame, 
  Plus, 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  Sun, 
  Moon, 
  ChevronLeft, 
  ChevronRight,
  Lock,
  Keyboard,
  Share2,
  Bell,
  Volume2,
  VolumeX
} from 'lucide-react';
import { useHabitStore } from '../lib/store';
import { useTheme } from '../lib/theme';
import { isSoundEnabled, setSoundEnabled } from '../lib/utils/sound';
import { formatDisplayDate, getTodayDateString, formatDate, parseDate } from '../lib/utils/date';
import { addDays, subDays } from 'date-fns';
import { Progress } from './ui/progress';

interface HeaderProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onOpenAddModal: () => void;
  onOpenSyncModal: () => void;
  onOpenShortcutsModal?: () => void;
  onOpenShareModal?: () => void;
  onOpenNotificationModal?: () => void;
  onLockApp: () => void;
  completedCount: number;
  totalCount: number;
}

export function Header({
  selectedDate,
  onSelectDate,
  onOpenAddModal,
  onOpenSyncModal,
  onOpenShortcutsModal,
  onOpenShareModal,
  onOpenNotificationModal,
  onLockApp,
  completedCount,
  totalCount,
}: HeaderProps) {
  const { isSyncing, isCloudReady } = useHabitStore();
  const { theme, toggleTheme } = useTheme();
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    setSoundOn(isSoundEnabled());
  }, []);

  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  };

  const todayStr = getTodayDateString();
  const isToday = selectedDate === todayStr;

  const handlePrevDay = () => {
    const d = parseDate(selectedDate);
    onSelectDate(formatDate(subDays(d, 1)));
  };

  const handleNextDay = () => {
    const d = parseDate(selectedDate);
    onSelectDate(formatDate(addDays(d, 1)));
  };

  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <header className="w-full max-w-6xl mx-auto pt-4 sm:pt-6 pb-3 sm:pb-4 px-3.5 sm:px-6">
      {/* Top Swiss Masthead */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
        {/* Brand & Index */}
        <div className="flex items-center justify-between w-full sm:w-auto">
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Swiss Cross / Block Icon */}
            <div className="w-8 h-8 rounded-none bg-[#FF3B30] flex items-center justify-center text-white font-black text-sm shadow-xs select-none">
              <span className="text-base font-black leading-none">✚</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-[#FF3B30]">01 //</span>
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-main uppercase font-sans">
                  Zenith
                </h1>
              </div>
              <div className="text-[10px] font-mono tracking-widest text-sub uppercase">
                HABIT SYSTEM // MODULAR PROTOCOL
              </div>
            </div>
          </div>

          {/* Prominent Add Habit Button (Mobile) */}
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 h-10 px-3.5 sm:h-8 sm:px-3 rounded-none text-xs font-mono font-bold bg-[#FF3B30] hover:bg-[#E02D24] text-white border border-[#FF3B30] shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation sm:hidden"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>NEW ROUTINE</span>
          </button>
        </div>

        {/* Action Utility Controls */}
        <div className="flex items-center gap-2 sm:gap-1.5 flex-wrap justify-between sm:justify-end">
          {/* Cloud Sync Status */}
          <button
            onClick={onOpenSyncModal}
            title={isCloudReady ? 'Cloud Synced — Click for details' : 'Local Storage Mode'}
            className="flex items-center gap-1.5 h-10 px-3 sm:h-8 sm:px-2.5 rounded-none text-xs font-mono bg-card hover:bg-subtle border border-main text-sub hover:text-main transition-all cursor-pointer touch-manipulation active:scale-95"
          >
            {isSyncing ? (
              <RefreshCw className="w-4 h-4 sm:w-3.5 sm:h-3.5 animate-spin text-[#FF3B30]" />
            ) : isCloudReady ? (
              <Cloud className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-neutral-300" />
            ) : (
              <CloudOff className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-muted-custom" />
            )}
            <span>
              {isSyncing ? 'SYNCING...' : isCloudReady ? 'SYNCED' : 'LOCAL'}
            </span>
          </button>

          <div className="flex items-center gap-1.5 sm:gap-1.5">
            {/* Sound Toggle */}
            <button
              onClick={handleToggleSound}
              className="w-10 h-10 sm:w-8 sm:h-8 rounded-none bg-card hover:bg-subtle border border-main text-sub hover:text-main transition-all flex items-center justify-center cursor-pointer touch-manipulation active:scale-95"
              title={soundOn ? 'Sound: ON (Click to mute)' : 'Sound: MUTED (Click to enable)'}
              aria-label="Toggle Sound"
            >
              {soundOn ? (
                <Volume2 className="w-4.5 h-4.5 sm:w-3.5 sm:h-3.5 text-[#FF3B30]" />
              ) : (
                <VolumeX className="w-4.5 h-4.5 sm:w-3.5 sm:h-3.5 text-sub" />
              )}
            </button>

            {/* Share Modal */}
            {onOpenShareModal && (
              <button
                onClick={onOpenShareModal}
                className="w-10 h-10 sm:w-8 sm:h-8 rounded-none bg-card hover:bg-subtle border border-main text-sub hover:text-main transition-all flex items-center justify-center cursor-pointer touch-manipulation active:scale-95"
                title="Share Streak & Stats Card"
                aria-label="Share Stats"
              >
                <Share2 className="w-4.5 h-4.5 sm:w-3.5 sm:h-3.5" />
              </button>
            )}

            {/* Reminder Notifications */}
            {onOpenNotificationModal && (
              <button
                onClick={onOpenNotificationModal}
                className="w-10 h-10 sm:w-8 sm:h-8 rounded-none bg-card hover:bg-subtle border border-main text-sub hover:text-main transition-all flex items-center justify-center cursor-pointer touch-manipulation active:scale-95"
                title="Daily Check-in Reminder"
                aria-label="Daily Reminder"
              >
                <Bell className="w-4.5 h-4.5 sm:w-3.5 sm:h-3.5" />
              </button>
            )}

            {/* Shortcuts Modal (Desktop only) */}
            {onOpenShortcutsModal && (
              <button
                onClick={onOpenShortcutsModal}
                className="hidden sm:flex w-8 h-8 rounded-none bg-card hover:bg-subtle border border-main text-sub hover:text-main transition-all items-center justify-center cursor-pointer touch-manipulation active:scale-95"
                title="Keyboard Shortcuts (Press ?)"
                aria-label="Keyboard Shortcuts"
              >
                <Keyboard className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="w-10 h-10 sm:w-8 sm:h-8 rounded-none bg-card hover:bg-subtle border border-main text-sub hover:text-main transition-all flex items-center justify-center cursor-pointer touch-manipulation active:scale-95"
              title={`Theme: ${theme.toUpperCase()}`}
              aria-label="Toggle Theme"
            >
              {theme === 'light' ? (
                <Sun className="w-4.5 h-4.5 sm:w-3.5 sm:h-3.5 text-neutral-800" />
              ) : theme === 'oled' ? (
                <Moon className="w-4.5 h-4.5 sm:w-3.5 sm:h-3.5 text-neutral-100" />
              ) : (
                <Moon className="w-4.5 h-4.5 sm:w-3.5 sm:h-3.5 text-neutral-300" />
              )}
            </button>

            {/* Lock App Button */}
            <button
              onClick={onLockApp}
              className="w-10 h-10 sm:w-8 sm:h-8 rounded-none bg-card hover:bg-subtle border border-main text-sub hover:text-[#FF3B30] transition-all flex items-center justify-center cursor-pointer touch-manipulation active:scale-95"
              title="Lock Session"
              aria-label="Lock Session"
            >
              <Lock className="w-4.5 h-4.5 sm:w-3.5 sm:h-3.5" />
            </button>

            {/* Desktop Add Habit Button */}
            <button
              onClick={onOpenAddModal}
              className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-none text-xs font-mono font-bold bg-[#FF3B30] hover:bg-[#E02D24] text-white border border-[#FF3B30] shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>NEW ROUTINE</span>
            </button>
          </div>
        </div>
      </div>

      {/* Date & Progress Banner (Modular Grid Layout) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4 p-4 sm:p-5 rounded-none bg-card border border-main transition-colors">
        {/* Date Selector */}
        <div className="flex items-center justify-between sm:justify-start gap-3 sm:gap-4">
          <div className="flex items-center bg-input rounded-none p-1 border border-subtle flex-shrink-0">
            <button
              onClick={handlePrevDay}
              className="w-11 h-11 sm:w-8 sm:h-8 rounded-none hover:bg-subtle text-sub hover:text-main transition-colors cursor-pointer touch-manipulation flex items-center justify-center active:scale-95"
              title="Previous Day"
              aria-label="Previous Day"
            >
              <ChevronLeft className="w-5 h-5 sm:w-4 sm:h-4" />
            </button>
            
            <button
              onClick={() => onSelectDate(todayStr)}
              className={`h-11 sm:h-8 px-3.5 sm:px-3 text-xs sm:text-xs font-mono font-bold rounded-none transition-all cursor-pointer touch-manipulation flex items-center justify-center ${
                isToday
                  ? 'bg-main text-main font-black border border-main'
                  : 'text-sub hover:text-main'
              }`}
            >
              {isToday ? 'TODAY' : 'GO TO TODAY'}
            </button>

            <button
              onClick={handleNextDay}
              className="w-11 h-11 sm:w-8 sm:h-8 rounded-none hover:bg-subtle text-sub hover:text-main transition-colors cursor-pointer touch-manipulation flex items-center justify-center active:scale-95"
              title="Next Day"
              aria-label="Next Day"
            >
              <ChevronRight className="w-5 h-5 sm:w-4 sm:h-4" />
            </button>
          </div>

          <div className="min-w-0 text-right sm:text-left">
            <div className="text-base sm:text-lg font-black text-main tracking-tight uppercase font-sans truncate">
              {formatDisplayDate(selectedDate)}
            </div>
            <div className="text-xs font-mono text-sub uppercase tracking-wider">
              {totalCount === 0 
                ? '00 / 00 PROTOCOLS' 
                : `${String(completedCount).padStart(2, '0')} / ${String(totalCount).padStart(2, '0')} COMPLETED`}
            </div>
          </div>
        </div>

        {/* Big Display Percentage & Progress Bar */}
        <div className="flex flex-col sm:items-end gap-1.5 w-full sm:w-60 flex-shrink-0 pt-2 sm:pt-0 border-t border-subtle sm:border-t-0">
          <div className="flex items-baseline justify-between sm:justify-end gap-2 w-full">
            <span className="text-[10px] font-mono tracking-widest text-sub uppercase">COMPLIANCE</span>
            <span className="text-2xl sm:text-3xl font-black font-sans tracking-tight text-main">
              {percentage}<span className="text-sm font-mono text-[#FF3B30]">%</span>
            </span>
          </div>
          <div className="w-full">
            <Progress
              value={completedCount}
              max={totalCount || 1}
              size="md"
              indicatorColor="#FF3B30"
              showLabel={false}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
