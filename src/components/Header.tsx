'use client';

import React from 'react';
import { 
  Plus, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { useHabitStore } from '../lib/store';
import { formatDisplayDate, getTodayDateString, formatDate, parseDate } from '../lib/utils/date';
import { addDays, subDays } from 'date-fns';
import { Progress } from './ui/progress';

interface HeaderProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onOpenAddModal: () => void;
  onOpenSettingsModal: () => void;
  completedCount: number;
  totalCount: number;
}

export function Header({
  selectedDate,
  onSelectDate,
  onOpenAddModal,
  onOpenSettingsModal,
  completedCount,
  totalCount,
}: HeaderProps) {
  const { isSyncing, syncError } = useHabitStore();

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
    <header className="w-full max-w-4xl mx-auto pt-6 pb-2 px-4 sm:px-6">
      {/* Top Bar: Brand, Action & Settings */}
      <div className="flex items-center justify-between gap-4 mb-4">
        {/* Brand */}
        <div className="flex items-center gap-2.5 select-none">
          <div className="w-6 h-6 bg-[#FF3B30] flex items-center justify-center text-white font-black text-xs">
            ✚
          </div>
          <span className="text-base font-black tracking-tight uppercase font-sans text-main">
            Zenith
          </span>
        </div>

        {/* Essential Actions: + New Habit and Single Settings Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 h-9 px-3.5 text-xs font-sans font-black tracking-tight uppercase bg-[#FF3B30] hover:bg-[#E02D24] text-white transition-all active:scale-95 cursor-pointer touch-manipulation"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>New Habit</span>
          </button>

          <button
            onClick={onOpenSettingsModal}
            className="relative flex items-center justify-center w-9 h-9 border border-main bg-card hover:bg-subtle text-sub hover:text-main transition-colors cursor-pointer touch-manipulation active:scale-95"
            title="Settings & Advanced Features"
            aria-label="Settings"
          >
            {isSyncing ? (
              <RefreshCw className="w-4 h-4 animate-spin text-[#FF3B30]" />
            ) : (
              <Settings className="w-4 h-4" />
            )}
            {syncError && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500" />
            )}
          </button>
        </div>
      </div>

      {/* Date & Progress Bar */}
      <div className="p-4 bg-card border border-main flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Date Navigator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-input border border-subtle">
            <button
              onClick={handlePrevDay}
              className="w-8 h-8 flex items-center justify-center text-sub hover:text-main hover:bg-subtle transition-colors cursor-pointer"
              title="Previous Day"
              aria-label="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => onSelectDate(todayStr)}
              className={`h-8 px-2.5 text-xs font-mono font-bold transition-colors cursor-pointer ${
                isToday
                  ? 'bg-subtle text-main border-x border-subtle'
                  : 'text-sub hover:text-main'
              }`}
            >
              TODAY
            </button>
            <button
              onClick={handleNextDay}
              className="w-8 h-8 flex items-center justify-center text-sub hover:text-main hover:bg-subtle transition-colors cursor-pointer"
              title="Next Day"
              aria-label="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div>
            <h1 className="text-sm sm:text-base font-black font-sans uppercase tracking-tight text-main">
              {formatDisplayDate(selectedDate)}
            </h1>
            <p className="text-[11px] font-mono text-sub">
              {totalCount === 0
                ? 'No habits today'
                : `${completedCount} of ${totalCount} completed`}
            </p>
          </div>
        </div>

        {/* Minimal Progress Bar */}
        <div className="flex items-center gap-3 sm:w-48">
          <div className="flex-1">
            <Progress
              value={completedCount}
              max={totalCount || 1}
              size="sm"
              indicatorColor="#FF3B30"
              showLabel={false}
            />
          </div>
          <span className="text-xs font-mono font-bold text-main w-9 text-right">
            {percentage}%
          </span>
        </div>
      </div>
    </header>
  );
}
