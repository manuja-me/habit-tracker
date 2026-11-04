'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Habit } from '../lib/types';
import { X, Play, Pause, Wind, ShieldCheck, Sparkles, ArrowRight, Check } from 'lucide-react';
import { triggerDailyCelebration } from '../lib/utils/confetti';

interface UrgeSurferModalProps {
  isOpen: boolean;
  onClose: () => void;
  habit: Habit;
  replacementHabit?: Habit | null;
  isReplacementCompleted?: boolean;
  onCompleteReplacement?: (replacementHabitId: string) => void;
  onCravingResisted?: () => void;
}

type BreathPhase = 'inhale' | 'hold1' | 'exhale' | 'hold2';

const TOTAL_DURATION_SECONDS = 180; // 3 minutes ACT craving standard
const PHASES: BreathPhase[] = ['inhale', 'hold1', 'exhale', 'hold2'];

const PHASE_CONFIG: Record<BreathPhase, { label: string; desc: string; scale: string; color: string }> = {
  inhale: { label: 'INHALE', desc: 'Deep breath in through nose', scale: 'scale-115', color: '#38BDF8' },
  hold1: { label: 'HOLD', desc: 'Hold lungs gently full', scale: 'scale-115', color: '#818CF8' },
  exhale: { label: 'EXHALE', desc: 'Slow, smooth release through mouth', scale: 'scale-85', color: '#34D399' },
  hold2: { label: 'HOLD', desc: 'Rest empty before next breath', scale: 'scale-85', color: '#FBBF24' },
};

