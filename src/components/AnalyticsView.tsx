'use client';

import React, { useMemo } from 'react';
import { Habit, HabitLog } from '../lib/types';
import { calculateHabitStats } from '../lib/utils/streaks';
import { getHabitIcon, COLOR_PALETTES } from '../lib/utils/icons';
import { 
  Flame, 
  Award, 
  TrendingUp, 
  CheckCircle2, 
  BarChart3, 
  PieChart,
  Calendar
} from 'lucide-react';
import { subDays, format, getDay } from 'date-fns';

interface AnalyticsViewProps {
  habits: Habit[];
  logs: Record<string, HabitLog>;
}

export function AnalyticsView({ habits, logs }: AnalyticsViewProps) {
  // Compute habit stats
  const statsList = useMemo(() => {
    return habits.map((h) => ({
      habit: h,
      stats: calculateHabitStats(h, logs),
    }));
  }, [habits, logs]);

  // Overall metrics
  const totalCompletions = useMemo(() => {
    return Object.values(logs).filter((l) => l.completed).length;
  }, [logs]);

  const bestStreak = useMemo(() => {
    return Math.max(0, ...statsList.map((s) => s.stats.longestStreak));
  }, [statsList]);

  const avg30DayRate = useMemo(() => {
    if (statsList.length === 0) return 0;
    const sum = statsList.reduce((acc, s) => acc + s.stats.completionRate30Days, 0);
    return Math.round(sum / statsList.length);
  }, [statsList]);

  // Day of week analysis (Mon=1, ..., Sun=0)
  const dayOfWeekPerformance = useMemo(() => {
    const dayCounts = [0, 0, 0, 0, 0, 0, 0]; // 0=Sun, 1=Mon...
    const dayTotals = [0, 0, 0, 0, 0, 0, 0];

    const today = new Date();
    for (let i = 0; i < 90; i++) {
      const d = subDays(today, i);
      const dStr = format(d, 'yyyy-MM-dd');
      const dayIdx = getDay(d);

      habits.forEach((h) => {
        dayTotals[dayIdx]++;
        if (logs[`${h.id}_${dStr}`]?.completed) {
          dayCounts[dayIdx]++;
        }
      });
    }

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return dayNames.map((name, idx) => {
      const rate = dayTotals[idx] > 0 ? Math.round((dayCounts[idx] / dayTotals[idx]) * 100) : 0;
      return { day: name, rate };
    });
  }, [habits, logs]);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 space-y-6">
      {/* Top 3 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Consistency */}
        <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              30-Day Adherence
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono tracking-tight text-white">
              {avg30DayRate}%
            </span>
            <span className="text-xs text-emerald-400">overall score</span>
          </div>
        </div>

        {/* Best Streak */}
        <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Longest Streak
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Flame className="w-4 h-4 fill-amber-400" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono tracking-tight text-white">
              {bestStreak}
            </span>
            <span className="text-xs text-neutral-400">consecutive days</span>
          </div>
        </div>

        {/* Total Check-ins */}
        <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Total Completions
            </span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono tracking-tight text-white">
              {totalCompletions}
            </span>
            <span className="text-xs text-neutral-400">habits logged</span>
          </div>
        </div>
      </div>

      {/* Habit by Habit Breakdown & Weekday Adherence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Habit Ranking by Streak & Consistency */}
        <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 backdrop-blur-md">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            Habit Performance Breakdown
          </h3>

          <div className="space-y-3">
            {statsList.map(({ habit, stats }) => {
              const IconComp = getHabitIcon(habit.icon);
              const color = COLOR_PALETTES.find(c => c.hex.toLowerCase() === habit.color.toLowerCase()) || COLOR_PALETTES[0];

              return (
                <div key={habit.id} className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/80">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div 
                        className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: color.bg, color: color.text }}
                      >
                        <IconComp className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-medium text-neutral-200 truncate">
                        {habit.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-amber-400 flex items-center gap-1 font-semibold">
                        <Flame className="w-3 h-3 fill-amber-400" /> {stats.currentStreak}d
                      </span>
                      <span className="text-neutral-500">|</span>
                      <span className="text-neutral-300 font-semibold">{stats.completionRate30Days}%</span>
                    </div>
                  </div>

                  <div className="w-full bg-neutral-900 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${stats.completionRate30Days}%`,
                        backgroundColor: habit.color 
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Day of Week Adherence Chart */}
        <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 backdrop-blur-md flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              Day of Week Consistency (Past 90 Days)
            </h3>
            <p className="text-xs text-neutral-400 mb-6">
              Identify which days of the week you are most consistent.
            </p>
          </div>

          <div className="grid grid-cols-7 gap-2 items-end h-40 pt-4 pb-2 border-b border-neutral-800">
            {dayOfWeekPerformance.map((item) => (
              <div key={item.day} className="flex flex-col items-center gap-2 h-full justify-end">
                <span className="text-[10px] font-mono text-neutral-400">{item.rate}%</span>
                <div 
                  className="w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-emerald-600 to-teal-400 transition-all duration-500"
                  style={{ height: `${Math.max(8, item.rate)}%` }}
                />
                <span className="text-[11px] font-medium text-neutral-300">{item.day}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
