'use client';

import React, { useRef, useState } from 'react';
import { Habit, HabitLog } from '../lib/types';
import { calculateHabitStats } from '../lib/utils/streaks';
import { formatDisplayDate, getTodayDateString, getLastNDays, formatShortDate } from '../lib/utils/date';
import { Flame, Download, Check, X, Share2, Copy, Terminal } from 'lucide-react';

interface ShareStreakModalProps {
  isOpen: boolean;
  onClose: () => void;
  habits: Habit[];
  logs: Record<string, HabitLog>;
}

export function ShareStreakModal({ isOpen, onClose, habits, logs }: ShareStreakModalProps) {
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  if (!isOpen) return null;

  const todayStr = getTodayDateString();
  const last7Days = getLastNDays(7);

  const activeHabits = habits.filter(h => !h.archived);
  const statsList = activeHabits.map(h => ({
    habit: h,
    stats: calculateHabitStats(h, logs),
  }));

  const bestStreak = Math.max(0, ...statsList.map(s => s.stats.longestStreak));
  const activeStreak = Math.max(0, ...statsList.map(s => s.stats.currentStreak));
  const avg30DayRate = statsList.length > 0
    ? Math.round(statsList.reduce((acc, s) => acc + s.stats.completionRate30Days, 0) / statsList.length)
    : 0;

  const completedToday = activeHabits.filter(h => logs[`${h.id}_${todayStr}`]?.completed).length;

  const handleCopyText = async () => {
    const lines = [
      `⚡ ZENITH HABIT REPORT — ${formatDisplayDate(todayStr)}`,
      `🔥 Active Streak: ${activeStreak} days | Longest: ${bestStreak} days`,
      `📈 30-Day Adherence: ${avg30DayRate}%`,
      `✅ Today's Score: ${completedToday}/${activeHabits.length} completed`,
      '',
      ...activeHabits.slice(0, 5).map(h => {
        const s = statsList.find(x => x.habit.id === h.id)?.stats;
        return `• ${h.title}: ${s?.currentStreak || 0}D streak (${s?.completionRate30Days || 0}%)`;
      }),
      '',
      'Tracked with Zenith Terminal Habit Tracker',
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {}
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

    // 2. Border
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 4;
    ctx.strokeRect(24, 24, 1152, 632);

    // 3. Inner card fill
    ctx.fillStyle = '#11131A';
    ctx.fillRect(40, 40, 1120, 600);
    ctx.strokeStyle = '#272A38';
    ctx.lineWidth = 1;
    ctx.strokeRect(40, 40, 1120, 600);

    // 4. Header Bar
    ctx.fillStyle = '#10B981';
    ctx.fillRect(70, 70, 36, 36);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('⚡', 78, 97);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 26px monospace';
    ctx.fillText('ZENITH // TERMINAL REPORT', 120, 97);

    ctx.fillStyle = '#64748B';
    ctx.font = '16px monospace';
    ctx.fillText(formatDisplayDate(todayStr).toUpperCase(), 780, 97);

    // 5. Divider
    ctx.strokeStyle = '#272A38';
    ctx.beginPath();
    ctx.moveTo(70, 130);
    ctx.lineTo(1130, 130);
    ctx.stroke();

    // 6. Metrics Grid
    const metrics = [
      { label: 'ACTIVE STREAK', val: `${activeStreak} DAYS`, color: '#F59E0B' },
      { label: 'BEST STREAK', val: `${bestStreak} DAYS`, color: '#10B981' },
      { label: '30D ADHERENCE', val: `${avg30DayRate}%`, color: '#6366F1' },
      { label: 'TODAY SCORE', val: `${completedToday} / ${activeHabits.length}`, color: '#EC4899' },
    ];

    metrics.forEach((m, idx) => {
      const x = 70 + idx * 270;
      ctx.fillStyle = '#171923';
      ctx.fillRect(x, 155, 250, 100);
      ctx.strokeStyle = '#272A38';
      ctx.strokeRect(x, 155, 250, 100);

      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(m.label, x + 18, 185);

      ctx.fillStyle = m.color;
      ctx.font = 'bold 28px monospace';
      ctx.fillText(m.val, x + 18, 228);
    });

    // 7. Habit Rows
    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('ACTIVE ROUTINES & STREAKS:', 70, 295);

    activeHabits.slice(0, 5).forEach((h, idx) => {
      const y = 325 + idx * 52;
      const s = statsList.find(x => x.habit.id === h.id)?.stats;

      ctx.fillStyle = '#171923';
      ctx.fillRect(70, y, 1060, 42);
      ctx.strokeStyle = '#272A38';
      ctx.strokeRect(70, y, 1060, 42);

      // Color pill
      ctx.fillStyle = h.color || '#10B981';
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
      ctx.fillStyle = '#10B981';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`${s?.completionRate30Days || 0}% 30D`, 980, y + 27);
    });

    // 8. Footer
    ctx.fillStyle = '#475569';
    ctx.font = '13px monospace';
    ctx.fillText('Built with Zenith Minimal Habit Tracker', 70, 615);

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
            <div className="w-6 h-6 rounded-none bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center justify-center">
              <Share2 className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-main">
              SHARE STREAK & STATS
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-sub hover:text-main hover:bg-input transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preview Card */}
        <div className="p-4 sm:p-5 rounded-none bg-main border border-emerald-500/40 space-y-4 shadow-inner">
          <div className="flex items-center justify-between border-b border-subtle pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-emerald-500 flex items-center justify-center text-black font-bold">
                <Flame className="w-3 h-3 fill-black" />
              </div>
              <span className="text-xs font-bold text-main">ZENITH REPORT</span>
            </div>
            <span className="text-[10px] text-sub">{formatShortDate(todayStr)}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2 bg-card border border-subtle">
              <div className="text-[9px] text-sub uppercase">CURRENT</div>
              <div className="text-sm font-bold text-amber-500">{activeStreak} DAYS</div>
            </div>
            <div className="p-2 bg-card border border-subtle">
              <div className="text-[9px] text-sub uppercase">BEST</div>
              <div className="text-sm font-bold text-emerald-500">{bestStreak} DAYS</div>
            </div>
            <div className="p-2 bg-card border border-subtle">
              <div className="text-[9px] text-sub uppercase">30D ADHERENCE</div>
              <div className="text-sm font-bold text-indigo-400">{avg30DayRate}%</div>
            </div>
            <div className="p-2 bg-card border border-subtle">
              <div className="text-[9px] text-sub uppercase">TODAY</div>
              <div className="text-sm font-bold text-pink-400">{completedToday}/{activeHabits.length}</div>
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            {activeHabits.slice(0, 4).map((h) => {
              const s = statsList.find(x => x.habit.id === h.id)?.stats;
              return (
                <div key={h.id} className="flex items-center justify-between text-xs py-1 px-2 bg-card/60 border border-subtle">
                  <span className="text-main font-bold truncate max-w-[200px]">{h.title}</span>
                  <span className="text-amber-500 text-[11px] font-bold">🔥 {s?.currentStreak || 0}D</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
          <button
            onClick={handleDownloadImage}
            disabled={isGenerating}
            className="flex items-center justify-center gap-2 py-2.5 px-4 font-bold text-xs bg-emerald-500 text-black hover:bg-emerald-400 transition-colors uppercase cursor-pointer"
          >
            <Download className="w-4 h-4" />
            {isGenerating ? 'GENERATING...' : 'DOWNLOAD PNG CARD'}
          </button>
          <button
            onClick={handleCopyText}
            className="flex items-center justify-center gap-2 py-2.5 px-4 font-bold text-xs bg-input hover:bg-input-focus border border-main text-main transition-colors uppercase cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            {copied ? 'COPIED TO CLIPBOARD' : 'COPY TEXT SUMMARY'}
          </button>
        </div>
      </div>
    </div>
  );
}
