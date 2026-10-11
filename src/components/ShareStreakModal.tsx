'use client';

import React, { useState, useMemo } from 'react';
import { Habit, HabitLog } from '../lib/types';
import { calculateHabitStats, isDaySuccessful } from '../lib/utils/streaks';
import { formatDisplayDate, getTodayDateString, formatShortDate } from '../lib/utils/date';
import { calculateGamificationProfile, GamificationProfile } from '../lib/utils/gamification';
import { Flame, Download, Check, X, Share2, Copy } from 'lucide-react';

interface ShareStreakModalProps {
  isOpen: boolean;
  onClose: () => void;
  habits: Habit[];
  logs: Record<string, HabitLog>;
  profile?: GamificationProfile;
}

export function ShareStreakModal({
  isOpen,
  onClose,
  habits,
  logs,
  profile: propProfile,
}: ShareStreakModalProps) {
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const todayStr = getTodayDateString();

  const profile = useMemo(() => {
    return propProfile || calculateGamificationProfile(habits, logs, todayStr);
  }, [propProfile, habits, logs, todayStr]);

  if (!isOpen) return null;

  const activeHabits = habits.filter((h) => !h.archived);
  const statsList = activeHabits.map((h) => ({
    habit: h,
    stats: calculateHabitStats(h, logs),
  }));

  const bestStreak = profile.stats.bestStreak;
  const activeStreak = profile.stats.activeStreak;
  const avg30DayRate = profile.stats.avg30DayRate;

  const completedToday = activeHabits.filter((h) => isDaySuccessful(h, todayStr, logs)).length;

  const handleCopyText = async () => {
    const lines = [
      `⚡ ZENITH HABIT REPORT — ${formatDisplayDate(todayStr)}`,
      `🎖️ Level ${profile.level} ${profile.tier.name} (${profile.tier.title}) • ${profile.totalXp.toLocaleString()} XP`,
      `🛡️ Discipline Rating: ${profile.discipline.totalScore}/1,000 [Grade ${profile.discipline.grade}]`,
      `🔥 Active Streak: ${activeStreak} days (${profile.comboMultiplier.toFixed(1)}x Combo) | Longest: ${bestStreak} days`,
      `📈 30-Day Adherence: ${avg30DayRate}% | Today: ${completedToday}/${activeHabits.length} completed`,
      '',
      ...activeHabits.slice(0, 5).map((h) => {
        const s = statsList.find((x) => x.habit.id === h.id)?.stats;
        return `• ${h.title}: ${s?.currentStreak || 0}D streak (${s?.completionRate30Days || 0}%)`;
      }),
      '',
      'Tracked with Zenith Terminal Habit Tracker',
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleDownloadImage = () => {
    setIsGenerating(true);
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 680;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsGenerating(false);
      return;
    }

    // 1. Background
    ctx.fillStyle = '#090A0F';
    ctx.fillRect(0, 0, 1200, 680);

    // 2. Outer Border
    ctx.strokeStyle = '#FF3B30';
    ctx.lineWidth = 4;
    ctx.strokeRect(24, 24, 1152, 632);

    // 3. Inner card fill
    ctx.fillStyle = '#11131A';
    ctx.fillRect(40, 40, 1120, 600);
    ctx.strokeStyle = '#272A38';
    ctx.lineWidth = 1;
    ctx.strokeRect(40, 40, 1120, 600);

    // 4. Header Bar
    ctx.fillStyle = '#FF3B30';
    ctx.fillRect(70, 70, 36, 36);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('⚡', 78, 97);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 26px monospace';
    ctx.fillText('ZENITH // TERMINAL REPORT', 120, 97);

    // Level & Tier badge in header
    ctx.fillStyle = profile.tier.color;
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`LVL ${profile.level} • ${profile.tier.name.toUpperCase()}`, 640, 97);

    ctx.fillStyle = '#64748B';
    ctx.font = '15px monospace';
    ctx.fillText(formatDisplayDate(todayStr).toUpperCase(), 920, 97);

    // 5. Divider
    ctx.strokeStyle = '#272A38';
    ctx.beginPath();
    ctx.moveTo(70, 130);
    ctx.lineTo(1130, 130);
    ctx.stroke();

    // 6. Metrics Grid (4 Swiss Cards)
    const metrics = [
      {
        label: 'STREAK & COMBO',
        val: `${activeStreak} DAYS`,
        sub: `${profile.comboMultiplier.toFixed(1)}x MULTIPLIER`,
        color: '#F59E0B',
      },
      {
        label: 'PLAYER RANK',
        val: `LVL ${profile.level}`,
        sub: `${profile.tier.name.toUpperCase()} TIER`,
        color: profile.tier.color,
      },
      {
        label: 'DISCIPLINE RATING',
        val: `${profile.discipline.totalScore} PTS`,
        sub: `GRADE ${profile.discipline.grade} [${profile.discipline.consistency}/400 30D]`,
        color: profile.discipline.gradeColor,
      },
      {
        label: '30D ADHERENCE',
        val: `${avg30DayRate}%`,
        sub: `${completedToday} / ${activeHabits.length} COMPLETED TODAY`,
        color: '#38BDF8',
      },
    ];

    metrics.forEach((m, idx) => {
      const x = 70 + idx * 270;
      ctx.fillStyle = '#171923';
      ctx.fillRect(x, 155, 250, 105);
      ctx.strokeStyle = '#272A38';
      ctx.strokeRect(x, 155, 250, 105);

      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(m.label, x + 16, 180);

      ctx.fillStyle = m.color;
      ctx.font = '900 26px monospace';
      ctx.fillText(m.val, x + 16, 218);

      ctx.fillStyle = '#64748B';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(m.sub, x + 16, 243);
    });

    // 7. Habit Rows
    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('ACTIVE ROUTINES & STREAKS:', 70, 295);

    activeHabits.slice(0, 5).forEach((h, idx) => {
      const y = 320 + idx * 52;
      const s = statsList.find((x) => x.habit.id === h.id)?.stats;

      ctx.fillStyle = '#171923';
      ctx.fillRect(70, y, 1060, 42);
      ctx.strokeStyle = '#272A38';
      ctx.strokeRect(70, y, 1060, 42);

      // Color pill
      ctx.fillStyle = h.color || '#FF3B30';
      ctx.fillRect(85, y + 14, 14, 14);

      // Title
      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(h.title.slice(0, 32), 115, y + 27);

      // Category
      ctx.fillStyle = '#64748B';
      ctx.font = '12px monospace';
      ctx.fillText(`[${h.category.toUpperCase()}]`, 480, y + 27);

      // Streak
      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`🔥 ${s?.currentStreak || 0}D STREAK`, 720, y + 27);

      // Rate
      ctx.fillStyle = '#FF3B30';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`${s?.completionRate30Days || 0}% 30D`, 980, y + 27);
    });

    // 8. Footer
    ctx.fillStyle = '#475569';
    ctx.font = '13px monospace';
    ctx.fillText('Built with Zenith Minimal Habit Tracker', 70, 615);

    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(
      `${profile.totalXp.toLocaleString()} TOTAL XP • TIER: ${profile.tier.title.toUpperCase()}`,
      740,
      615
    );

    const link = document.createElement('a');
    link.download = `zenith-streak-${todayStr}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    setIsGenerating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-black/75 backdrop-blur-xs font-mono">
      <div className="w-full max-w-xl bg-card border border-main p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-subtle pb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-none bg-[#FF3B30]/15 text-[#FF3B30] border border-[#FF3B30]/30 flex items-center justify-center">
              <Share2 className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-main">
              SHARE STREAK & STATS
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-sub hover:text-main hover:bg-input transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preview Card */}
        <div className="p-4 sm:p-5 rounded-none bg-main border border-[#FF3B30]/40 space-y-4 shadow-inner">
          <div className="flex items-center justify-between border-b border-subtle pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-[#FF3B30] flex items-center justify-center text-white font-bold">
                <Flame className="w-3 h-3 fill-white" />
              </div>
              <span className="text-xs font-bold text-main">ZENITH REPORT</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 border"
                style={{
                  color: profile.tier.color,
                  borderColor: `${profile.tier.color}60`,
                  backgroundColor: `${profile.tier.color}15`,
                }}
              >
                LVL {profile.level} • {profile.tier.name}
              </span>
              <span className="text-[10px] text-sub">{formatShortDate(todayStr)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2 bg-card border border-subtle">
              <div className="text-[9px] text-sub uppercase">CURRENT</div>
              <div className="text-sm font-bold text-amber-500">{activeStreak} DAYS</div>
              <div className="text-[9px] text-sub mt-0.5">{profile.comboMultiplier.toFixed(1)}x COMBO</div>
            </div>
            <div className="p-2 bg-card border border-subtle">
              <div className="text-[9px] text-sub uppercase">DISCIPLINE</div>
              <div
                className="text-sm font-bold"
                style={{ color: profile.discipline.gradeColor }}
              >
                {profile.discipline.totalScore} PTS
              </div>
              <div className="text-[9px] text-sub mt-0.5">GRADE {profile.discipline.grade}</div>
            </div>
            <div className="p-2 bg-card border border-subtle">
              <div className="text-[9px] text-sub uppercase">30D RATE</div>
              <div className="text-sm font-bold text-indigo-400">{avg30DayRate}%</div>
              <div className="text-[9px] text-sub mt-0.5">ADHERENCE</div>
            </div>
            <div className="p-2 bg-card border border-subtle">
              <div className="text-[9px] text-sub uppercase">TODAY</div>
              <div className="text-sm font-bold text-pink-400">
                {completedToday}/{activeHabits.length}
              </div>
              <div className="text-[9px] text-sub mt-0.5">CHECK-INS</div>
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            {activeHabits.slice(0, 4).map((h) => {
              const s = statsList.find((x) => x.habit.id === h.id)?.stats;
              return (
                <div
                  key={h.id}
                  className="flex items-center justify-between text-xs py-1 px-2 bg-card/60 border border-subtle"
                >
                  <span className="text-main font-bold truncate max-w-[200px]">{h.title}</span>
                  <span className="text-amber-500 text-[11px] font-bold">
                    🔥 {s?.currentStreak || 0}D
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
          <button
            onClick={handleDownloadImage}
            disabled={isGenerating}
            className="flex items-center justify-center gap-2 h-12 sm:h-10 px-4 font-bold text-xs font-mono bg-[#FF3B30] text-white hover:bg-[#E02D24] transition-colors uppercase cursor-pointer touch-manipulation active:scale-95"
          >
            <Download className="w-4 h-4" />
            {isGenerating ? 'GENERATING...' : 'DOWNLOAD PNG CARD'}
          </button>
          <button
            onClick={handleCopyText}
            className="flex items-center justify-center gap-2 h-12 sm:h-10 px-4 font-bold text-xs font-mono bg-input hover:bg-input-focus border border-main text-main transition-colors uppercase cursor-pointer touch-manipulation active:scale-95"
          >
            {copied ? <Check className="w-4 h-4 text-[#FF3B30]" /> : <Copy className="w-4 h-4" />}
            {copied ? 'COPIED TO CLIPBOARD' : 'COPY TEXT SUMMARY'}
          </button>
        </div>
      </div>
    </div>
  );
}
