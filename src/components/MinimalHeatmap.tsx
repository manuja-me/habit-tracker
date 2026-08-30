'use client';

import React, { useState, useMemo } from 'react';
import { Habit, HabitLog } from '../lib/types';
import { generateHeatmapData } from '../lib/utils/streaks';
import { formatDisplayDate } from '../lib/utils/date';
import { Activity, Info } from 'lucide-react';

interface MinimalHeatmapProps {
  habits: Habit[];
  logs: Record<string, HabitLog>;
}

export function MinimalHeatmap({ habits, logs }: MinimalHeatmapProps) {
  const [selectedHabitId, setSelectedHabitId] = useState<string>('all');
  const [hoveredDay, setHoveredDay] = useState<{
    date: string;
    count: number;
    total: number;
    completedHabits: string[];
  } | null>(null);

  const heatmapData = useMemo(() => {
    return generateHeatmapData(
      habits,
      logs,
      364,
      selectedHabitId === 'all' ? undefined : selectedHabitId
    );
  }, [habits, logs, selectedHabitId]);

  const weeks = useMemo(() => {
    const cols: typeof heatmapData[] = [];
    for (let i = 0; i < heatmapData.length; i += 7) {
      cols.push(heatmapData.slice(i, i + 7));
    }
    return cols;
  }, [heatmapData]);

  const activeDays = heatmapData.filter(d => d.count > 0).length;
  const totalCheckins = heatmapData.reduce((acc, d) => acc + d.count, 0);

  const getLevelStyle = (level: number) => {
    switch (level) {
      case 1:
        return 'bg-emerald-900/60 border-emerald-700/50';
      case 2:
        return 'bg-emerald-700 border-emerald-600';
      case 3:
        return 'bg-emerald-500 border-emerald-400';
      case 4:
        return 'bg-emerald-400 border-emerald-300';
      default:
        return 'bg-[var(--heatmap-empty)] border-subtle hover:border-main';
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-3.5 sm:px-6">
      <div className="p-3.5 sm:p-5 rounded-none bg-card border border-main transition-colors">
        {/* Header & Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-5">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <h2 className="text-xs sm:text-sm font-bold font-mono uppercase text-main">CONSISTENCY HEATMAP</h2>
            </div>
            <p className="text-[11px] sm:text-xs text-sub font-mono mt-0.5">
              {totalCheckins} logs across {activeDays} active days in past 364 days
            </p>
          </div>

          <select
            value={selectedHabitId}
            onChange={(e) => setSelectedHabitId(e.target.value)}
            className="w-full sm:w-auto text-xs font-mono font-medium bg-input text-main border border-main rounded-none px-3 py-2 sm:py-1.5 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
          >
            <option value="all">ALL HABITS</option>
            {habits.map((h) => (
              <option key={h.id} value={h.id}>
                {h.title.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Heatmap Grid */}
        <div className="overflow-x-auto -mx-3.5 px-3.5 sm:mx-0 sm:px-0 pb-2">
          <div className="flex gap-1 min-w-[700px] justify-between">
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-1">
                {week.map((day) => (
                  <div
                    key={day.date}
                    onClick={() => setHoveredDay(day)}
                    onMouseEnter={() => setHoveredDay(day)}
                    onMouseLeave={() => setHoveredDay(null)}
                    className={`w-3 h-3 rounded-none border transition-all duration-100 cursor-pointer touch-manipulation ${getLevelStyle(
                      day.level
                    )}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Footer: Legend & Tooltip detail */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 mt-4 pt-3 border-t border-subtle text-xs font-mono">
          <div className="text-main min-h-[1.5rem] flex items-center gap-2">
            {hoveredDay ? (
              <div className="flex items-center gap-2 animate-in fade-in duration-100 flex-wrap">
                <span className="font-bold text-main">
                  {formatDisplayDate(hoveredDay.date)}:
                </span>
                <span>
                  {hoveredDay.count} / {hoveredDay.total} completed
                </span>
                {hoveredDay.completedHabits.length > 0 && (
                  <span className="text-sub text-[11px] truncate max-w-xs">
                    ({hoveredDay.completedHabits.join(', ')})
                  </span>
                )}
              </div>
            ) : (
              <span className="text-sub flex items-center gap-1.5 text-[11px] sm:text-xs">
                <Info className="w-3.5 h-3.5 flex-shrink-0" /> Tap or hover any cell for details
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-sub text-[10px] sm:text-[11px]">
            <span>LESS</span>
            <div className="w-2.5 h-2.5 rounded-none bg-[var(--heatmap-empty)] border border-subtle" />
            <div className="w-2.5 h-2.5 rounded-none bg-emerald-900/60 border border-emerald-700/50" />
            <div className="w-2.5 h-2.5 rounded-none bg-emerald-700 border border-emerald-600" />
            <div className="w-2.5 h-2.5 rounded-none bg-emerald-500 border border-emerald-400" />
            <div className="w-2.5 h-2.5 rounded-none bg-emerald-400 border border-emerald-300" />
            <span>MORE</span>
          </div>
        </div>
      </div>
    </div>
  );
}
