'use client';

import React from 'react';
import { Habit, HabitLog } from '../lib/types';
import { getWeekDays, formatDayName, formatShortDate, getTodayDateString, isHabitDueOnDate } from '../lib/utils/date';
import { getHabitIcon, COLOR_PALETTES } from '../lib/utils/icons';
import { Check, Flame, ChevronLeft, ChevronRight } from 'lucide-react';
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
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6">
      <div className="p-4 sm:p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 backdrop-blur-md">
        {/* Week Header & Navigation */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-semibold text-white">Weekly Tracker</h2>
            <p className="text-xs text-neutral-400">
              {formatShortDate(weekDays[0])} – {formatShortDate(weekDays[6])}
            </p>
          </div>

          <div className="flex items-center gap-2 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
            <button
              onClick={handlePrevWeek}
              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
              title="Previous Week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => onSelectDate(todayStr)}
              className="px-2.5 py-1 text-xs font-medium text-neutral-300 hover:text-white"
            >
              Current Week
            </button>
            <button
              onClick={handleNextWeek}
              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
              title="Next Week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto pb-2">
          <table className="w-full text-left border-collapse min-w-[580px]">
            <thead>
              <tr className="border-b border-neutral-800/80">
                <th className="pb-3 text-xs font-semibold text-neutral-400 uppercase tracking-wider w-1/3">
                  Habit
                </th>
                {weekDays.map((dStr) => {
                  const isToday = dStr === todayStr;
                  const isSelected = dStr === selectedDate;
                  return (
                    <th
                      key={dStr}
                      onClick={() => onSelectDate(dStr)}
                      className={`pb-3 text-center cursor-pointer transition-colors ${
                        isToday ? 'text-emerald-400 font-bold' : isSelected ? 'text-white' : 'text-neutral-400'
                      }`}
                    >
                      <div className="text-[11px] uppercase tracking-wider">{formatDayName(dStr)}</div>
                      <div className={`text-xs mt-0.5 inline-block px-1.5 py-0.5 rounded-md ${
                        isToday ? 'bg-emerald-500/20 text-emerald-300 font-bold' : ''
                      }`}>
                        {formatShortDate(dStr).split(' ')[1]}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/40">
              {habits.map((habit) => {
                const IconComponent = getHabitIcon(habit.icon);
                const colorConfig = COLOR_PALETTES.find(c => c.hex.toLowerCase() === habit.color.toLowerCase()) || COLOR_PALETTES[0];

                return (
                  <tr key={habit.id} className="hover:bg-neutral-800/20 transition-colors">
                    {/* Habit Info */}
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div 
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: colorConfig.bg, color: colorConfig.text }}
                        >
                          <IconComponent className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-medium text-neutral-200 truncate">
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
                          <td key={dStr} className="py-3 text-center">
                            <span className="inline-block w-2 h-2 rounded-full bg-neutral-800" title="Not scheduled" />
                          </td>
                        );
                      }

                      return (
                        <td key={dStr} className="py-3 text-center">
                          <button
                            onClick={() => onToggle(habit.id, dStr, !isCompleted, !isCompleted ? habit.target_value : 0)}
                            className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all duration-150 active:scale-90 ${
                              isCompleted
                                ? 'bg-emerald-500 text-black shadow-sm'
                                : 'border border-neutral-700 hover:border-neutral-500 bg-neutral-950/40 text-transparent'
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
