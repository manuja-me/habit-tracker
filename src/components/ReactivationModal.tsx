'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Clock, RefreshCw, LogOut, CheckCircle2, ShieldAlert } from 'lucide-react';

interface ReactivationModalProps {
  isOpen: boolean;
  username: string;
  deactivatedAt: string;
  initialRemainingMs: number;
  onReactivate: () => Promise<void> | void;
  onKeepDeactivated: () => Promise<void> | void;
  isProcessing?: boolean;
}

export function ReactivationModal({
  isOpen,
  username,
  deactivatedAt,
  initialRemainingMs,
  onReactivate,
  onKeepDeactivated,
  isProcessing = false,
}: ReactivationModalProps) {
  const calculateRemaining = useCallback(() => {
    try {
      const start = new Date(deactivatedAt).getTime();
      if (isNaN(start)) {
        return Math.max(0, Number(initialRemainingMs) || 0);
      }
      const expiration = start + 7 * 24 * 60 * 60 * 1000;
      const diff = expiration - Date.now();
      return isNaN(diff) ? Math.max(0, Number(initialRemainingMs) || 0) : Math.max(0, diff);
    } catch {
      return Math.max(0, Number(initialRemainingMs) || 0);
    }
  }, [deactivatedAt, initialRemainingMs]);

  const [remainingMs, setRemainingMs] = useState<number>(calculateRemaining);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingMs(calculateRemaining());
    }, 1000);

    return () => clearInterval(interval);
  }, [calculateRemaining]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) {
        e.preventDefault();
        onKeepDeactivated();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, onKeepDeactivated]);

  if (!isOpen) return null;

  const safeMs = Math.max(0, isNaN(remainingMs) ? 0 : remainingMs);
  const days = Math.floor(safeMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((safeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((safeMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((safeMs % (1000 * 60)) / 1000);

  const isExpired = safeMs <= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-black/80 backdrop-blur-sm font-mono animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-card border-2 border-amber-500 p-6 sm:p-8 shadow-2xl space-y-6 text-main animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reactivation-title"
      >
        {/* Masthead */}
        <div className="border-b border-subtle pb-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-500/20 border border-amber-500 text-amber-500 flex items-center justify-center font-black text-sm">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-mono font-bold text-amber-500">01 //</span>
                  <h2
                    id="reactivation-title"
                    className="text-base sm:text-lg font-black font-sans uppercase tracking-tight text-main"
                  >
                    ACCOUNT DEACTIVATED
                  </h2>
                </div>
                <div className="text-[9px] font-mono tracking-widest text-sub uppercase">
                  RECOVERY GRACE PERIOD ACTIVE
                </div>
              </div>
            </div>

            <span className="text-[10px] font-mono font-bold text-amber-500 border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 uppercase">
              7-DAY GRACE
            </span>
          </div>

          <p className="text-xs font-mono text-sub pt-1 leading-relaxed">
            Welcome back, <span className="font-bold text-main">@{username}</span>. Your account is currently deactivated and scheduled for permanent deletion.
          </p>
        </div>

        {/* Live Countdown Display Box */}
        <div className="p-4 bg-input border border-amber-500/30 space-y-2.5">
          <div className="flex items-center justify-between text-[11px] font-mono text-amber-500 font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 animate-pulse" />
              Time Remaining Until Permanent Wipe:
            </span>
            <span>{isExpired ? 'EXPIRED' : 'ACTIVE'}</span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center py-1">
            <div className="p-2 bg-card border border-subtle">
              <div className="text-xl sm:text-2xl font-black font-sans text-main">
                {String(days).padStart(2, '0')}
              </div>
              <div className="text-[9px] font-mono text-sub uppercase">Days</div>
            </div>
            <div className="p-2 bg-card border border-subtle">
              <div className="text-xl sm:text-2xl font-black font-sans text-main">
                {String(hours).padStart(2, '0')}
              </div>
              <div className="text-[9px] font-mono text-sub uppercase">Hours</div>
            </div>
            <div className="p-2 bg-card border border-subtle">
              <div className="text-xl sm:text-2xl font-black font-sans text-main">
                {String(minutes).padStart(2, '0')}
              </div>
              <div className="text-[9px] font-mono text-sub uppercase">Mins</div>
            </div>
            <div className="p-2 bg-card border border-subtle">
              <div className="text-xl sm:text-2xl font-black font-sans text-amber-500">
                {String(seconds).padStart(2, '0')}
              </div>
              <div className="text-[9px] font-mono text-sub uppercase">Secs</div>
            </div>
          </div>

          <p className="text-[11px] font-mono text-sub leading-snug pt-1">
            If you do not reactivate before this countdown expires, all your habits, completion history, streaks, and day planner directives will be <span className="text-rose-400 font-bold">permanently destroyed</span>.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            disabled={isProcessing || isExpired}
            onClick={() => onReactivate()}
            className="w-full h-12 flex items-center justify-center gap-2 bg-[#FF3B30] hover:bg-[#E02D24] text-white font-sans font-bold text-xs uppercase tracking-wider border border-[#FF3B30] transition-all cursor-pointer disabled:opacity-50 shadow-xs active:scale-[0.98]"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>REACTIVATING VAULT...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>YES, REACTIVATE ACCOUNT</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={isProcessing}
            onClick={() => onKeepDeactivated()}
            className="w-full h-11 flex items-center justify-center gap-2 bg-input hover:bg-subtle text-sub hover:text-main font-mono font-bold text-xs uppercase tracking-wider border border-subtle hover:border-main transition-all cursor-pointer disabled:opacity-50 active:scale-[0.98]"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>NO, KEEP DEACTIVATED & EXIT</span>
          </button>
        </div>

        {/* Protocol Footer */}
        <div className="pt-2 border-t border-subtle flex items-center justify-between text-[10px] font-mono text-sub">
          <span className="flex items-center gap-1">
            <ShieldAlert className="w-3 h-3 text-amber-500" /> PRIVACY SAFEGUARD
          </span>
          <span className="uppercase text-muted-custom">
            ZENITH DATA PROTOCOL
          </span>
        </div>
      </div>
    </div>
  );
}
