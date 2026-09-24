'use client';

import React, { useState, useMemo } from 'react';
import { Habit, HabitLog } from '../lib/types';
import { generateHeatmapData, calculateHabitStats } from '../lib/utils/streaks';
import { formatDisplayDate } from '../lib/utils/date';
import { getHabitIcon, COLOR_PALETTES } from '../lib/utils/icons';
import { Activity, Flame, Info, Layers } from 'lucide-react';

interface MinimalHeatmapProps {
  habits: Habit[];
  logs: Record<string, HabitLog>;
}

export function MinimalHeatmap({ habits, logs }: MinimalHeatmapProps) {
  const [hoveredDay, setHoveredDay] = useState<{
    date: string;
    count: number;
    total: number;
    completedHabits: string[];
    habitTitle?: string;
  } | null>(null);

  const activeHabits = useMemo(() => {
    return habits.filter((h) => !h.archived);
  }, [habits]);

  // 1. Overall Heatmap Data (All Habits)
  const overallHeatmapData = useMemo(() => {
    return generateHeatmapData(habits, logs, 364);
  }, [habits, logs]);

  const overallWeeks = useMemo(() => {
    const cols: typeof overallHeatmapData[] = [];
    for (let i = 0; i < overallHeatmapData.length; i += 7) {
      cols.push(overallHeatmapData.slice(i, i + 7));
    }
    return cols;
  }, [overallHeatmapData]);

  const activeDays = overallHeatmapData.filter((d) => d.count > 0 && d.total > 0).length;
  const totalCheckins = overallHeatmapData.reduce((acc, d) => acc + (d.total > 0 ? d.count : 0), 0);

  // 2. Individual Heatmap Data per Habit
  const individualHeatmaps = useMemo(() => {
    return activeHabits.map((habit) => {
      const data = generateHeatmapData(habits, logs, 364, habit.id);
      const cols: typeof data[] = [];
      for (let i = 0; i < data.length; i += 7) {
        cols.push(data.slice(i, i + 7));
      }
      const stats = calculateHabitStats(habit, logs);
      const habitColor = COLOR_PALETTES.find((c) => c.hex.toLowerCase() === habit.color.toLowerCase()) || COLOR_PALETTES[0];
      return {
        habit,
        stats,
        weeks: cols,
        habitColor,
      };
    });
  }, [activeHabits, habits, logs]);

  const getOverallLevelStyle = (level: number) => {
    switch (level) {
      case 1:
        return 'bg-[#FF3B30]/25 border-[#FF3B30]/40';
      case 2:
        return 'bg-[#FF3B30]/50 border-[#FF3B30]/65';
      case 3:
        return 'bg-[#FF3B30]/75 border-[#FF3B30]/85';
      case 4:
        return 'bg-[#FF3B30] border-[#FF3B30]';
      default:
        return 'bg-[var(--heatmap-empty)] border-subtle hover:border-main';
    }
  };

  const getIndividualDayStyle = (level: number, hexColor: string) => {
    if (level === 0) {
      return 'bg-[var(--heatmap-empty)] border-subtle hover:border-main';
    }
    // High intensity fill matching habit color or Swiss Red
    return 'border border-white/20';
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-3.5 sm:px-6 space-y-4 sm:space-y-6">
      {/* 1. TOP SECTION: Overall Consistency Heatmap (All Habits) */}
      <div className="p-4 sm:p-5 rounded-none bg-card border border-main transition-colors space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-subtle pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black font-sans uppercase tracking-tight text-main">
                Consistency Heatmap
              </h2>
            </div>
            <p className="text-xs text-sub font-mono uppercase tracking-wider mt-0.5">
              {totalCheckins} TOTAL LOGS ACROSS {activeDays} ACTIVE DAYS (PAST 52 WEEKS)
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-sub text-[10px] font-mono uppercase tracking-wider self-end sm:self-auto">
            <span>LESS</span>
            <div className="w-2.5 h-2.5 rounded-none bg-[var(--heatmap-empty)] border border-subtle" />
            <div className="w-2.5 h-2.5 rounded-none bg-[#FF3B30]/25 border border-[#FF3B30]/40" />
            <div className="w-2.5 h-2.5 rounded-none bg-[#FF3B30]/50 border border-[#FF3B30]/65" />
            <div className="w-2.5 h-2.5 rounded-none bg-[#FF3B30]/75 border border-[#FF3B30]/85" />
            <div className="w-2.5 h-2.5 rounded-none bg-[#FF3B30] border border-[#FF3B30]" />
            <span>MORE</span>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="overflow-x-auto -mx-3.5 px-3.5 sm:mx-0 sm:px-0 pb-2">
          <div className="flex gap-1 min-w-[700px] justify-between">
            {overallWeeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-1">
                {week.map((day) => (
                  <div
                    key={day.date}
                    onClick={() => setHoveredDay({ ...day, habitTitle: 'All Habits' })}
                    onMouseEnter={() => setHoveredDay({ ...day, habitTitle: 'All Habits' })}
                    onMouseLeave={() => setHoveredDay(null)}
                    className={`w-3 h-3 rounded-none border transition-all duration-100 cursor-pointer touch-manipulation ${getOverallLevelStyle(
                      day.level
                    )}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Hover detail */}
        <div className="pt-2 border-t border-subtle text-xs font-mono text-main min-h-[1.75rem] flex items-center">
          {hoveredDay ? (
            <div className="flex items-center gap-2 animate-in fade-in duration-100 flex-wrap">
              <span className="font-bold text-[#FF3B30]">
                {formatDisplayDate(hoveredDay.date)}:
              </span>
              {hoveredDay.total === 0 ? (
                <span className="text-sub">No habits active on this date</span>
              ) : (
                <span>
                  {hoveredDay.count} / {hoveredDay.total} completed
                </span>
              )}
              {hoveredDay.completedHabits && hoveredDay.completedHabits.length > 0 && (
                <span className="text-sub text-[11px] truncate max-w-sm">
                  ({hoveredDay.completedHabits.join(', ')})
                </span>
              )}
            </div>
          ) : (
            <span className="text-sub flex items-center gap-1.5 text-[11px] sm:text-xs">
              <Info className="w-3.5 h-3.5 flex-shrink-0" /> Tap or hover any day block to inspect completions
            </span>
          )}
        </div>
      </div>

      {/* 2. BOTTOM SECTION: Individual Habit Heatmaps */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#FF3B30]" />
            <h3 className="text-xs sm:text-sm font-bold font-mono uppercase text-main">
              INDIVIDUAL HABIT HEATMAPS
            </h3>
          </div>
          <span className="text-[11px] font-mono text-sub">
            {activeHabits.length} HABITS
          </span>
        </div>

        {individualHeatmaps.map(({ habit, stats, weeks, habitColor }) => {
          const IconComp = getHabitIcon(habit.icon);

          return (
            <div
              key={habit.id}
              className="p-3.5 sm:p-4 rounded-none bg-card border border-main transition-colors space-y-3"
            >
              {/* Individual Habit Header */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-6 h-6 rounded-none flex items-center justify-center border border-subtle flex-shrink-0"
                    style={{ backgroundColor: habitColor.bg, color: habitColor.hex }}
                  >
                    <IconComp className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs sm:text-sm font-bold font-mono text-main truncate">
                    {habit.title}
                  </span>
                  <span className="text-[10px] font-mono text-sub border border-subtle px-1.5 py-0.5 bg-input hidden xs:inline">
                    {habit.category.toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono flex-shrink-0">
                  <span className="text-amber-500 font-bold flex items-center gap-1 text-[11px]">
                    <Flame className="w-3 h-3 fill-amber-500" /> {stats.currentStreak}D STREAK
                  </span>
                  <span className="text-sub">|</span>
                  <span className="text-[#FF3B30] font-bold text-[11px]">
                    {stats.completionRate30Days}% 30D
                  </span>
                  <span className="text-sub">|</span>
                  <span className="text-sub text-[11px]">
                    {stats.totalCompletions} LOGS
                  </span>
                </div>
              </div>

              {/* Individual Heatmap Grid */}
              <div className="overflow-x-auto -mx-3.5 px-3.5 sm:mx-0 sm:px-0 pb-1">
                <div className="flex gap-1 min-w-[700px] justify-between">
                  {weeks.map((week, wIdx) => (
                    <div key={wIdx} className="flex flex-col gap-1">
                      {week.map((day) => {
                        const isDone = day.count > 0 && day.total > 0;
                        return (
                          <div
                            key={day.date}
                            onClick={() =>
                              setHoveredDay({
                                ...day,
                                habitTitle: habit.title,
                              })
                            }
                            onMouseEnter={() =>
                              setHoveredDay({
                                ...day,
                                habitTitle: habit.title,
                              })
                            }
                            onMouseLeave={() => setHoveredDay(null)}
                            className={`w-3 h-3 rounded-none border transition-all duration-100 cursor-pointer touch-manipulation ${getIndividualDayStyle(
                              day.level,
                              habit.color
                            )}`}
                            style={{
                              backgroundColor: isDone ? habit.color : undefined,
                              borderColor: isDone ? `${habit.color}CC` : undefined,
                            }}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
