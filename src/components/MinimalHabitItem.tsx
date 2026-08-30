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

  // Find color config or fallback
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

  // Step increments for numeric habits
  const stepAmount = habit.target_value >= 1000 ? 250 : habit.target_value >= 50 ? 10 : habit.target_value >= 20 ? 5 : 1;
  const progressPercent = habit.type === 'number' 
    ? Math.min(100, Math.round((currentValue / habit.target_value) * 100))
    : (isCompleted ? 100 : 0);

  // Quick preset chips for measurable habits
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
      className={`group relative flex flex-col p-4 sm:p-5 rounded-2xl transition-all duration-150 border ${
        isCompleted
          ? 'bg-card/70 border-emerald-500/30 shadow-xs'
          : 'bg-card border-main hover:border-hover shadow-xs'
      }`}
    >
      {/* Top Row: Checkbox, Title, Quick Actions */}
      <div className="flex items-center justify-between gap-3">
        {/* Left: Checkbox + Icon + Title */}
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {/* Custom Checkbox */}
          <button
            onClick={handleCheckboxClick}
            className={`relative flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150 active:scale-90 cursor-pointer ${
              isCompleted
                ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/25 ring-2 ring-emerald-500/30'
                : 'border-2 border-subtle hover:border-main bg-input'
            }`}
            aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
          >
            {isCompleted && (
              <Check className="w-4 h-4 stroke-[3] animate-in zoom-in-50 duration-150" />
            )}
          </button>

          {/* Icon Badge */}
          <div 
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105"
            style={{ 
              backgroundColor: isCompleted ? 'rgba(16, 185, 129, 0.15)' : colorConfig.bg,
              color: isCompleted ? '#10B981' : colorConfig.hex 
            }}
          >
            <IconComponent className="w-4 h-4" />
          </div>

          {/* Title & Description */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`text-sm font-semibold tracking-tight truncate transition-colors ${
                isCompleted ? 'text-main' : 'text-main'
              }`}>
                {habit.title}
              </h3>
              
              {/* Streak Badge */}
              {stats.currentStreak > 0 && (
                <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                  <Flame className="w-3 h-3 fill-amber-500" />
                  {stats.currentStreak}d streak
                </span>
              )}

              {isCompleted && (
                <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" />
                  Done
                </span>
              )}
            </div>

            {habit.description && (
              <p className="text-xs text-sub truncate mt-0.5 font-normal">
                {habit.description}
              </p>
            )}
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Quick Menu Button */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-lg text-sub hover:text-main hover:bg-subtle transition-colors cursor-pointer"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <div 
                className="absolute right-0 top-8 z-30 w-36 rounded-xl bg-card border border-main p-1 shadow-xl animate-in fade-in zoom-in-95 duration-100"
              >
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onEdit(habit);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-sub hover:text-main hover:bg-subtle rounded-lg transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Habit
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDelete(habit.id);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Measurable Progress Section */}
      {habit.type === 'number' && (
        <div className="mt-3.5 pt-3 border-t border-subtle/80 space-y-2">
          {/* Status Label & Stepper Controls */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-main font-mono text-xs sm:text-sm">
                {currentValue.toLocaleString()} <span className="text-sub font-normal">/ {habit.target_value.toLocaleString()} {habit.target_unit}</span>
              </span>
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-subtle text-sub border border-main">
                {progressPercent}%
              </span>
            </div>

            {/* Quick Add Presets & Steppers */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => handleIncrement(e, -stepAmount)}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-input hover:bg-subtle border border-main text-sub hover:text-main transition-colors cursor-pointer"
                title={`Subtract ${stepAmount}`}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              {presetSteps.map((amt) => (
                <button
                  key={amt}
                  onClick={(e) => handleIncrement(e, amt)}
                  className="px-2 py-1 rounded-lg text-[11px] font-mono font-medium bg-input hover:bg-subtle border border-main text-sub hover:text-main transition-colors cursor-pointer"
                >
                  +{amt}
                </button>
              ))}

              <button
                onClick={(e) => handleIncrement(e, stepAmount)}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-500 font-bold transition-colors cursor-pointer"
                title={`Add ${stepAmount}`}
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
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
