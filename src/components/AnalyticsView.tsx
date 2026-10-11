'use client';

import React, { useMemo, useState } from 'react';
import { Habit, HabitLog } from '../lib/types';
import { calculateHabitStats, isDaySuccessful } from '../lib/utils/streaks';
import { isHabitDueOnDate, getTodayDateString } from '../lib/utils/date';
import { getHabitIcon, COLOR_PALETTES } from '../lib/utils/icons';
import {
  calculateGamificationProfile,
  GamificationProfile,
  AchievementCategory,
} from '../lib/utils/gamification';
import {
  Flame,
  TrendingUp,
  CheckCircle2,
  Award,
  ShieldCheck,
  Shield,
  Zap,
  Crown,
  Lock,
  Star,
  Medal,
  Trophy,
  Sparkles,
  Activity,
  Check,
  Target,
} from 'lucide-react';
import { subDays, format, getDay } from 'date-fns';
import { Progress } from './ui/progress';

interface AnalyticsViewProps {
  habits: Habit[];
  logs: Record<string, HabitLog>;
  profile?: GamificationProfile;
}

export function AnalyticsView({ habits, logs, profile: propProfile }: AnalyticsViewProps) {
  const [achievementFilter, setAchievementFilter] = useState<'all' | AchievementCategory>('all');

  const profile = useMemo(() => {
    return propProfile || calculateGamificationProfile(habits, logs, getTodayDateString());
  }, [propProfile, habits, logs]);

  const statsList = useMemo(() => {
    return habits.map((h) => ({
      habit: h,
      stats: calculateHabitStats(h, logs),
    }));
  }, [habits, logs]);

  const avg30DayRate = profile.stats.avg30DayRate;
  const bestStreak = profile.stats.bestStreak;
  const totalCompletions = profile.stats.totalCompletions;

  const dayOfWeekPerformance = useMemo(() => {
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    const dayTotals = [0, 0, 0, 0, 0, 0, 0];

    const today = new Date();
    for (let i = 0; i < 90; i++) {
      const d = subDays(today, i);
      const dStr = format(d, 'yyyy-MM-dd');
      const dayIdx = getDay(d);

      habits.forEach((h) => {
        if (isHabitDueOnDate(h, dStr)) {
          dayTotals[dayIdx]++;
          if (isDaySuccessful(h, dStr, logs)) {
            dayCounts[dayIdx]++;
          }
        }
      });
    }

    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return dayNames.map((name, idx) => {
      const rate = dayTotals[idx] > 0 ? Math.round((dayCounts[idx] / dayTotals[idx]) * 100) : 0;
      return { day: name, rate };
    });
  }, [habits, logs]);

  const getAchievementIcon = (iconName: string) => {
    switch (iconName) {
      case 'Zap': return Zap;
      case 'Flame': return Flame;
      case 'TrendingUp': return TrendingUp;
      case 'Activity': return Activity;
      case 'ShieldCheck': return ShieldCheck;
      case 'Shield': return Shield;
      case 'Sparkles': return Sparkles;
      case 'Trophy': return Trophy;
      case 'Star': return Star;
      case 'Crown': return Crown;
      case 'Medal': return Medal;
      case 'Award': return Award;
      case 'CheckCircle2': return CheckCircle2;
      default: return Award;
    }
  };

  const filteredAchievements = useMemo(() => {
    if (achievementFilter === 'all') return profile.achievements;
    return profile.achievements.filter((a) => a.category === achievementFilter);
  }, [profile.achievements, achievementFilter]);

  const unlockedCount = profile.achievements.filter((a) => a.unlocked).length;

  return (
    <div className="w-full max-w-4xl xl:max-w-7xl mx-auto px-3.5 sm:px-6 space-y-4 sm:space-y-6">
      {/* 1. Top Swiss KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* 30D Adherence */}
        <div className="p-5 sm:p-6 rounded-none bg-card border border-main transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-sub">
              30D ADHERENCE
            </span>
            <div className="p-1 rounded-none bg-card text-[#FF3B30] border border-main">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-4xl sm:text-5xl font-black font-sans tracking-tighter text-main">
              {avg30DayRate}
            </span>
            <span className="text-xl font-sans font-black text-[#FF3B30]">%</span>
            <span className="text-xs font-mono text-sub ml-2 uppercase">SCORE</span>
          </div>
        </div>

        {/* Record Streak */}
        <div className="p-5 sm:p-6 rounded-none bg-card border border-main transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-sub">
              RECORD STREAK
            </span>
            <div className="p-1 rounded-none bg-card text-[#FF3B30] border border-main">
              <Flame className="w-4 h-4 fill-[#FF3B30]" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-4xl sm:text-5xl font-black font-sans tracking-tighter text-main">
              {bestStreak}
            </span>
            <span className="text-sm font-mono font-bold text-sub ml-1 uppercase">DAYS ACTIVE</span>
          </div>
        </div>

        {/* Total Check-ins */}
        <div className="p-5 sm:p-6 rounded-none bg-card border border-main transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-sub">
              TOTAL LOGS
            </span>
            <div className="p-1 rounded-none bg-card text-main border border-main">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-4xl sm:text-5xl font-black font-sans tracking-tighter text-main">
              {totalCompletions}
            </span>
            <span className="text-sm font-mono font-bold text-sub ml-1 uppercase">CHECK-INS</span>
          </div>
        </div>
      </div>

      {/* 2. Gamification Section: Level HUD & Discipline Rating */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Player Level & XP HUD (7 cols) */}
        <div className="lg:col-span-7 p-5 sm:p-6 rounded-none bg-card border border-main space-y-4">
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-subtle">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="px-2 py-0.5 text-[10px] font-mono font-black uppercase tracking-wider border"
                  style={{
                    color: profile.tier.color,
                    borderColor: `${profile.tier.color}60`,
                    backgroundColor: `${profile.tier.color}15`,
                  }}
                >
                  {profile.tier.badge} {profile.tier.name}
                </span>
                <span className="text-xs font-mono text-sub uppercase">
                  {profile.tier.title}
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black font-sans tracking-tight text-main mt-1">
                LEVEL {profile.level}
              </h2>
            </div>

            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-input border border-subtle">
                <Flame className="w-3.5 h-3.5 text-[#FF3B30] fill-[#FF3B30]" />
                <span className="text-xs font-mono font-black text-main">
                  {profile.comboMultiplier.toFixed(1)}x
                </span>
                <span className="text-[10px] font-mono text-sub uppercase">COMBO</span>
              </div>
              <span className="text-[10px] font-mono text-sub mt-1">
                {profile.totalXp.toLocaleString()} TOTAL XP
              </span>
            </div>
          </div>

          {/* XP Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-sub uppercase">NEXT LEVEL PROGRESS</span>
              <span className="font-bold text-main">
                {profile.currentLevelXp.toLocaleString()} / {profile.nextLevelXp.toLocaleString()} XP
                <span className="text-sub ml-1.5">({profile.progressPercent}%)</span>
              </span>
            </div>
            <Progress
              value={profile.currentLevelXp}
              max={profile.nextLevelXp}
              size="md"
              indicatorColor={profile.tier.color}
            />
          </div>

          <div className="pt-2 text-xs font-mono text-sub flex items-center justify-between">
            <span>XP MULTIPLIER SCALES +0.1x EVERY 7-DAY STREAK</span>
            <span className="text-main font-bold">MAX 2.0x</span>
          </div>
        </div>

        {/* Discipline Rating Card (5 cols) */}
        <div className="lg:col-span-5 p-5 sm:p-6 rounded-none bg-card border border-main flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between pb-3 border-b border-subtle">
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-sub">
                DISCIPLINE RATING
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl sm:text-4xl font-black font-sans tracking-tight text-main">
                  {profile.discipline.totalScore}
                </span>
                <span className="text-xs font-mono text-sub">/ 1,000 PTS</span>
              </div>
            </div>

            <div
              className="px-3 py-1.5 border font-sans font-black text-lg tracking-wider"
              style={{
                color: profile.discipline.gradeColor,
                borderColor: profile.discipline.gradeColor,
                backgroundColor: `${profile.discipline.gradeColor}15`,
              }}
            >
              GRADE {profile.discipline.grade}
            </div>
          </div>

          {/* 4 Pillar Breakdown */}
          <div className="space-y-2.5">
            {/* Consistency */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-sub uppercase">Consistency (30D)</span>
                <span className="font-bold text-main">{profile.discipline.consistency} / 400</span>
              </div>
              <Progress value={profile.discipline.consistency} max={400} size="sm" indicatorColor="#38BDF8" />
            </div>

            {/* Momentum */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-sub uppercase">Momentum (Streak)</span>
                <span className="font-bold text-main">{profile.discipline.momentum} / 300</span>
              </div>
              <Progress value={profile.discipline.momentum} max={300} size="sm" indicatorColor="#F59E0B" />
            </div>

            {/* Resilience */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-sub uppercase">Resilience (Recovery)</span>
                <span className="font-bold text-main">{profile.discipline.resilience} / 150</span>
              </div>
              <Progress value={profile.discipline.resilience} max={150} size="sm" indicatorColor="#22C55E" />
            </div>

            {/* Balance */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-sub uppercase">Balance (Diversity)</span>
                <span className="font-bold text-main">{profile.discipline.balance} / 150</span>
              </div>
              <Progress value={profile.discipline.balance} max={150} size="sm" indicatorColor="#A855F7" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Daily Quests Board */}
      <div className="p-5 sm:p-6 rounded-none bg-card border border-main space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-subtle">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-[#FF3B30]" />
            <h3 className="text-sm font-black font-sans uppercase tracking-tight text-main">
              Tactical Daily Quests
            </h3>
          </div>
          <span className="text-xs font-mono text-sub uppercase">
            {profile.dailyQuests.filter((q) => q.completed).length} / {profile.dailyQuests.length} COMPLETED
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {profile.dailyQuests.map((quest) => (
            <div
              key={quest.id}
              className={`p-4 border transition-all ${
                quest.completed
                  ? 'bg-input border-[#22C55E]/40 shadow-xs'
                  : 'bg-input/40 border-subtle'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div
                  className={`w-6 h-6 flex items-center justify-center border text-xs font-bold ${
                    quest.completed
                      ? 'bg-[#22C55E]/20 border-[#22C55E] text-[#22C55E]'
                      : 'bg-subtle border-subtle text-sub'
                  }`}
                >
                  {quest.completed ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : '○'}
                </div>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 border border-[#FF3B30]/30 bg-[#FF3B30]/10 text-[#FF3B30]">
                  +{quest.xpReward} XP
                </span>
              </div>

              <div className="space-y-1">
                <h4 className="text-xs font-black font-sans uppercase tracking-tight text-main">
                  {quest.title}
                </h4>
                <p className="text-[11px] font-mono text-sub line-clamp-2">
                  {quest.description}
                </p>
              </div>

              <div className="mt-3">
                <Progress
                  value={quest.currentProgress}
                  max={quest.targetProgress}
                  size="sm"
                  indicatorColor={quest.completed ? '#22C55E' : '#FF3B30'}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Filterable Achievement Codex (24 Badges) */}
      <div className="p-5 sm:p-6 rounded-none bg-card border border-main space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-subtle">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#FF3B30]" />
            <h3 className="text-sm font-black font-sans uppercase tracking-tight text-main">
              Achievement Codex
            </h3>
          </div>
          <span className="text-xs font-mono text-sub uppercase">
            {unlockedCount} / {profile.achievements.length} UNLOCKED
          </span>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: `ALL (${profile.achievements.length})` },
            { id: 'flame', label: 'FLAME (11)' },
            { id: 'forge', label: 'FORGE (6)' },
            { id: 'stoic', label: 'STOIC (3)' },
            { id: 'alchemist', label: 'ALCHEMIST (2)' },
            { id: 'phoenix', label: 'PHOENIX (2)' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setAchievementFilter(tab.id as 'all' | AchievementCategory)}
              className={`h-7 px-2.5 text-[11px] font-mono font-bold uppercase tracking-tight transition-colors cursor-pointer select-none whitespace-nowrap border ${
                achievementFilter === tab.id
                  ? 'bg-subtle text-main border-main'
                  : 'bg-card text-sub border-subtle hover:text-main'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Achievement Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredAchievements.map((ach) => {
            const IconComp = getAchievementIcon(ach.iconName);
            return (
              <div
                key={ach.id}
                className={`p-3.5 rounded-none border transition-all ${
                  ach.unlocked
                    ? 'bg-input border-[#FF3B30]/40 shadow-xs'
                    : 'bg-input/30 border-subtle opacity-70'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className="w-8 h-8 flex items-center justify-center rounded-none border"
                    style={{
                      backgroundColor: ach.unlocked ? `${ach.color}20` : 'transparent',
                      borderColor: ach.unlocked ? `${ach.color}60` : 'var(--border-subtle)',
                      color: ach.unlocked ? ach.color : 'var(--text-sub)',
                    }}
                  >
                    <IconComp className="w-4 h-4" />
                  </div>
                  {ach.unlocked ? (
                    <span className="text-[9px] font-bold text-[#FF3B30] border border-[#FF3B30]/30 px-1.5 py-0.5 bg-[#FF3B30]/10">
                      UNLOCKED
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono text-sub flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> {ach.currentProgress} / {ach.targetProgress}
                    </span>
                  )}
                </div>

                <div className="space-y-0.5">
                  <div className="text-xs font-black font-sans uppercase text-main truncate">
                    {ach.title}
                  </div>
                  <div className="text-[10px] font-mono font-bold text-sub truncate">
                    {ach.subtitle}
                  </div>
                  <p className="text-[10px] font-mono text-sub/80 line-clamp-2 pt-1 leading-snug">
                    {ach.description}
                  </p>
                </div>

                <div className="mt-2.5">
                  <Progress
                    value={ach.progressPercent}
                    max={100}
                    size="sm"
                    indicatorColor={ach.unlocked ? ach.color : '#64748B'}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Habit Breakdown & Weekday Adherence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Habit Ranking */}
        <div className="p-5 sm:p-6 rounded-none bg-card border border-main transition-colors">
          <div className="flex items-center gap-2 mb-3 sm:mb-4 pb-2 border-b border-subtle">
            <h3 className="text-xs sm:text-sm font-black font-sans uppercase tracking-tight text-main">
              Habit Performance Breakdown
            </h3>
          </div>

          <div className="space-y-2.5 sm:space-y-3">
            {statsList.map(({ habit, stats }) => {
              const IconComp = getHabitIcon(habit.icon);
              const color =
                COLOR_PALETTES.find((c) => c.hex.toLowerCase() === habit.color.toLowerCase()) ||
                COLOR_PALETTES[0];

              return (
                <div key={habit.id} className="p-3 rounded-none bg-input border border-subtle space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-6 h-6 rounded-none flex items-center justify-center flex-shrink-0 border border-subtle"
                        style={{ backgroundColor: color.bg, color: color.hex }}
                      >
                        <IconComp className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-black font-sans uppercase text-main tracking-tight truncate">
                        {habit.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-mono flex-shrink-0">
                      <span className="text-[#FF3B30] flex items-center gap-1 font-bold text-xs">
                        <Flame className="w-3 h-3 fill-[#FF3B30]" /> {stats.currentStreak}D
                      </span>
                      <span className="text-sub">|</span>
                      <span className="text-main font-bold text-xs">{stats.completionRate30Days}%</span>
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
        <div className="p-5 sm:p-6 rounded-none bg-card border border-main transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1 pb-2 border-b border-subtle">
              <h3 className="text-xs sm:text-sm font-black font-sans uppercase tracking-tight text-main">
                Weekday Consistency (90 Days)
              </h3>
            </div>
            <p className="text-xs font-mono text-sub uppercase tracking-wider mb-4 sm:mb-6 mt-2">
              COMPLIANCE DISTRIBUTION BY CALENDAR DAY
            </p>
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2 items-end h-36 sm:h-40 pt-4 pb-2 border-b border-subtle">
            {dayOfWeekPerformance.map((item) => (
              <div key={item.day} className="flex flex-col items-center gap-1.5 sm:gap-2 h-full justify-end">
                <span className="text-[9px] sm:text-[10px] font-mono text-sub">{item.rate}%</span>
                <div
                  className="w-full max-w-[28px] rounded-none bg-[#FF3B30] hover:bg-[#E02D24] transition-all duration-200"
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
