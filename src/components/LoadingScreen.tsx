'use client';

import React, { useState, useEffect } from 'react';

interface LoadingScreenProps {
  message?: string;
  statusText?: string;
  progress?: number;
}

export function LoadingScreen({
  message = 'LOADING HABIT VAULT...',
  statusText,
  progress: targetProgress,
}: LoadingScreenProps) {
  const [simulatedProgress, setSimulatedProgress] = useState(14);

  useEffect(() => {
    if (targetProgress !== undefined) {
      setSimulatedProgress(targetProgress);
      return;
    }

    // Realistic progressive curve: advances quickly at first, then settles smoothly to 100%
    const timer = setInterval(() => {
      setSimulatedProgress((prev) => {
        if (prev >= 100) return 100;
        const remaining = 100 - prev;
        const step = Math.max(0.4, remaining * 0.06 + Math.random() * 0.8);
        return Math.min(100, Number((prev + step).toFixed(1)));
      });
    }, 45);

    return () => clearInterval(timer);
  }, [targetProgress]);

  const currentProgress = targetProgress !== undefined ? targetProgress : simulatedProgress;
  const roundedPct = Math.min(100, Math.max(0, Math.round(currentProgress)));

  const getDynamicSubtitle = (pct: number) => {
    if (statusText) return statusText;
    if (pct < 35) return 'INITIALIZING LOCAL STORAGE...';
    if (pct < 70) return 'AUTHENTICATING PROTOCOLS...';
    if (pct < 95) return 'SYNCHRONIZING HABIT VAULT...';
    return 'ZENITH // READY';
  };

  return (
    <div className="min-h-screen bg-main text-main flex flex-col items-center justify-center p-4 font-mono select-none">
      <div className="flex flex-col gap-2.5 w-64 sm:w-80 animate-in fade-in duration-150">
        {/* Top Header Row: Message & Percentage */}
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-main font-bold tracking-wider uppercase text-[11px] truncate pr-2">
            {message}
          </span>
          <span className="font-bold text-[var(--accent)] text-xs tabular-nums shrink-0">
            {roundedPct}%
          </span>
        </div>

        {/* Progress Bar Track */}
        <div className="w-full h-2 bg-input border border-main relative overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] transition-all duration-100 ease-out"
            style={{ width: `${roundedPct}%` }}
          />
        </div>

        {/* Bottom Status / Telemetry Row */}
        <div className="flex items-center justify-between text-[10px] font-mono text-sub">
          <span className="uppercase tracking-wider truncate pr-2 opacity-80">
            {getDynamicSubtitle(roundedPct)}
          </span>
          <span className="opacity-60 text-[9px] uppercase tracking-widest shrink-0">
            {roundedPct >= 100 ? 'READY' : 'BOOTING'}
          </span>
        </div>
      </div>
    </div>
  );
}