export function UrgeSurferModal({
  isOpen,
  onClose,
  habit,
  replacementHabit,
  isReplacementCompleted = false,
  onCompleteReplacement,
  onCravingResisted,
}: UrgeSurferModalProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(TOTAL_DURATION_SECONDS);
  const [isActive, setIsActive] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  const [replacementDone, setReplacementDone] = useState(isReplacementCompleted);

  const targetEndTimeRef = useRef<number | null>(null);

  const handleFinish = useCallback(() => {
    setIsCompleted(true);
    setIsActive(false);
    triggerDailyCelebration();
    onCravingResisted?.();
  }, [onCravingResisted]);

  // Synchronize target end timestamp whenever active state or open state changes
  useEffect(() => {
    if (!isOpen || isCompleted) return;

    if (isActive) {
      targetEndTimeRef.current = Date.now() + remainingSeconds * 1000;
    } else {
      targetEndTimeRef.current = null;
    }
  }, [isOpen, isActive, isCompleted, remainingSeconds]);

  // Timestamp-anchored timer to prevent background tab sleep and mobile throttling drift
  useEffect(() => {
    if (!isOpen || !isActive || isCompleted) return;

    const tick = () => {
      if (!targetEndTimeRef.current) return;
      const left = Math.max(0, Math.ceil((targetEndTimeRef.current - Date.now()) / 1000));
      setRemainingSeconds(left);
      if (left <= 0) {
        handleFinish();
      }
    };

    const intervalId = setInterval(tick, 250);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        tick();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isOpen, isActive, isCompleted, handleFinish]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Deterministically derive phase and seconds from elapsed time (zero state drift)
  const elapsedSeconds = TOTAL_DURATION_SECONDS - remainingSeconds;
  const cycleSecond = elapsedSeconds % 16;
  const phaseIndex = Math.min(3, Math.floor(cycleSecond / 4));
  const phaseSeconds = 4 - (cycleSecond % 4);
  const currentPhase = PHASES[phaseIndex];
  const phaseData = PHASE_CONFIG[currentPhase];

  const handleCompleteReplacementClick = () => {
    if (replacementHabit && onCompleteReplacement) {
      onCompleteReplacement(replacementHabit.id);
      setReplacementDone(true);
      triggerDailyCelebration();
    }
  };

  if (!isOpen) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 font-mono">
      <div className="w-full max-w-md bg-card border border-main p-5 sm:p-6 shadow-2xl relative flex flex-col items-center text-center">
        {/* Header */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-subtle mb-4">
          <div className="flex items-center gap-2 text-left">
            <Wind className="w-4 h-4 text-sky-400" />
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-main">
                URGE SURFER &bull; {habit.title}
              </h2>
              <p className="text-[10px] text-sub">ACT 3-Min Craving Box Breathing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-sub hover:text-main hover:bg-subtle transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isCompleted ? (
          <>
            {/* Philosophical Context Quote */}
            <p className="text-[11px] text-sub mb-4 italic max-w-xs leading-relaxed">
              &ldquo;Cravings peak like ocean waves. Stay present for 3 minutes without fighting or surrendering.&rdquo;
            </p>

            {/* Box Breathing Visualizer */}
            <div className="relative w-52 h-52 my-3 flex items-center justify-center">
              {/* Outer Pulse Box */}
              <div
                className={`absolute inset-0 border-2 transition-transform duration-1000 ease-in-out ${phaseData.scale}`}
                style={{ borderColor: phaseData.color }}
              />

              {/* Inner Pulsing Circle */}
              <div
                className={`w-36 h-36 rounded-full flex flex-col items-center justify-center transition-all duration-1000 ease-in-out ${phaseData.scale}`}
                style={{
                  backgroundColor: `${phaseData.color}15`,
                  border: `1px solid ${phaseData.color}50`,
                }}
              >
                <span
                  className="text-base font-black tracking-wider uppercase"
                  style={{ color: phaseData.color }}
                >
                  {phaseData.label}
                </span>
                <span className="text-2xl font-black font-mono mt-0.5" style={{ color: phaseData.color }}>
                  {phaseSeconds}s
                </span>
              </div>
            </div>

            {/* Instruction description */}
            <div className="text-xs text-main font-bold mt-2 h-5">
              {phaseData.desc}
            </div>

            {/* Total Remaining Timer */}
            <div className="mt-4 flex items-center gap-2 px-3 py-1 bg-input border border-subtle">
              <span className="text-[11px] text-sub">TOTAL TIME:</span>
              <span className="text-sm font-bold text-main font-mono">{timeFormatted}</span>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3 mt-6 w-full">
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className="flex-1 py-2.5 px-3 bg-input hover:bg-subtle border border-main text-xs font-bold text-main flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {isActive ? (
                  <>
                    <Pause className="w-3.5 h-3.5" /> PAUSE
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" /> RESUME
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleFinish}
                className="flex-1 py-2.5 px-3 bg-[#FF3B30] hover:bg-[#E02D24] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-[#FF3B30]"
              >
                <ShieldCheck className="w-3.5 h-3.5" /> WAVE CRESTED
              </button>
            </div>
          </>
        ) : (
          /* Completion State */
          <div className="w-full py-4 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <Sparkles className="w-3 h-3" /> +20 XP CRAVING SURFED
              </span>
              <h3 className="text-sm font-bold text-main uppercase mt-2">
                Wave Successfully Crested!
              </h3>
              <p className="text-[11px] text-sub max-w-xs mx-auto leading-relaxed">
                You observed the physical craving without reacting. Neural pathways weaken each time an urge is allowed to subside naturally.
              </p>
            </div>

            {/* CBT Habit Replacement Routine Prompt */}
            {replacementHabit && (
              <div className="p-3.5 bg-input border border-emerald-500/30 text-left space-y-2.5">
                <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> CBT HABIT REVERSAL TRAINING
                </div>
                <div className="text-xs text-main">
                  Dopamine receptors are sensitized. Lock in this victory by performing your linked replacement routine:
                </div>
                <div className="flex items-center justify-between gap-2 p-2 bg-card border border-main">
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-main truncate block">
                      {replacementHabit.title}
                    </span>
                    {replacementHabit.description && (
                      <span className="text-[10px] text-sub truncate block">
                        {replacementHabit.description}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleCompleteReplacementClick}
                    disabled={replacementDone}
                    className={`px-3 py-1.5 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all ${
                      replacementDone
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-emerald-500 hover:bg-emerald-600 text-white border border-emerald-500 active:scale-95'
                    }`}
                  >
                    {replacementDone ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> COMPLETED (+30 XP)
                      </>
                    ) : (
                      <>
                        COMPLETE NOW <ArrowRight className="w-3 h-3" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-input hover:bg-subtle border border-main text-xs font-bold text-main uppercase transition-colors cursor-pointer"
            >
              RETURN TO HABITS
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
