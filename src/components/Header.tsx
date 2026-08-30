'use client';

import React from 'react';
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
  Lock
} from 'lucide-react';
import { useHabitStore } from '../lib/store';
import { useTheme } from '../lib/theme';
import { formatDisplayDate, getTodayDateString, formatDate, parseDate } from '../lib/utils/date';
import { addDays, subDays } from 'date-fns';
import { Progress } from './ui/progress';

interface HeaderProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onOpenAddModal: () => void;
  onOpenSyncModal: () => void;
  onLockApp: () => void;
  completedCount: number;
  totalCount: number;
}

export function Header({
  selectedDate,
  onSelectDate,
  onOpenAddModal,
  onOpenSyncModal,
  onLockApp,
  completedCount,
  totalCount,
}: HeaderProps) {
  const { isSyncing, isCloudReady } = useHabitStore();
  const { theme, toggleTheme } = useTheme();

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
    <header className="w-full max-w-4xl mx-auto pt-4 sm:pt-6 pb-3 sm:pb-4 px-3.5 sm:px-6">
      {/* Top Navbar */}
      <div className="flex items-center justify-between gap-2 sm:gap-4 mb-4 sm:mb-5">
        {/* Brand */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-none bg-emerald-500 flex items-center justify-center text-black font-bold border border-emerald-400">
            <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-black" />
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-main font-mono uppercase">
              Zenith
            </h1>
            <span className="text-[9px] sm:text-[10px] font-mono font-bold tracking-widest px-1 sm:px-1.5 py-0.5 rounded-none bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
              PRO
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Cloud Sync Status */}
          <button
            onClick={onOpenSyncModal}
            title={isCloudReady ? 'Cloud Synced — Click for details' : 'Local Storage Mode'}
            className="flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-1.5 rounded-none text-xs font-mono bg-card hover:bg-subtle border border-main text-sub hover:text-main transition-all cursor-pointer touch-manipulation"
          >
            {isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-500" />
            ) : isCloudReady ? (
              <Cloud className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <CloudOff className="w-3.5 h-3.5 text-muted-custom" />
            )}
            <span className="hidden sm:inline">
              {isSyncing ? 'SYNCING...' : isCloudReady ? 'SYNCED' : 'LOCAL'}
            </span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 sm:p-2 rounded-none bg-card hover:bg-subtle border border-main text-sub hover:text-main transition-all flex items-center justify-center cursor-pointer touch-manipulation"
            title={`Theme: ${theme.toUpperCase()} (Click to toggle Light / Dark / OLED)`}
            aria-label="Toggle Theme"
          >
            {theme === 'light' ? (
              <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
            ) : theme === 'oled' ? (
              <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-300" />
            )}
          </button>

          {/* Lock App Button */}
          <button
            onClick={onLockApp}
            className="p-1.5 sm:p-2 rounded-none bg-card hover:bg-subtle border border-main text-sub hover:text-rose-500 transition-all flex items-center justify-center cursor-pointer touch-manipulation"
            title="Lock Session"
            aria-label="Lock Session"
          >
            <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Add Habit Button */}
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-none text-xs font-mono font-bold bg-emerald-500 hover:bg-emerald-400 text-black border border-emerald-400 shadow-xs transition-all active:scale-95 cursor-pointer touch-manipulation"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
            <span className="hidden xs:inline sm:inline">NEW </span><span>HABIT</span>
          </button>
        </div>
      </div>

      {/* Date & Progress Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-none bg-card border border-main transition-colors">
        {/* Date Selector */}
        <div className="flex items-center justify-between sm:justify-start gap-2.5 sm:gap-3">
          <div className="flex items-center bg-input rounded-none p-0.5 border border-subtle flex-shrink-0">
            <button
              onClick={handlePrevDay}
              className="p-1 sm:p-1.5 rounded-none hover:bg-subtle text-sub hover:text-main transition-colors cursor-pointer touch-manipulation"
              title="Previous Day"
              aria-label="Previous Day"
            >
              <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            
            <button
              onClick={() => onSelectDate(todayStr)}
              className={`px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-mono font-medium rounded-none transition-all cursor-pointer touch-manipulation ${
                isToday
                  ? 'bg-subtle text-main font-bold border border-main'
                  : 'text-sub hover:text-main'
              }`}
            >
              {isToday ? 'TODAY' : 'GO TO TODAY'}
            </button>

            <button
              onClick={handleNextDay}
              className="p-1 sm:p-1.5 rounded-none hover:bg-subtle text-sub hover:text-main transition-colors cursor-pointer touch-manipulation"
              title="Next Day"
              aria-label="Next Day"
            >
              <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>

          <div className="min-w-0 text-right sm:text-left">
            <div className="text-xs sm:text-sm font-bold text-main tracking-tight font-mono truncate">
              {formatDisplayDate(selectedDate)}
            </div>
            <div className="text-[11px] sm:text-xs text-sub font-mono">
              {totalCount === 0 
                ? 'No habits' 
                : `${completedCount}/${totalCount} completed`}
            </div>
          </div>
        </div>

        {/* Prominent Daily Progress Bar */}
        <div className="flex items-center gap-3 w-full sm:w-56 flex-shrink-0 pt-1 sm:pt-0 border-t border-subtle sm:border-t-0">
          <Progress
            value={completedCount}
            max={totalCount || 1}
            size="md"
            indicatorColor="#10B981"
            showLabel
          />
        </div>
      </div>
    </header>
  );
}
