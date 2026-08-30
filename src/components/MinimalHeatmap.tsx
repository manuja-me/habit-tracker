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

  // Generate 52 weeks (364 days)
  const heatmapData = useMemo(() => {
    return generateHeatmapData(
      habits,
      logs,
      364,
      selectedHabitId === 'all' ? undefined : selectedHabitId
    );
  }, [habits, logs, selectedHabitId]);

  // Group into 52 columns of 7 days
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
        return 'bg-emerald-400 border-emerald-300 shadow-xs shadow-emerald-400/30';
      default:
        return 'bg-[var(--heatmap-empty)] border-subtle hover:border-main';
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6">
      <div className="p-4 sm:p-6 rounded-2xl bg-card border border-main backdrop-blur-md shadow-xs transition-colors">
        {/* Header & Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              <h2 className="text-base font-semibold text-main">Consistency Heatmap</h2>
            </div>
            <p className="text-xs text-sub mt-0.5">
              {totalCheckins} check-ins across {activeDays} active days in the past year
            </p>
          </div>

          {/* Habit filter selector */}
          <select
            value={selectedHabitId}
            onChange={(e) => setSelectedHabitId(e.target.value)}
            className="text-xs font-medium bg-input text-main border border-main rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
          >
            <option value="all">All Habits Combined</option>
            {habits.map((h) => (
              <option key={h.id} value={h.id}>
                {h.title}
              </option>
            ))}
          </select>
        </div>

        {/* Heatmap Grid */}
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-1 min-w-[700px] justify-between">
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-1">
                {week.map((day) => (
                  <div
                    key={day.date}
                    onMouseEnter={() => setHoveredDay(day)}
                    onMouseLeave={() => setHoveredDay(null)}
                    className={`w-3 h-3 rounded-[3px] border transition-all duration-100 cursor-pointer ${getLevelStyle(
                      day.level
                    )}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Footer: Legend & Tooltip detail */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4 pt-3 border-t border-subtle text-xs">
          {/* Active Hover Tooltip */}
          <div className="text-main min-h-[1.5rem] flex items-center gap-2">
            {hoveredDay ? (
              <div className="flex items-center gap-2 animate-in fade-in duration-100">
                <span className="font-semibold text-main">
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
              <span className="text-sub flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" /> Hover or tap any cell to view day details
              </span>
            )}
          </div>

          {/* Shading Legend */}
          <div className="flex items-center gap-1.5 text-sub text-[11px]">
            <span>Less</span>
            <div className="w-2.5 h-2.5 rounded-[2px] bg-[var(--heatmap-empty)] border border-subtle" />
            <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-900/60 border border-emerald-700/50" />
            <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-700 border border-emerald-600" />
            <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-500 border border-emerald-400" />
            <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-400 border border-emerald-300" />
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
