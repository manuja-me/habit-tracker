'use client';

import React, { useState } from 'react';
import { 
  Check, 
  Flame, 
  Edit3, 
  Trash2, 
  Plus, 
  Minus, 
  AlertCircle, 
  GripVertical,
  ShieldCheck,
  ShieldAlert,
  RotateCcw
} from 'lucide-react';
import { Habit, HabitLog, HabitStats } from '../lib/types';
import { getHabitIcon, COLOR_PALETTES } from '../lib/utils/icons';
import { playCheckSound, playUncheckSound } from '../lib/utils/sound';
import { calculateWeaningStatus } from '../lib/utils/tapering';
import { Progress } from './ui/progress';

interface MinimalHabitItemProps {
  habit: Habit;
  log?: HabitLog;
  stats: HabitStats;
  allLogs?: Record<string, HabitLog>;
  dateStr: string;
  isFocused?: boolean;
  isDraggable?: boolean;
  onToggle: (habitId: string, dateStr: string, completed?: boolean, value?: number) => void;
  onEdit: (habit: Habit) => void;
  onDelete: (habitId: string) => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
}

export function MinimalHabitItem({
  habit,
  log,
  stats,
  allLogs = {},
  dateStr,
  isFocused = false,
  isDraggable = true,
  onToggle,
  onEdit,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: MinimalHabitItemProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const isDont = habit.nature === 'dont';
  // For 'dont' habits, clean by default unless explicitly marked completed: false (slip-up)
  const isSlippedUp = isDont && log !== undefined && log.completed === false;
  const isCompleted = isDont ? !isSlippedUp : Boolean(log?.completed);

  const weaningStatus = calculateWeaningStatus(habit, allLogs);

  const currentValue = log?.value ?? (isCompleted ? habit.target_value : 0);
  const IconComponent = getHabitIcon(habit.icon);

  const colorConfig = COLOR_PALETTES.find(c => c.hex.toLowerCase() === habit.color.toLowerCase()) || COLOR_PALETTES[0];

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDont) {
      // Toggle between Clean (completed: true) and Slipped Up (completed: false)
      const nextCompleted = isSlippedUp; // if slipped up, make clean (true); if clean, make slip-up (false)
      if (nextCompleted) {
        playCheckSound();
      } else {
        playUncheckSound();
      }
      onToggle(habit.id, dateStr, nextCompleted, nextCompleted ? 0 : 1);
    } else {
      const nextCompleted = !isCompleted;
      if (nextCompleted) {
        playCheckSound();
      } else {
        playUncheckSound();
      }
      onToggle(habit.id, dateStr, nextCompleted, nextCompleted ? habit.target_value : 0);
    }
  };

  const handleIncrement = (e: React.MouseEvent, amount: number) => {
    e.stopPropagation();
    const nextVal = Math.max(0, currentValue + amount);
    const nextCompleted = nextVal >= habit.target_value;
    if (nextCompleted && !isCompleted) {
      playCheckSound();
    } else if (!nextCompleted && isCompleted) {
      playUncheckSound();
    }
    onToggle(habit.id, dateStr, nextCompleted, nextVal);
  };

  const stepAmount = habit.target_value >= 1000 ? 250 : habit.target_value >= 50 ? 10 : habit.target_value >= 20 ? 5 : 1;
  const progressPercent = habit.type === 'number' 
    ? Math.min(100, Math.round((currentValue / habit.target_value) * 100))
    : (isCompleted ? 100 : 0);

  return (
    <div
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`group relative flex flex-col p-3.5 sm:p-3.5 rounded-none transition-all duration-150 border font-mono ${
        isFocused ? 'border-l-4 border-l-emerald-500 bg-card/90 ring-1 ring-emerald-500/30' : ''
      } ${
        isDont
          ? isSlippedUp
            ? 'bg-rose-500/10 border-rose-500/40'
            : 'bg-card border-emerald-500/20 hover:border-emerald-500/40'
          : isCompleted
          ? 'bg-card/50 border-emerald-500/30'
          : 'bg-card border-main hover:border-emerald-500/40'
      }`}
    >
      {/* Main Row: Checkbox/Toggle, Title & Streak, Action Buttons */}
      <div className="flex items-center justify-between gap-3 sm:gap-3">
        {/* Left Side: Drag handle + Checkbox/Status + Icon + Title */}
        <div className="flex items-center gap-3 sm:gap-2.5 min-w-0 flex-1">
          {/* Drag Handle */}
          <div 
            className="cursor-grab active:cursor-grabbing text-sub/40 hover:text-main transition-colors flex items-center justify-center p-1 sm:p-0.5 touch-manipulation"
            title="Drag to reorder"
          >
            <GripVertical className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </div>

          {/* Large Tactile Status Button (48px on mobile for effortless tapping) */}
          {isDont ? (
            <button
              onClick={handleCheckboxClick}
              className={`relative flex-shrink-0 w-12 h-12 sm:w-8 sm:h-8 rounded-none flex items-center justify-center transition-all duration-100 active:scale-90 cursor-pointer touch-manipulation border ${
                isSlippedUp
                  ? 'bg-rose-500 text-black border-rose-400 shadow-sm'
                  : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/25'
              }`}
              title={isSlippedUp ? 'Click to undo slip-up' : 'Auto-clean. Click if you indulged today'}
              aria-label={isSlippedUp ? 'Slipped up' : 'Clean'}
            >
              {isSlippedUp ? (
                <ShieldAlert className="w-6 h-6 sm:w-4.5 sm:h-4.5 stroke-[2.5]" />
              ) : (
                <ShieldCheck className="w-6 h-6 sm:w-4.5 sm:h-4.5 stroke-[2.5]" />
              )}
            </button>
          ) : (
            <button
              onClick={handleCheckboxClick}
              className={`relative flex-shrink-0 w-12 h-12 sm:w-8 sm:h-8 rounded-none flex items-center justify-center transition-all duration-100 active:scale-90 cursor-pointer touch-manipulation ${
                isCompleted
                  ? 'bg-emerald-500 text-black border border-emerald-400 shadow-sm'
                  : 'border border-main hover:border-emerald-500 bg-input/70'
              }`}
              aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
            >
              {isCompleted && (
                <Check className="w-6 h-6 sm:w-4.5 sm:h-4.5 stroke-[3]" />
              )}
            </button>
          )}

          {/* Category Icon */}
          <div 
            className="flex-shrink-0 w-10 h-10 sm:w-8 sm:h-8 rounded-none flex items-center justify-center border border-subtle"
            style={{ 
              backgroundColor: isDont 
                ? isSlippedUp ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.12)'
                : isCompleted ? 'rgba(16, 185, 129, 0.12)' : colorConfig.bg,
              color: isDont
                ? isSlippedUp ? '#F43F5E' : '#10B981'
                : isCompleted ? '#10B981' : colorConfig.hex 
            }}
          >
            <IconComponent className="w-5 h-5 sm:w-4 sm:h-4" />
          </div>

          {/* Title and Streak */}
          <div className="min-w-0 flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-2 sm:gap-2 flex-wrap">
              <span 
                onClick={handleCheckboxClick}
                className={`text-sm sm:text-sm font-bold tracking-tight truncate cursor-pointer select-none transition-colors ${
                  isDont
                    ? isSlippedUp ? 'text-rose-400 line-through' : 'text-main'
                    : isCompleted ? 'text-sub line-through opacity-80' : 'text-main'
                }`}
              >
                {habit.title}
              </span>

              {/* DON'T Habit Status Badge */}
              {isDont && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs sm:text-[10px] font-bold border ${
                  isSlippedUp 
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' 
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                }`}>
                  {isSlippedUp ? 'SLIPPED UP' : 'CLEAN TODAY'}
                </span>
              )}
              
              {/* Clean Streak Tag */}
              {stats.currentStreak > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs sm:text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <Flame className="w-3.5 h-3.5 sm:w-3 sm:h-3 fill-amber-500" />
                  {stats.currentStreak}d {isDont ? 'clean' : ''}
                </span>
              )}
            </div>

            {habit.description && (
              <p className="text-xs sm:text-[11px] text-sub truncate mt-0.5">
                {habit.description}
              </p>
            )}
          </div>
        </div>

        {/* Right Side: Quick Action Buttons (Edit / Delete) */}
        <div className="flex items-center gap-1.5 sm:gap-1 flex-shrink-0">
          {isConfirmingDelete ? (
            <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 p-1.5 animate-in fade-in duration-100">
              <span className="text-xs sm:text-[11px] text-rose-500 font-bold px-1">DELETE?</span>
              <button
                onClick={() => onDelete(habit.id)}
                className="px-3 py-1.5 sm:px-2 sm:py-0.5 text-xs font-bold bg-rose-500 text-black hover:bg-rose-400 cursor-pointer touch-manipulation min-h-[38px] sm:min-h-0 flex items-center justify-center"
              >
                YES
              </button>
              <button
                onClick={() => setIsConfirmingDelete(false)}
                className="px-2.5 py-1.5 sm:px-1.5 sm:py-0.5 text-xs text-sub hover:text-main cursor-pointer touch-manipulation min-h-[38px] sm:min-h-0 flex items-center justify-center"
              >
                NO
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => onEdit(habit)}
                className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center text-sub hover:text-main hover:bg-subtle transition-colors cursor-pointer touch-manipulation rounded-none active:scale-95"
                title="Edit habit"
                aria-label="Edit habit"
              >
                <Edit3 className="w-5 h-5 sm:w-4 sm:h-4" />
              </button>
              <button
                onClick={() => setIsConfirmingDelete(true)}
                className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center text-sub hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer touch-manipulation rounded-none active:scale-95"
                title="Delete habit"
                aria-label="Delete habit"
              >
                <Trash2 className="w-5 h-5 sm:w-4 sm:h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Numeric Progress Section (Clean & uncluttered with large touch steppers) */}
      {habit.type === 'number' && (
        <div className="mt-3.5 pt-3 border-t border-subtle/60 space-y-2.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-xs sm:text-xs">
              <span className="font-bold text-main">
                {currentValue.toLocaleString()}
              </span>
              <span className="text-sub">
                / {habit.target_value.toLocaleString()} {habit.target_unit}
              </span>
              <span className="text-xs sm:text-[10px] font-bold text-sub px-2 py-0.5 border border-subtle bg-subtle/50">
                {progressPercent}%
              </span>
            </div>

            {/* Clean Mobile-Friendly Inline Steppers (44px on mobile) */}
            <div className="flex items-center gap-2 sm:gap-1.5">
              <button
                onClick={(e) => handleIncrement(e, -stepAmount)}
                className="w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center bg-input hover:bg-subtle active:bg-subtle border border-main text-sub hover:text-main transition-colors cursor-pointer touch-manipulation active:scale-95"
                title={`-${stepAmount}`}
                aria-label={`-${stepAmount}`}
              >
                <Minus className="w-5 h-5 sm:w-3.5 sm:h-3.5" />
              </button>

              <button
                onClick={(e) => handleIncrement(e, stepAmount)}
                className="h-11 px-4 sm:h-8 sm:px-3 text-xs sm:text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 active:bg-emerald-500/30 border border-emerald-500/30 text-emerald-500 transition-colors cursor-pointer touch-manipulation active:scale-95 flex items-center justify-center"
                title={`+${stepAmount}`}
                aria-label={`+${stepAmount}`}
              >
                +{stepAmount}
              </button>
            </div>
          </div>

          {/* Clean Progress Bar */}
          <Progress
            value={currentValue}
            max={habit.target_value}
            size="sm"
            indicatorColor={isCompleted ? '#10B981' : habit.color}
          />
        </div>
      )}

      {/* Weaning & Addiction Tapering Bar */}
      {isDont && weaningStatus.enabled && (
        <div className="mt-3.5 pt-3 border-t border-subtle/60 space-y-2.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-xs sm:text-xs font-mono">
              <span className="font-bold text-rose-400">
                STAGE {weaningStatus.currentLevel}/{weaningStatus.totalLevels}:
              </span>
              <span className="text-main">
                {weaningStatus.daysClean} / {weaningStatus.targetDaysClean}d Clean
              </span>
              <span className="text-xs sm:text-[10px] font-bold text-sub px-2 py-0.5 border border-subtle bg-subtle/50">
                {weaningStatus.progressPercent}%
              </span>
            </div>

            <div className="text-xs sm:text-xs font-mono font-bold">
              {weaningStatus.isGoalReached ? (
                <span className="text-emerald-400">🎯 STAGE COMPLETE</span>
              ) : (
                <span className="text-sub">{weaningStatus.targetDaysClean - weaningStatus.daysClean}D TO NEXT STAGE</span>
              )}
            </div>
          </div>

          <Progress
            value={weaningStatus.daysClean}
            max={weaningStatus.targetDaysClean}
            size="sm"
            indicatorColor={weaningStatus.isGoalReached ? '#10B981' : '#F43F5E'}
          />

          <div className="flex items-center justify-between text-xs sm:text-[10px] text-sub font-mono">
            <span className="uppercase">Protocol: {habit.weaning?.protocol || 'EXPONENTIAL'} FADING</span>
            <span>
              {weaningStatus.nextLevelTarget ? `Next Goal: ${weaningStatus.nextLevelTarget}d Clean` : 'Freedom'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
