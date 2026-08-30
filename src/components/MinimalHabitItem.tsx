'use client';

import React, { useState } from 'react';
import { 
  Check, 
  Flame, 
  MoreVertical, 
  Edit3, 
  Trash2, 
  Archive, 
  Plus, 
  Minus,
  Sparkles,
  TrendingUp
} from 'lucide-react';
import { Habit, HabitLog, HabitStats } from '../lib/types';
import { getHabitIcon, COLOR_PALETTES } from '../lib/utils/icons';

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
  const [isHovered, setIsHovered] = useState(false);

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
  const stepAmount = habit.target_value > 100 ? 250 : habit.target_value > 20 ? 5 : 1;
  const progressPercent = habit.type === 'number' 
    ? Math.min(100, Math.round((currentValue / habit.target_value) * 100))
    : (isCompleted ? 100 : 0);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowMenu(false);
      }}
      className={`group relative flex flex-col p-4 rounded-2xl transition-all duration-200 border ${
        isCompleted
          ? 'bg-neutral-900/40 border-neutral-800/60'
          : 'bg-neutral-900/80 border-neutral-800 hover:border-neutral-700'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left: Icon & Info */}
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {/* Custom Checkbox */}
          <button
            onClick={handleCheckboxClick}
            className={`relative flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150 active:scale-90 ${
              isCompleted
                ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/25 ring-2 ring-emerald-500/20'
                : 'border-2 border-neutral-700 hover:border-neutral-500 bg-neutral-950/60'
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
              backgroundColor: isCompleted ? 'rgba(16, 185, 129, 0.1)' : colorConfig.bg,
              color: isCompleted ? '#34D399' : colorConfig.text 
            }}
          >
            <IconComponent className="w-4 h-4" />
          </div>

          {/* Title & Frequency info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className={`text-sm font-medium tracking-tight truncate transition-colors ${
                isCompleted ? 'text-neutral-400 line-through' : 'text-neutral-100'
              }`}>
                {habit.title}
              </h3>
              
              {/* Streak Badge */}
              {stats.currentStreak > 0 && (
                <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Flame className="w-3 h-3 fill-amber-400" />
                  {stats.currentStreak}d
                </span>
              )}
            </div>

            {habit.description && (
              <p className="text-xs text-neutral-500 truncate mt-0.5 font-light">
                {habit.description}
              </p>
            )}
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Numeric Target Controls */}
          {habit.type === 'number' && (
            <div className="flex items-center gap-1.5 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
              <button
                onClick={(e) => handleIncrement(e, -stepAmount)}
                className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                title={`Minus ${stepAmount} ${habit.target_unit || ''}`}
              >
                <Minus className="w-3 h-3" />
              </button>

              <span className="text-xs font-mono font-medium px-1 min-w-[3.5rem] text-center text-neutral-200">
                {currentValue} / {habit.target_value} {habit.target_unit || ''}
              </span>

              <button
                onClick={(e) => handleIncrement(e, stepAmount)}
                className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                title={`Add ${stepAmount} ${habit.target_unit || ''}`}
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Quick Menu Button */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <div 
                className="absolute right-0 top-8 z-30 w-36 rounded-xl bg-neutral-950 border border-neutral-800 p-1 shadow-2xl animate-in fade-in zoom-in-95 duration-100"
              >
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onEdit(habit);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Habit
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDelete(habit.id);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Numeric Progress Bar (if measurable habit) */}
      {habit.type === 'number' && (
        <div className="w-full mt-3 bg-neutral-950 h-1 rounded-full overflow-hidden">
          <div 
            className="h-full transition-all duration-300 rounded-full"
            style={{ 
              width: `${progressPercent}%`,
              backgroundColor: isCompleted ? '#10B981' : habit.color
            }}
          />
        </div>
      )}
    </div>
  );
}
