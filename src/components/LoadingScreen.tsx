'use client';

import React, { useState, useEffect, useRef } from 'react';

interface LoadingScreenProps {
  message?: string;
  statusText?: string;
  progress?: number;
  isReady?: boolean;
  onComplete?: () => void;
}

export function LoadingScreen({
  message = 'LOADING HABIT VAULT...',
  statusText,
  progress: targetProgress,
  isReady = false,
  onComplete,
}: LoadingScreenProps) {
  const [simulatedProgress, setSimulatedProgress] = useState(14);
  const [isFinishing, setIsFinishing] = useState(false);

  const isReadyRef = useRef(isReady);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    isReadyRef.current = isReady;
    onCompleteRef.current = onComplete;
  }, [isReady, onComplete]);

  // When external targetProgress reaches 100, trigger completion
  useEffect(() => {
    if (targetProgress !== undefined && targetProgress >= 100) {
      const timeout = setTimeout(() => {
        onCompleteRef.current?.();
      }, 250);
      return () => clearTimeout(timeout);
    }
  }, [targetProgress]);

  useEffect(() => {
    if (targetProgress !== undefined) {
      return;
    }

    const startTimestamp = Date.now();

    // Dynamic progressive animation curve
    const interval = setInterval(() => {
      setSimulatedProgress((prev) => {
        const elapsed = Date.now() - startTimestamp;

        // If database connection is confirmed, glide rapidly to 100%
        if (isReadyRef.current) {
          if (prev >= 100) {
            clearInterval(interval);
            setIsFinishing(true);
            return 100;
          }
          const step = Math.max(3, (100 - prev) * 0.3);
          const next = Math.min(100, Number((prev + step).toFixed(1)));
          if (next >= 100) {
            clearInterval(interval);
            setIsFinishing(true);
          }
          return next;
        }

        // Fail-safe: After 6 seconds, assume offline mode and complete
        if (elapsed > 6000) {
          if (prev >= 100) {
            clearInterval(interval);
            setIsFinishing(true);
            return 100;
          }
          const step = Math.max(4, (100 - prev) * 0.35);
          const next = Math.min(100, Number((prev + step).toFixed(1)));
          if (next >= 100) {
            clearInterval(interval);
            setIsFinishing(true);
          }
          return next;
        }

        // While waiting for database connection, smoothly approach ~90%
        if (prev >= 90) return 90;
        const remaining = 90 - prev;
        const step = Math.max(0.4, remaining * 0.07 + Math.random() * 0.6);
        return Math.min(90, Number((prev + step).toFixed(1)));
      });
    }, 40);

    return () => clearInterval(interval);
  }, [targetProgress]);

  // When 100% is reached, give user 250ms to see the 100% complete state, then trigger onComplete
  useEffect(() => {
    if (isFinishing && onComplete) {
      const timer = setTimeout(() => {
        onComplete();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isFinishing, onComplete]);

  const currentProgress = targetProgress !== undefined ? targetProgress : simulatedProgress;
  const roundedPct = Math.min(100, Math.max(0, Math.round(currentProgress)));

  const getDynamicSubtitle = (pct: number) => {
    if (pct >= 100) {
      return isReady ? 'DATABASE CONNECTED // READY' : 'LOCAL VAULT // READY';
    }
    if (statusText && pct < 100) return statusText;
    if (pct < 30) return 'INITIALIZING LOCAL STORAGE...';
    if (pct < 60) return 'CONNECTING TO SUPABASE...';
    if (pct < 88) return 'SYNCHRONIZING HABIT VAULT...';
    return isReady ? 'DATABASE CONNECTED // READY' : 'AWAITING DATABASE HANDSHAKE...';
  };

  const getDynamicMessage = (pct: number) => {
    if (pct >= 100) return 'HABIT VAULT READY';
    if (isReady && pct >= 88) return 'FINALIZING SYNC...';
    return message;
  };

  return (
    <div className="min-h-screen bg-main text-main flex flex-col items-center justify-center p-4 font-mono select-none">
      <div className="flex flex-col gap-2.5 w-64 sm:w-80 animate-in fade-in duration-150">
        {/* Top Header Row: Message & Percentage */}
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-main font-bold tracking-wider uppercase text-[11px] truncate pr-2">
            {getDynamicMessage(roundedPct)}
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
            {roundedPct >= 100 ? (isReady ? 'CONNECTED' : 'OFFLINE') : 'CONNECTING'}
          </span>
        </div>
      </div>
    </div>
  );
}
