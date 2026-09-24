'use client';

import React, { useState } from 'react';
import { Habit, HabitLog } from '../lib/types';
import { AbsenceDetectionResult, acknowledgeAbsence, formatLastVisitReadable } from '../lib/utils/presence';
import { formatShortDate } from '../lib/utils/date';
import { getHabitIcon } from '../lib/utils/icons';
import { ShieldCheck, ShieldAlert, Check, X, Clock, Calendar, ArrowRight } from 'lucide-react';

interface AbsenceCatchUpModalProps {
  isOpen: boolean;
  absence: AbsenceDetectionResult;
  habits: Habit[];
  logs: Record<string, HabitLog>;
  onClose: () => void;
  onSaveLogs: (newLogs: Array<{ habitId: string; dateStr: string; completed: boolean; value: number }>) => void;
}

export function AbsenceCatchUpModal({
  isOpen,
  absence,
  habits,
  logs,
  onClose,
  onSaveLogs,
}: AbsenceCatchUpModalProps) {
  // Local state for pending toggles during this review
  // key: `${habitId}_${dateStr}` => completed boolean
  const [pendingCompletions, setPendingCompletions] = useState<Record<string, boolean>>({});

  if (!isOpen || !absence.wasAway) return null;

  const dontHabits = habits.filter((h) => h.nature === 'dont' && !h.archived);
  const doHabits = habits.filter((h) => h.nature !== 'dont' && !h.archived);

  const missedDates = absence.missedDates;

  const handleToggleDo = (habitId: string, dateStr: string) => {
    const key = `${habitId}_${dateStr}`;
    const currentVal = pendingCompletions[key] ?? Boolean(logs[key]?.completed);
    setPendingCompletions((prev) => ({
      ...prev,
      [key]: !currentVal,
    }));
  };

  const handleToggleDontSlip = (habitId: string, dateStr: string) => {
    const key = `${habitId}_${dateStr}`;
    // For dont habits, default is clean (true). If slipped up, completed is false.
    const currentCompleted = pendingCompletions[key] ?? (logs[key]?.completed ?? true);
    setPendingCompletions((prev) => ({
      ...prev,
      [key]: !currentCompleted,
    }));
  };

  const handleConfirm = () => {
    const logBatch: Array<{ habitId: string; dateStr: string; completed: boolean; value: number }> = [];

    // Process all pending completions
    Object.entries(pendingCompletions).forEach(([key, completed]) => {
      const [habitId, dateStr] = key.split('_');
      const habit = habits.find((h) => h.id === habitId);
      if (!habit) return;

      const isDont = habit.nature === 'dont';
      const value = isDont ? (completed ? 0 : 1) : (completed ? habit.target_value : 0);
      logBatch.push({ habitId, dateStr, completed, value });
    });

    if (logBatch.length > 0) {
      onSaveLogs(logBatch);
    }

    acknowledgeAbsence();
    onClose();
  };

  const handleDismiss = () => {
    acknowledgeAbsence();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-black/80 backdrop-blur-xs font-mono">
      <div className="w-full max-w-xl bg-card border border-main p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-subtle pb-3 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-[#FF3B30] text-white">
                INACTIVITY DETECTED
              </span>
              <h2 className="text-sm sm:text-base font-black font-sans uppercase tracking-tight text-main">
                WELCOME BACK
              </h2>
            </div>
            <p className="text-xs text-sub mt-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#FF3B30]" />
              Away for {absence.hoursAway} hours · Last visit: {formatLastVisitReadable(absence.previousVisitIso)}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 text-sub hover:text-main hover:bg-input transition-colors cursor-pointer"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
          {/* Addiction & Abstinence Status */}
          {dontHabits.length > 0 && (
            <div className="p-3.5 bg-input border border-subtle space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-main uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#FF3B30]" />
                  ADDICTION & SOBRIETY AUDIT
                </span>
                <span className="text-[10px] text-sub font-mono">Abstinence is clean by default</span>
              </div>
              <p className="text-[11px] text-sub">
                Zenith automatically preserves clean streaks during absence unless you recorded a slip-up.
              </p>

              <div className="space-y-2 pt-1">
                {dontHabits.map((habit) => {
                  const Icon = getHabitIcon(habit.icon);
                  return (
                    <div
                      key={habit.id}
                      className="p-2.5 bg-card border border-main flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-none bg-[#FF3B30]/10 text-[#FF3B30] flex items-center justify-center border border-[#FF3B30]/30">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-bold text-main uppercase">{habit.title}</span>
                      </div>

                      {/* Slip-up toggles for missed dates */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {missedDates.map((dStr) => {
                          const key = `${habit.id}_${dStr}`;
                          const isCompleted = pendingCompletions[key] ?? (logs[key]?.completed ?? true);
                          const isSlipped = !isCompleted;

                          return (
                            <button
                              key={dStr}
                              onClick={() => handleToggleDontSlip(habit.id, dStr)}
                              className={`px-2 py-1 text-[10px] font-mono border transition-all cursor-pointer flex items-center gap-1 ${
                                isSlipped
                                  ? 'bg-[#FF3B30] text-white border-[#FF3B30]'
                                  : 'bg-input text-sub border-subtle hover:border-[#FF3B30] hover:text-main'
                              }`}
                              title={isSlipped ? `Slipped up on ${dStr}` : `Clean on ${dStr}`}
                            >
                              {isSlipped ? <ShieldAlert className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3 text-[#FF3B30]" />}
                              <span>{formatShortDate(dStr).split(' ')[1]}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Missed Routine Habits (Offline Catch-Up) */}
          {doHabits.length > 0 && missedDates.length > 0 && (
            <div className="p-3.5 bg-input border border-subtle space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-main uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#FF3B30]" />
                  OFFLINE HABIT CATCH-UP
                </span>
                <span className="text-[10px] text-sub font-mono">Completed offline? Check to log</span>
              </div>
              <p className="text-[11px] text-sub">
                If you completed any build habits while away from the site, check them below to restore your streak:
              </p>

              <div className="space-y-2 pt-1">
                {doHabits.map((habit) => {
                  const Icon = getHabitIcon(habit.icon);
                  return (
                    <div
                      key={habit.id}
                      className="p-2.5 bg-card border border-main flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-none bg-subtle text-main flex items-center justify-center border border-subtle">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-bold text-main uppercase">{habit.title}</span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {missedDates.map((dStr) => {
                          const key = `${habit.id}_${dStr}`;
                          const isDone = pendingCompletions[key] ?? Boolean(logs[key]?.completed);

                          return (
                            <button
                              key={dStr}
                              onClick={() => handleToggleDo(habit.id, dStr)}
                              className={`px-2 py-1 text-[10px] font-mono border transition-all cursor-pointer flex items-center gap-1 ${
                                isDone
                                  ? 'bg-[#FF3B30] text-white border-[#FF3B30]'
                                  : 'bg-input text-sub border-subtle hover:border-[#FF3B30] hover:text-main'
                              }`}
                              title={isDone ? `Done on ${dStr}` : `Missed on ${dStr}`}
                            >
                              {isDone ? <Check className="w-3 h-3 stroke-[3]" /> : null}
                              <span>{formatShortDate(dStr).split(' ')[1]}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-subtle flex items-center justify-between gap-3 flex-shrink-0">
          <button
            onClick={handleDismiss}
            className="h-10 px-4 text-xs font-mono font-medium text-sub hover:text-main uppercase cursor-pointer"
          >
            DISMISS & CONTINUE
          </button>
          <button
            onClick={handleConfirm}
            className="flex items-center justify-center gap-1.5 h-10 px-5 text-xs font-mono font-bold bg-[#FF3B30] text-white hover:bg-[#E02D24] uppercase transition-colors cursor-pointer active:scale-95"
          >
            <span>CONFIRM & RESUME</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
