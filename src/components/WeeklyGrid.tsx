'use client';

import React from 'react';
import { Habit, HabitLog } from '../lib/types';
import { getWeekDays, formatDayName, formatShortDate, getTodayDateString, isHabitDueOnDate } from '../lib/utils/date';
import { getHabitIcon, COLOR_PALETTES } from '../lib/utils/icons';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
          <div>
            <h2 className="text-xs sm:text-sm font-bold font-mono uppercase text-main">WEEKLY TRACKER</h2>
            <p className="text-[11px] sm:text-xs text-sub font-mono">
              {formatShortDate(weekDays[0])} – {formatShortDate(weekDays[6])}
            </p>
          </div>

          <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-input p-0.5 rounded-none border border-subtle">
            <button
              onClick={handlePrevWeek}
              className="p-1 sm:p-1.5 rounded-none hover:bg-subtle text-sub hover:text-main transition-colors cursor-pointer touch-manipulation"
              title="Previous Week"
              aria-label="Previous Week"
            >
              <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              onClick={() => onSelectDate(todayStr)}
              className="px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-mono font-medium text-sub hover:text-main cursor-pointer touch-manipulation"
            >
              CURRENT WEEK
            </button>
            <button
              onClick={handleNextWeek}
              className="p-1 sm:p-1.5 rounded-none hover:bg-subtle text-sub hover:text-main transition-colors cursor-pointer touch-manipulation"
              title="Next Week"
              aria-label="Next Week"
            >
              <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto -mx-3.5 px-3.5 sm:mx-0 sm:px-0 pb-2">
          <table className="w-full text-left border-collapse min-w-[540px]">
            <thead>
              <tr className="border-b border-subtle">
                <th className="pb-3 text-[11px] sm:text-xs font-bold font-mono text-sub uppercase tracking-wider sticky left-0 bg-card z-10 pr-3">
                  HABIT
                </th>
                {weekDays.map((dStr) => {
                  const isToday = dStr === todayStr;
                  const isSelected = dStr === selectedDate;
                  return (
                    <th
                      key={dStr}
                      onClick={() => onSelectDate(dStr)}
                      className={`pb-3 text-center cursor-pointer transition-colors px-1 ${
                        isToday ? 'text-emerald-500 font-bold' : isSelected ? 'text-main font-bold' : 'text-sub'
                      }`}
                    >
                      <div className="text-[10px] font-mono uppercase">{formatDayName(dStr)}</div>
                      <div className={`text-[11px] sm:text-xs font-mono mt-0.5 inline-block px-1 sm:px-1.5 py-0.5 rounded-none ${
                        isToday ? 'bg-emerald-500/15 text-emerald-500 font-bold border border-emerald-500/30' : ''
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
                const IconComponent = getHabitIcon(habit.icon);
                const colorConfig = COLOR_PALETTES.find(c => c.hex.toLowerCase() === habit.color.toLowerCase()) || COLOR_PALETTES[0];

                return (
                  <tr key={habit.id} className="hover:bg-subtle/40 transition-colors">
                    {/* Habit Info (Sticky on scroll) */}
                    <td className="py-2.5 sm:py-3 pr-3 sticky left-0 bg-card z-10">
                      <div className="flex items-center gap-2 sm:gap-2.5 max-w-[140px] sm:max-w-[200px]">
                        <div 
                          className="w-6 h-6 rounded-none flex items-center justify-center flex-shrink-0 border border-subtle"
                          style={{ backgroundColor: colorConfig.bg, color: colorConfig.hex }}
                        >
                          <IconComponent className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-mono font-medium text-main truncate">
                          {habit.title}
                        </span>
                      </div>
                    </td>

                    {/* Weekday Checkboxes */}
                    {weekDays.map((dStr) => {
                      const log = logs[`${habit.id}_${dStr}`];
                      const isCompleted = Boolean(log?.completed);
                      const isDue = isHabitDueOnDate(habit, dStr);

                      if (!isDue) {
                        return (
                          <td key={dStr} className="py-2.5 sm:py-3 text-center px-1">
                            <span className="inline-block w-2 h-2 rounded-none bg-subtle" title="Not scheduled" />
                          </td>
                        );
                      }

                      return (
                        <td key={dStr} className="py-2.5 sm:py-3 text-center px-1">
                          <button
                            onClick={() => onToggle(habit.id, dStr, !isCompleted, !isCompleted ? habit.target_value : 0)}
                            className={`w-7 h-7 sm:w-6 sm:h-6 rounded-none inline-flex items-center justify-center transition-all duration-100 active:scale-90 cursor-pointer touch-manipulation ${
                              isCompleted
                                ? 'bg-emerald-500 text-black border border-emerald-400'
                                : 'border border-subtle hover:border-main bg-input text-transparent'
                            }`}
                            aria-label={`Toggle ${habit.title} for ${dStr}`}
                          >
                            <Check className={`w-3.5 h-3.5 stroke-[3] ${isCompleted ? 'opacity-100' : 'opacity-0'}`} />
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
