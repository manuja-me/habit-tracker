'use client';

import React, { useState } from 'react';
import { 
  Check, 
  Flame, 
  MoreVertical, 
  Edit3, 
  Trash2, 
  Plus, 
  Minus,
  CheckCircle2
} from 'lucide-react';
import { Habit, HabitLog, HabitStats } from '../lib/types';
import { getHabitIcon, COLOR_PALETTES } from '../lib/utils/icons';
import { Progress } from './ui/progress';

interface MinimalHabitItemProps {
  habit: Habit;
  log?: HabitLog;
  stats: HabitStats;
  dateStr: string;
  onToggle: (habitId: string, dateStr: string, completed?: boolean, value?: number) => void;
  onEdit: (habit: Habit) => void;
  onDelete: (habitId: string) => void;
}

export function MinimalHabitItem({
  habit,
  log,
  stats,
  dateStr,
  onToggle,
  onEdit,
  onDelete,
}: MinimalHabitItemProps) {
  const [showMenu, setShowMenu] = useState(false);

  const isCompleted = Boolean(log?.completed);
  const currentValue = log?.value ?? (isCompleted ? habit.target_value : 0);
  const IconComponent = getHabitIcon(habit.icon);

  const colorConfig = COLOR_PALETTES.find(c => c.hex.toLowerCase() === habit.color.toLowerCase()) || COLOR_PALETTES[0];

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(habit.id, dateStr, !isCompleted, !isCompleted ? habit.target_value : 0);
  };

  const handleIncrement = (e: React.MouseEvent, amount: number) => {
    e.stopPropagation();
    const nextVal = Math.max(0, currentValue + amount);
    const completed = nextVal >= habit.target_value;
    onToggle(habit.id, dateStr, completed, nextVal);
  };

  const stepAmount = habit.target_value >= 1000 ? 250 : habit.target_value >= 50 ? 10 : habit.target_value >= 20 ? 5 : 1;
  const progressPercent = habit.type === 'number' 
    ? Math.min(100, Math.round((currentValue / habit.target_value) * 100))
    : (isCompleted ? 100 : 0);

  const presetSteps = habit.target_value >= 1000 
    ? [250, 500, 1000] 
    : habit.target_value >= 50 
    ? [5, 10, 25] 
    : habit.target_value >= 10 
    ? [1, 2, 5] 
    : [1];

  return (
    <div
      onMouseLeave={() => setShowMenu(false)}
      className={`group relative flex flex-col p-3.5 sm:p-4 rounded-none transition-all duration-150 border ${
        isCompleted
          ? 'bg-card/70 border-emerald-500/40'
          : 'bg-card border-main hover:border-hover'
      }`}
    >
      {/* Top Row: Checkbox, Title, Quick Actions */}
      <div className="flex items-center justify-between gap-2.5 sm:gap-3">
        {/* Left: Checkbox + Icon + Title */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          {/* Sharp Checkbox */}
          <button
            onClick={handleCheckboxClick}
            className={`relative flex-shrink-0 w-7 h-7 rounded-none flex items-center justify-center transition-all duration-100 active:scale-95 cursor-pointer touch-manipulation ${
              isCompleted
                ? 'bg-emerald-500 text-black border border-emerald-400'
                : 'border border-main hover:border-emerald-500 bg-input'
            }`}
            aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
          >
            {isCompleted && (
              <Check className="w-4 h-4 stroke-[3]" />
            )}
          </button>

          {/* Icon Badge */}
          <div 
            className="flex-shrink-0 w-7 h-7 rounded-none flex items-center justify-center border border-subtle"
            style={{ 
              backgroundColor: isCompleted ? 'rgba(16, 185, 129, 0.15)' : colorConfig.bg,
              color: isCompleted ? '#10B981' : colorConfig.hex 
            }}
          >
            <IconComponent className="w-3.5 h-3.5" />
          </div>

          {/* Title & Description */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-bold font-mono tracking-tight truncate text-main">
                {habit.title}
              </h3>
              
              {/* Streak Badge */}
              {stats.currentStreak > 0 && (
                <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-none text-[10px] font-mono font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                  <Flame className="w-3 h-3 fill-amber-500" />
                  {stats.currentStreak}D
                </span>
              )}

              {isCompleted && (
                <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-none text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                  DONE
                </span>
              )}
            </div>

            {habit.description && (
              <p className="text-[11px] font-mono text-sub truncate mt-0.5">
                {habit.description}
              </p>
            )}
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {/* Quick Menu Button */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-none text-sub hover:text-main hover:bg-subtle transition-colors cursor-pointer touch-manipulation"
              aria-label="Habit options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <div 
                className="absolute right-0 top-7 z-30 w-36 rounded-none bg-card border border-main p-1 shadow-2xl animate-in fade-in duration-100"
              >
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onEdit(habit);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-mono text-sub hover:text-main hover:bg-subtle rounded-none transition-colors cursor-pointer touch-manipulation"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  EDIT
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDelete(habit.id);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-mono text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-none transition-colors cursor-pointer touch-manipulation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  DELETE
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Measurable Progress Section */}
      {habit.type === 'number' && (
        <div className="mt-3 pt-2.5 border-t border-subtle space-y-2">
          {/* Status Label & Stepper Controls */}
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="font-bold text-main font-mono text-xs">
                {currentValue.toLocaleString()} <span className="text-sub font-normal">/ {habit.target_value.toLocaleString()} {habit.target_unit}</span>
              </span>
              <span className="px-1 py-0.5 rounded-none text-[10px] font-mono font-bold bg-subtle text-sub border border-main">
                {progressPercent}%
              </span>
            </div>

            {/* Quick Add Presets & Steppers */}
            <div className="flex items-center gap-1 flex-wrap sm:flex-nowrap">
              <button
                onClick={(e) => handleIncrement(e, -stepAmount)}
                className="w-7 h-7 sm:w-6 sm:h-6 rounded-none flex items-center justify-center bg-input hover:bg-subtle active:bg-subtle border border-main text-sub hover:text-main transition-colors cursor-pointer touch-manipulation"
                title={`Subtract ${stepAmount}`}
                aria-label={`Subtract ${stepAmount}`}
              >
                <Minus className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
              </button>

              {presetSteps.map((amt) => (
                <button
                  key={amt}
                  onClick={(e) => handleIncrement(e, amt)}
                  className="h-7 sm:h-6 px-2 sm:px-1.5 rounded-none text-[10px] font-mono font-medium bg-input hover:bg-subtle active:bg-subtle border border-main text-sub hover:text-main transition-colors cursor-pointer touch-manipulation"
                >
                  +{amt}
                </button>
              ))}

              <button
                onClick={(e) => handleIncrement(e, stepAmount)}
                className="w-7 h-7 sm:w-6 sm:h-6 rounded-none flex items-center justify-center bg-emerald-500/15 hover:bg-emerald-500/25 active:bg-emerald-500/30 border border-emerald-500/30 text-emerald-500 font-bold transition-colors cursor-pointer touch-manipulation"
                title={`Add ${stepAmount}`}
                aria-label={`Add ${stepAmount}`}
              >
                <Plus className="w-3.5 h-3.5 sm:w-3 sm:h-3 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* High-Contrast Visual Progress Bar */}
          <Progress
            value={currentValue}
            max={habit.target_value}
            size="md"
            indicatorColor={isCompleted ? '#10B981' : habit.color}
          />
        </div>
      )}
    </div>
  );
}
