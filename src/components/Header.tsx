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
      <div className="flex items-center justify-between gap-4 mb-5">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-none bg-emerald-500 flex items-center justify-center text-black font-bold border border-emerald-400">
            <Flame className="w-4 h-4 fill-black" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-main flex items-center gap-2 font-mono uppercase">
              Zenith
              <span className="text-[10px] font-mono font-bold tracking-widest px-1.5 py-0.5 rounded-none bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                IDE
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-none text-xs font-mono bg-card hover:bg-subtle border border-main text-sub hover:text-main transition-all cursor-pointer"
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
            className="p-2 rounded-none bg-card hover:bg-subtle border border-main text-sub hover:text-main transition-all flex items-center justify-center cursor-pointer"
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
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-none text-xs font-mono font-bold bg-emerald-500 hover:bg-emerald-400 text-black border border-emerald-400 shadow-xs transition-all active:translate-y-0.5 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>NEW HABIT</span>
          </button>
        </div>
      </div>

      {/* Date & Progress Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-none bg-card border border-main transition-colors">
        {/* Date Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-input rounded-none p-0.5 border border-subtle">
            <button
              onClick={handlePrevDay}
              className="p-1 rounded-none hover:bg-subtle text-sub hover:text-main transition-colors cursor-pointer"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => onSelectDate(todayStr)}
              className={`px-2.5 py-1 text-xs font-mono font-medium rounded-none transition-all cursor-pointer ${
                isToday
                  ? 'bg-subtle text-main font-bold border border-main'
                  : 'text-sub hover:text-main'
              }`}
            >
              {isToday ? 'TODAY' : 'GO TO TODAY'}
            </button>

            <button
              onClick={handleNextDay}
              className="p-1 rounded-none hover:bg-subtle text-sub hover:text-main transition-colors cursor-pointer"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div>
            <div className="text-sm font-bold text-main tracking-tight font-mono">
              {formatDisplayDate(selectedDate)}
            </div>
            <div className="text-xs text-sub font-mono">
              {totalCount === 0 
                ? 'No habits scheduled' 
                : `${completedCount}/${totalCount} completed`}
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
