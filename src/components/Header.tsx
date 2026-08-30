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
  ChevronRight 
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
  completedCount: number;
  totalCount: number;
}

export function Header({
  selectedDate,
  onSelectDate,
  onOpenAddModal,
  onOpenSyncModal,
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
    <header className="w-full max-w-4xl mx-auto pt-6 pb-4 px-4 sm:px-6">
      {/* Top Navbar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-black font-bold">
            <Flame className="w-5 h-5 fill-black" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-main flex items-center gap-2">
              Zenith
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                PRO
              </span>
            </h1>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Cloud Sync Status */}
          <button
            onClick={onOpenSyncModal}
            title={isCloudReady ? 'Cloud Synced — Click for details' : 'Local Storage Mode'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-card hover:bg-subtle border border-main text-sub hover:text-main transition-all cursor-pointer"
          >
            {isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-500" />
            ) : isCloudReady ? (
              <Cloud className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <CloudOff className="w-3.5 h-3.5 text-muted-custom" />
            )}
            <span className="hidden sm:inline">
              {isSyncing ? 'Syncing...' : isCloudReady ? 'Cloud Synced' : 'Local Mode'}
            </span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-card hover:bg-subtle border border-main text-sub hover:text-main transition-all flex items-center justify-center cursor-pointer"
            title={`Theme: ${theme.toUpperCase()} (Click to toggle Light / Dark / OLED)`}
          >
            {theme === 'light' ? (
              <Sun className="w-4 h-4 text-amber-500" />
            ) : theme === 'oled' ? (
              <Moon className="w-4 h-4 text-purple-400" />
            ) : (
              <Moon className="w-4 h-4 text-neutral-300" />
            )}
          </button>

          {/* Add Habit Button */}
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-black shadow-md shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Habit</span>
          </button>
        </div>
      </div>

      {/* Date & Progress Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-card border border-main backdrop-blur-md shadow-xs transition-colors">
        {/* Date Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-input rounded-xl p-1 border border-subtle">
            <button
              onClick={handlePrevDay}
              className="p-1.5 rounded-lg hover:bg-subtle text-sub hover:text-main transition-colors cursor-pointer"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => onSelectDate(todayStr)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                isToday
                  ? 'bg-subtle text-main font-semibold shadow-xs'
                  : 'text-sub hover:text-main'
              }`}
            >
              {isToday ? 'Today' : 'Back to Today'}
            </button>

            <button
              onClick={handleNextDay}
              className="p-1.5 rounded-lg hover:bg-subtle text-sub hover:text-main transition-colors cursor-pointer"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div>
            <div className="text-sm sm:text-base font-semibold text-main tracking-tight">
              {formatDisplayDate(selectedDate)}
            </div>
            <div className="text-xs text-sub">
              {totalCount === 0 
                ? 'No habits scheduled for this day' 
                : `${completedCount} of ${totalCount} completed`}
            </div>
          </div>
        </div>

        {/* Prominent Daily Progress Bar */}
        <div className="flex items-center gap-3 w-full sm:w-56 flex-shrink-0">
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
