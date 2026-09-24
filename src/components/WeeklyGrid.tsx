'use client';

import React from 'react';
import { Habit, HabitLog } from '../lib/types';
import { getWeekDays, formatDayName, formatShortDate, getTodayDateString, isHabitDueOnDate } from '../lib/utils/date';
import { getHabitIcon, COLOR_PALETTES } from '../lib/utils/icons';
import { isDaySuccessful } from '../lib/utils/streaks';
import { Check, ChevronLeft, ChevronRight, ShieldAlert, ShieldCheck } from 'lucide-react';
import { addDays, subDays } from 'date-fns';

interface WeeklyGridProps {
  habits: Habit[];
  logs: Record<string, HabitLog>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onToggle: (habitId: string, dateStr: string, completed?: boolean, value?: number) => void;
}

export function WeeklyGrid({
  habits,
  logs,
  selectedDate,
  onSelectDate,
  onToggle,
}: WeeklyGridProps) {
  const weekDays = getWeekDays(selectedDate);
  const todayStr = getTodayDateString();

  const handlePrevWeek = () => {
    const prev = subDays(new Date(selectedDate), 7);
    onSelectDate(prev.toISOString().split('T')[0]);
  };

  const handleNextWeek = () => {
    const next = addDays(new Date(selectedDate), 7);
    onSelectDate(next.toISOString().split('T')[0]);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-3.5 sm:px-6">
      <div className="p-3.5 sm:p-5 rounded-none bg-card border border-main transition-colors">
        {/* Week Header & Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-5 pb-3 border-b border-subtle">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black font-sans uppercase tracking-tight text-main">
                Weekly Overview
              </h2>
            </div>
            <p className="text-xs text-sub font-mono uppercase tracking-wider mt-0.5">
              {formatShortDate(weekDays[0])} – {formatShortDate(weekDays[6])}
            </p>
          </div>

          <div className="flex items-center justify-between sm:justify-start gap-2 bg-input p-1 sm:p-0.5 rounded-none border border-main shadow-xs">
            <button
              onClick={handlePrevWeek}
              className="w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-none hover:bg-subtle text-sub hover:text-main transition-colors cursor-pointer touch-manipulation active:scale-95"
              title="Previous Week"
              aria-label="Previous Week"
            >
              <ChevronLeft className="w-5 h-5 sm:w-4 sm:h-4" />
            </button>
            <button
              onClick={() => onSelectDate(todayStr)}
              className="h-11 sm:h-8 px-4 sm:px-3 text-xs font-mono font-bold text-sub hover:text-main cursor-pointer touch-manipulation flex items-center justify-center uppercase tracking-wider"
            >
              CURRENT WEEK
            </button>
            <button
              onClick={handleNextWeek}
              className="w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-none hover:bg-subtle text-sub hover:text-main transition-colors cursor-pointer touch-manipulation active:scale-95"
              title="Next Week"
              aria-label="Next Week"
            >
              <ChevronRight className="w-5 h-5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto -mx-3.5 px-3.5 sm:mx-0 sm:px-0 pb-2">
          <table className="w-full text-left border-collapse min-w-[580px]">
            <thead>
              <tr className="border-b border-main">
                <th className="pb-3 text-xs font-black font-sans text-sub uppercase tracking-wider sticky left-0 bg-card z-10 pr-3">
                  PROTOCOL
                </th>
                {weekDays.map((dStr) => {
                  const isToday = dStr === todayStr;
                  const isSelected = dStr === selectedDate;
                  return (
                    <th
                      key={dStr}
                      onClick={() => onSelectDate(dStr)}
                      className={`pb-3 text-center cursor-pointer transition-colors px-1 ${
                        isToday ? 'text-[#FF3B30] font-black' : isSelected ? 'text-main font-bold' : 'text-sub'
                      }`}
                    >
                      <div className="text-xs font-mono uppercase">{formatDayName(dStr)}</div>
                      <div className={`text-xs font-mono mt-0.5 inline-block px-2 sm:px-1.5 py-0.5 rounded-none ${
                        isToday ? 'bg-[#FF3B30]/10 text-[#FF3B30] font-black border border-[#FF3B30]/40' : ''
                      }`}>
                        {formatShortDate(dStr).split(' ')[1]}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {habits.map((habit) => {
                const isDont = habit.nature === 'dont';
                const IconComponent = getHabitIcon(habit.icon);
                const colorConfig = COLOR_PALETTES.find(c => c.hex.toLowerCase() === habit.color.toLowerCase()) || COLOR_PALETTES[0];

                return (
                  <tr key={habit.id} className="hover:bg-subtle/40 transition-colors">
                    {/* Habit Info (Sticky on scroll) */}
                    <td className="py-3 sm:py-3 pr-3 sticky left-0 bg-card z-10">
                      <div className="flex items-center gap-2.5 sm:gap-2.5 max-w-[150px] sm:max-w-[200px]">
                        <div 
                          className="w-8 h-8 sm:w-7 sm:h-7 rounded-none flex items-center justify-center flex-shrink-0 border border-subtle"
                          style={{ 
                            backgroundColor: isDont ? 'rgba(255, 59, 48, 0.12)' : colorConfig.bg, 
                            color: isDont ? '#FF3B30' : colorConfig.hex 
                          }}
                        >
                          <IconComponent className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                        </div>
                        <span className="text-xs font-sans font-black uppercase text-main tracking-tight truncate">
                          {habit.title}
                        </span>
                      </div>
                    </td>

                    {/* Weekday Checkboxes */}
                    {weekDays.map((dStr) => {
                      const isDue = isHabitDueOnDate(habit, dStr);
                      const log = logs[`${habit.id}_${dStr}`];
                      const isPassed = isDaySuccessful(habit, dStr, logs);

                      if (!isDue) {
                        return (
                          <td key={dStr} className="py-3 sm:py-3 text-center px-1">
                            <span className="inline-block w-2.5 h-2.5 rounded-none bg-subtle" title="Not scheduled" />
                          </td>
                        );
                      }

                      if (isDont) {
                        const isSlippedUp = log !== undefined && log.completed === false;
                        return (
                          <td key={dStr} className="py-3 sm:py-3 text-center px-1">
                            <button
                              onClick={() => onToggle(habit.id, dStr, isSlippedUp, isSlippedUp ? 0 : 1)}
                              className={`w-10 h-10 sm:w-8 sm:h-8 rounded-none inline-flex items-center justify-center transition-all duration-100 active:scale-90 cursor-pointer touch-manipulation border ${
                                isSlippedUp
                                  ? 'bg-[#FF3B30] text-white border-[#FF3B30]'
                                  : 'bg-card text-[#FF3B30] border-[#FF3B30] hover:bg-[#FF3B30]/10'
                              }`}
                              title={isSlippedUp ? 'Slipped up (Click to mark clean)' : 'Clean (Click if you indulged)'}
                              aria-label={`Toggle ${habit.title} for ${dStr}`}
                            >
                              {isSlippedUp ? (
                                <ShieldAlert className="w-5 h-5 sm:w-4 sm:h-4 stroke-[2.5]" />
                              ) : (
                                <ShieldCheck className="w-5 h-5 sm:w-4 sm:h-4 stroke-[2.5]" />
                              )}
                            </button>
                          </td>
                        );
                      }

                      const isCompleted = Boolean(log?.completed);
                      return (
                        <td key={dStr} className="py-3 sm:py-3 text-center px-1">
                          <button
                            onClick={() => onToggle(habit.id, dStr, !isCompleted, !isCompleted ? habit.target_value : 0)}
                            className={`w-10 h-10 sm:w-8 sm:h-8 rounded-none inline-flex items-center justify-center transition-all duration-100 active:scale-90 cursor-pointer touch-manipulation border ${
                              isCompleted
                                ? 'bg-[#FF3B30] text-white border-[#FF3B30]'
                                : 'border border-main hover:border-neutral-400 bg-input/70'
                            }`}
                            aria-label={`Toggle ${habit.title} for ${dStr}`}
                          >
                            <Check className={`w-5 h-5 sm:w-4 sm:h-4 stroke-[3] ${isCompleted ? 'opacity-100' : 'opacity-0'}`} />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
