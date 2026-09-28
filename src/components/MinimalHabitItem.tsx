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
  const isSlippedUp = isDont && log !== undefined && log.completed === false;
  const isCompleted = isDont ? !isSlippedUp : Boolean(log?.completed);

  const weaningStatus = calculateWeaningStatus(habit, allLogs);
  const currentValue = log?.value ?? (isCompleted ? habit.target_value : 0);
  const IconComponent = getHabitIcon(habit.icon);
  const colorConfig = COLOR_PALETTES.find(c => c.hex.toLowerCase() === habit.color.toLowerCase()) || COLOR_PALETTES[0];

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDont) {
      const nextCompleted = isSlippedUp;
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
      className={`group relative flex flex-col p-3.5 sm:p-4 rounded-none transition-all duration-150 border ${
        isDont
          ? isSlippedUp
            ? 'bg-[#FF3B30]/10 border-[#FF3B30]/30'
            : 'bg-card border-main hover:border-subtle'
          : isCompleted
          ? 'bg-card/70 border-main'
          : 'bg-card border-main hover:border-subtle'
      }`}
    >
      {/* Main Row */}
      <div className="flex items-center justify-between gap-3">
        {/* Left Side */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Drag Handle */}
          <div 
            className="cursor-grab active:cursor-grabbing text-sub/30 group-hover:text-sub transition-colors flex items-center justify-center p-0.5"
            title="Drag to reorder"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </div>

          {/* Checkbox / Status Button */}
          {isDont ? (
            <button
              onClick={handleCheckboxClick}
              className={`relative flex-shrink-0 w-8 h-8 rounded-none flex items-center justify-center transition-all duration-100 active:scale-95 cursor-pointer touch-manipulation border ${
                isSlippedUp
                  ? 'bg-[#FF3B30] text-white border-[#FF3B30]'
                  : 'bg-input text-[#FF3B30] border-main hover:border-[#FF3B30]'
              }`}
              title={isSlippedUp ? 'Slipped up (Click to reset)' : 'Clean today'}
              aria-label={isSlippedUp ? 'Slipped up' : 'Clean'}
            >
              {isSlippedUp ? (
                <ShieldAlert className="w-4 h-4 stroke-[2.5]" />
              ) : (
                <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
              )}
            </button>
          ) : (
            <button
              onClick={handleCheckboxClick}
              className={`relative flex-shrink-0 w-8 h-8 rounded-none flex items-center justify-center transition-all duration-100 active:scale-95 cursor-pointer touch-manipulation border ${
                isCompleted
                  ? 'bg-[#FF3B30] text-white border-[#FF3B30]'
                  : 'border border-main hover:border-neutral-400 bg-input'
              }`}
              aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
            >
              {isCompleted && (
                <Check className="w-4 h-4 stroke-[3]" />
              )}
            </button>
          )}

          {/* Category Icon */}
          <div 
            className="flex-shrink-0 w-8 h-8 rounded-none flex items-center justify-center border border-subtle"
            style={{ 
              backgroundColor: isDont 
                ? isSlippedUp ? 'rgba(255, 59, 48, 0.15)' : 'rgba(255, 59, 48, 0.08)'
                : isCompleted ? 'rgba(255, 59, 48, 0.08)' : colorConfig.bg,
              color: isDont
                ? isSlippedUp ? '#FF3B30' : '#FF3B30'
                : isCompleted ? '#FF3B30' : colorConfig.hex 
            }}
          >
            <IconComponent className="w-3.5 h-3.5" />
          </div>

          {/* Title & Streak */}
          <div className="min-w-0 flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-2 flex-wrap">
              <span 
                onClick={handleCheckboxClick}
                className={`text-sm sm:text-sm font-bold font-sans tracking-tight uppercase truncate cursor-pointer select-none transition-colors ${
                  isDont
                    ? isSlippedUp ? 'text-[#FF3B30] line-through' : 'text-main'
                    : isCompleted ? 'text-sub line-through opacity-70' : 'text-main'
                }`}
              >
                {habit.title}
              </span>

              {/* Status Badge for DONT habits */}
              {isDont && (
                <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono border ${
                  isSlippedUp 
                    ? 'bg-[#FF3B30]/20 text-[#FF3B30] border-[#FF3B30]/40' 
                    : 'bg-input text-sub border-subtle'
                }`}>
                  {isSlippedUp ? 'Slipped Up' : 'Clean'}
                </span>
              )}
              
              {/* Streak Badge */}
              {stats.currentStreak > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono font-bold text-[#FF3B30] bg-[#FF3B30]/5 border border-[#FF3B30]/20">
                  <Flame className="w-3 h-3 fill-[#FF3B30]" />
                  <span>{stats.currentStreak}d</span>
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

        {/* Right Side: Quick Action Buttons (Edit / Delete) */}
        <div className="flex items-center gap-1 flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          {isConfirmingDelete ? (
            <div className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/30 p-1">
              <span className="text-[10px] text-rose-500 font-bold px-1">DELETE?</span>
              <button
                onClick={() => onDelete(habit.id)}
                className="px-2 py-0.5 text-[10px] font-bold bg-rose-500 text-white hover:bg-rose-600 cursor-pointer"
              >
                YES
              </button>
              <button
                onClick={() => setIsConfirmingDelete(false)}
                className="px-1.5 py-0.5 text-[10px] text-sub hover:text-main cursor-pointer"
              >
                NO
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => onEdit(habit)}
                className="w-7 h-7 flex items-center justify-center text-sub hover:text-main hover:bg-subtle transition-colors cursor-pointer"
                title="Edit habit"
                aria-label="Edit habit"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsConfirmingDelete(true)}
                className="w-7 h-7 flex items-center justify-center text-sub hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title="Delete habit"
                aria-label="Delete habit"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Numeric Progress Section */}
      {habit.type === 'number' && (
        <div className="mt-3 pt-2.5 border-t border-subtle/50 space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-main font-mono">
                {currentValue.toLocaleString()}
              </span>
              <span className="text-sub font-mono text-[11px]">
                / {habit.target_value.toLocaleString()} {habit.target_unit}
              </span>
              <span className="text-[10px] font-mono text-sub">
                ({progressPercent}%)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => handleIncrement(e, -stepAmount)}
                className="w-7 h-7 flex items-center justify-center bg-input hover:bg-subtle border border-main text-sub hover:text-main transition-colors cursor-pointer touch-manipulation"
                title={`-${stepAmount}`}
                aria-label={`-${stepAmount}`}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={(e) => handleIncrement(e, stepAmount)}
                className="h-7 px-2.5 text-xs font-mono font-bold bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 border border-[#FF3B30]/30 text-[#FF3B30] transition-colors cursor-pointer touch-manipulation flex items-center justify-center"
                title={`+${stepAmount}`}
                aria-label={`+${stepAmount}`}
              >
                +{stepAmount}
              </button>
            </div>
          </div>

          <Progress
            value={currentValue}
            max={habit.target_value}
            size="sm"
            indicatorColor={isCompleted ? '#FF3B30' : habit.color}
          />
        </div>
      )}

      {/* Weaning & Addiction Tapering Bar */}
      {isDont && weaningStatus.enabled && (
        <div className="mt-3 pt-2.5 border-t border-subtle/50 space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs font-mono">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-rose-400 font-bold">
                Level {weaningStatus.currentLevel}/{weaningStatus.totalLevels}:
              </span>
              <span className="text-main">
                {weaningStatus.daysClean}/{weaningStatus.targetDaysClean}d clean
              </span>
            </div>

            <div className="text-[11px]">
              {weaningStatus.isGoalReached ? (
                <span className="text-[#FF3B30] font-bold">Stage Complete</span>
              ) : (
                <span className="text-sub">{weaningStatus.targetDaysClean - weaningStatus.daysClean}d left</span>
              )}
            </div>
          </div>

          <Progress
            value={weaningStatus.daysClean}
            max={weaningStatus.targetDaysClean}
            size="sm"
            indicatorColor={weaningStatus.isGoalReached ? '#FF3B30' : '#F43F5E'}
          />
        </div>
      )}
    </div>
  );
}
