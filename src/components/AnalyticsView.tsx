'use client';

import React, { useMemo } from 'react';
import { Habit, HabitLog } from '../lib/types';
import { calculateHabitStats, calculateMilestones } from '../lib/utils/streaks';
import { getHabitIcon, COLOR_PALETTES } from '../lib/utils/icons';
import { 
  Flame, 
  TrendingUp, 
  CheckCircle2, 
  BarChart3, 
  Calendar,
  Award,
  ShieldCheck,
  Zap,
  Crown,
  Lock
} from 'lucide-react';
import { subDays, format, getDay } from 'date-fns';
import { Progress } from './ui/progress';

interface AnalyticsViewProps {
  habits: Habit[];
  logs: Record<string, HabitLog>;
}

export function AnalyticsView({ habits, logs }: AnalyticsViewProps) {
  const statsList = useMemo(() => {
    return habits.map((h) => ({
      habit: h,
      stats: calculateHabitStats(h, logs),
    }));
  }, [habits, logs]);

  const totalCompletions = useMemo(() => {
    return Object.values(logs).filter((l) => l.completed).length;
  }, [logs]);

  const bestStreak = useMemo(() => {
    return Math.max(0, ...statsList.map((s) => s.stats.longestStreak));
  }, [statsList]);

  const milestones = useMemo(() => {
    return calculateMilestones(bestStreak);
  }, [bestStreak]);

  const avg30DayRate = useMemo(() => {
    if (statsList.length === 0) return 0;
    const sum = statsList.reduce((acc, s) => acc + s.stats.completionRate30Days, 0);
    return Math.round(sum / statsList.length);
  }, [statsList]);

  const dayOfWeekPerformance = useMemo(() => {
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
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

    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return dayNames.map((name, idx) => {
      const rate = dayTotals[idx] > 0 ? Math.round((dayCounts[idx] / dayTotals[idx]) * 100) : 0;
      return { day: name, rate };
    });
  }, [habits, logs]);

  const getMilestoneIcon = (iconName: string) => {
    switch (iconName) {
      case 'Flame': return Flame;
      case 'ShieldCheck': return ShieldCheck;
      case 'Zap': return Zap;
      case 'Crown': return Crown;
      default: return Award;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-3.5 sm:px-6 space-y-4 sm:space-y-6">
      {/* Top 3 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Consistency */}
        <div className="p-4 sm:p-5 rounded-none bg-card border border-main transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider text-sub">
              30D ADHERENCE
            </span>
            <div className="p-1.5 rounded-none bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-main">
              {avg30DayRate}%
            </span>
            <span className="text-xs font-mono text-emerald-500">score</span>
          </div>
        </div>

        {/* Best Streak */}
        <div className="p-4 sm:p-5 rounded-none bg-card border border-main transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider text-sub">
              BEST STREAK
            </span>
            <div className="p-1.5 rounded-none bg-amber-500/15 text-amber-500 border border-amber-500/30">
              <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-amber-500" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-main">
              {bestStreak}
            </span>
            <span className="text-xs font-mono text-sub">days</span>
          </div>
        </div>

        {/* Total Check-ins */}
        <div className="p-4 sm:p-5 rounded-none bg-card border border-main transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider text-sub">
              TOTAL LOGS
            </span>
            <div className="p-1.5 rounded-none bg-indigo-500/15 text-indigo-500 border border-indigo-500/30">
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-main">
              {totalCompletions}
            </span>
            <span className="text-xs font-mono text-sub">check-ins</span>
          </div>
        </div>
      </div>

      {/* Target Milestone Badges */}
      <div className="p-4 sm:p-5 rounded-none bg-card border border-main space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold font-mono uppercase text-main flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            TARGET MILESTONES & ACHIEVEMENTS
          </h3>
          <span className="text-[10px] font-mono text-sub">
            {milestones.filter(m => m.unlocked).length} OF {milestones.length} UNLOCKED
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {milestones.map((m) => {
            const IconComp = getMilestoneIcon(m.iconName);
            return (
              <div 
                key={m.id}
                className={`p-3 rounded-none border transition-all ${
                  m.unlocked 
                    ? 'bg-input border-emerald-500/40 shadow-xs' 
                    : 'bg-input/40 border-subtle opacity-65'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div 
                    className="w-7 h-7 flex items-center justify-center rounded-none border"
                    style={{ 
                      backgroundColor: m.unlocked ? `${m.color}20` : 'transparent',
                      borderColor: m.unlocked ? `${m.color}60` : 'var(--border-subtle)',
                      color: m.unlocked ? m.color : 'var(--text-sub)'
                    }}
                  >
                    <IconComp className="w-3.5 h-3.5" />
                  </div>
                  {m.unlocked ? (
                    <span className="text-[9px] font-bold text-emerald-500 border border-emerald-500/30 px-1 py-0.2 bg-emerald-500/10">
                      UNLOCKED
                    </span>
                  ) : (
                    <span className="text-[9px] text-sub flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" /> {m.days}D
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-main truncate">{m.title}</div>
                  <div className="text-[9px] text-sub truncate">{m.subtitle}</div>
                </div>

                <div className="mt-2">
                  <Progress 
                    value={m.progressPercent} 
                    max={100} 
                    size="sm" 
                    indicatorColor={m.unlocked ? m.color : '#64748B'} 
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Habit Breakdown & Weekday Adherence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Habit Ranking */}
        <div className="p-4 sm:p-5 rounded-none bg-card border border-main transition-colors">
          <h3 className="text-xs font-bold font-mono uppercase text-main mb-3 sm:mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            HABIT BREAKDOWN
          </h3>

          <div className="space-y-2.5 sm:space-y-3">
            {statsList.map(({ habit, stats }) => {
              const IconComp = getHabitIcon(habit.icon);
              const color = COLOR_PALETTES.find(c => c.hex.toLowerCase() === habit.color.toLowerCase()) || COLOR_PALETTES[0];

              return (
                <div key={habit.id} className="p-2.5 sm:p-3 rounded-none bg-input border border-subtle space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div 
                        className="w-5 h-5 rounded-none flex items-center justify-center flex-shrink-0 border border-subtle"
                        style={{ backgroundColor: color.bg, color: color.hex }}
                      >
                        <IconComp className="w-3 h-3" />
                      </div>
                      <span className="text-xs font-bold font-mono text-main truncate">
                        {habit.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-mono flex-shrink-0">
                      <span className="text-amber-500 flex items-center gap-1 font-bold text-[11px] sm:text-xs">
                        <Flame className="w-3 h-3 fill-amber-500" /> {stats.currentStreak}D
                      </span>
                      <span className="text-sub">|</span>
                      <span className="text-main font-bold text-[11px] sm:text-xs">{stats.completionRate30Days}%</span>
                    </div>
                  </div>

                  <Progress
                    value={stats.completionRate30Days}
                    max={100}
                    size="sm"
                    indicatorColor={habit.color}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Day of Week Adherence */}
        <div className="p-4 sm:p-5 rounded-none bg-card border border-main transition-colors flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold font-mono uppercase text-main mb-2 sm:mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              WEEKDAY CONSISTENCY (90D)
            </h3>
            <p className="text-[11px] sm:text-xs font-mono text-sub mb-4 sm:mb-6">
              Activity breakdown by day of the week.
            </p>
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2 items-end h-36 sm:h-40 pt-4 pb-2 border-b border-subtle">
            {dayOfWeekPerformance.map((item) => (
              <div key={item.day} className="flex flex-col items-center gap-1.5 sm:gap-2 h-full justify-end">
                <span className="text-[9px] sm:text-[10px] font-mono text-sub">{item.rate}%</span>
                <div 
                  className="w-full max-w-[28px] rounded-none bg-gradient-to-t from-emerald-600 to-teal-400 transition-all duration-300"
                  style={{ height: `${Math.max(8, item.rate)}%` }}
                />
                <span className="text-[9px] sm:text-[10px] font-mono font-bold text-main">{item.day}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
