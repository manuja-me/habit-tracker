'use client';

import React, { useState, useEffect, useRef } from 'react';
import { format, parseISO, addDays, subDays } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useHabitStore } from '../lib/store';
import { getTodayDateString, isPlannerNoteExpired } from '../lib/utils/date';
import { getUnlockedTabUserId } from '../lib/utils/tab-session';

interface DayNoteRowProps {
  dateStr: string;
  initialValue: string;
  isToday: boolean;
  isSelected?: boolean;
  onSave: (dateStr: string, content: string) => void;
  onSelect?: (dateStr: string) => void;
}

function DayNoteRow({
  dateStr,
  initialValue,
  isToday,
  isSelected,
  onSave,
  onSelect,
}: DayNoteRowProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? initialValue;
  const isExpired = isPlannerNoteExpired(dateStr);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const dateObj = parseISO(dateStr);
  const dayNum = format(dateObj, 'dd');
  const dayName = format(dateObj, 'EEEE'); // Full English name e.g. FRIDAY
  const month = format(dateObj, 'MMM');
  const pendingRef = useRef<{ timer: ReturnType<typeof setTimeout>; save: () => void } | null>(null);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    const savePending = () => {
      const pending = pendingRef.current;
      if (!pending) return;
      clearTimeout(pending.timer);
      pendingRef.current = null;
      pending.save();
    };
    const handlePageHide = () => {
      savePending();
      setDraft(null);
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      savePending();
    };
  }, []);

  useEffect(() => {
    adjustHeight();
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(adjustHeight);
    }
  }, [value]);

  useEffect(() => {
    const handleResize = () => adjustHeight();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = e.target.value;
    setDraft(nextVal);

    // Immediate auto-expand on typing without waiting for state effect
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;

    if (pendingRef.current) clearTimeout(pendingRef.current.timer);
    const userId = getUnlockedTabUserId();
    pendingRef.current = {
      timer: setTimeout(flushDraft, 750),
      save: () => {
        if (userId && getUnlockedTabUserId() === userId) onSave(dateStr, nextVal);
      },
    };
  };

  const flushDraft = () => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRef.current = null;
    pending.save();
    setDraft(null);
  };

  return (
    <div
      onClick={() => onSelect?.(dateStr)}
      className={`group relative flex flex-col sm:flex-row items-stretch transition-all rounded-none border ${
        isToday
          ? 'border-2 border-[#FF3B30] bg-card shadow-xs'
          : isSelected
          ? 'border-main border-l-4 border-l-[#FF3B30] bg-card'
          : 'border-main bg-card hover:border-neutral-500'
      }`}
    >
      {/* Left Badge: Day number & English Day Name */}
      <div
        className={`flex sm:flex-col justify-between sm:justify-center items-center w-full sm:w-20 md:w-24 px-2.5 py-2 sm:py-2.5 flex-shrink-0 select-none ${
          isToday
            ? 'bg-[#FF3B30] text-[var(--accent-fg)] font-bold'
            : isSelected
            ? 'bg-subtle text-main border-b sm:border-b-0 sm:border-r border-main font-bold'
            : 'bg-subtle text-sub border-b sm:border-b-0 sm:border-r border-main'
        }`}
      >
        <div className="flex sm:flex-col items-baseline sm:items-center gap-2 sm:gap-0">
          <span className="text-xl sm:text-2xl font-black font-sans leading-none tracking-tight">
            {dayNum}
          </span>
          <span className="text-xs sm:text-[10px] font-black font-sans uppercase tracking-wider mt-0.5">
            {dayName.slice(0, 3)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[9px] font-mono font-bold uppercase opacity-75">
            {month}
          </span>
          {isToday && (
            <span className="text-[8px] font-mono font-black uppercase px-1.5 py-0.2 bg-black/15 text-[var(--accent-fg)] border border-black/25">
              TODAY
            </span>
          )}
        </div>
      </div>

      {/* In Front: Text Area for Day Tasks & Notes */}
      <div 
        onClick={() => {
          textareaRef.current?.focus();
        }}
        className="flex-1 p-3 flex flex-col justify-between min-h-[72px] relative bg-input/40 cursor-text"
      >
        <textarea
          ref={textareaRef}
          rows={2}
          value={value}
          disabled={isExpired}
          aria-label={`Planner notes for ${dateStr}`}
          onChange={handleChange}
          onBlur={flushDraft}
          placeholder={isExpired ? 'This date is outside the 3-month note retention period.' : `Directives & tasks for ${dayName}...`}
          style={{ fieldSizing: 'content', overflow: 'hidden' } as React.CSSProperties}
          className="w-full bg-transparent text-xs font-mono text-main placeholder-muted-custom focus:outline-none resize-none leading-relaxed overflow-hidden p-0 border-0 min-h-[38px] break-words"
        />

      </div>
    </div>
  );
}

interface DailyPlannerProps {
  selectedDate?: string;
  onSelectDate?: (dateStr: string) => void;
  className?: string;
}

export function DailyPlanner({
  selectedDate,
  onSelectDate,
  className = '',
}: DailyPlannerProps) {
  const { dayNotes, saveDayNote } = useHabitStore();
  const todayStr = getTodayDateString();
  const [prevSelectedDate, setPrevSelectedDate] = useState(selectedDate);
  const [anchorDate, setAnchorDate] = useState<string>(selectedDate || todayStr);

  // Keep anchorDate in sync if external selectedDate changes outside the current 7-day window
  if (selectedDate !== prevSelectedDate) {
    setPrevSelectedDate(selectedDate);
    if (selectedDate) {
      const lastVisibleDate = format(addDays(parseISO(anchorDate), 6), 'yyyy-MM-dd');
      if (selectedDate < anchorDate || selectedDate > lastVisibleDate) {
        setAnchorDate(selectedDate);
      }
    }
  }

  // Generate 7 consecutive days starting from anchorDate
  const currentRef = parseISO(anchorDate);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(format(addDays(currentRef, i), 'yyyy-MM-dd'));
  }

  const handlePrev7 = () => {
    const prev = subDays(parseISO(anchorDate), 7);
    setAnchorDate(format(prev, 'yyyy-MM-dd'));
  };

  const handleNext7 = () => {
    const next = addDays(parseISO(anchorDate), 7);
    setAnchorDate(format(next, 'yyyy-MM-dd'));
  };

  const handleResetToday = () => {
    setAnchorDate(todayStr);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header & 7-Day Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-subtle">
        <div className="flex items-baseline gap-2">
          <div>
            <h3 className="text-sm font-black font-sans uppercase tracking-tight text-main">
              Daily Planner & Notes
            </h3>
            <p className="text-[11px] font-mono text-sub uppercase tracking-wider">
              {format(parseISO(days[0]), 'MMM dd')} – {format(parseISO(days[6]), 'MMM dd, yyyy')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto bg-card border border-main p-0.5 shadow-xs">
          <button
            onClick={handlePrev7}
            className="w-8 h-8 flex items-center justify-center hover:bg-subtle text-sub hover:text-main cursor-pointer active:scale-95 transition-all"
            title="Previous 7 Days"
            aria-label="Previous 7 Days"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetToday}
            className="px-2.5 h-8 text-[11px] font-mono font-bold text-sub hover:text-main cursor-pointer uppercase tracking-wider"
          >
            TODAY
          </button>
          <button
            onClick={handleNext7}
            className="w-8 h-8 flex items-center justify-center hover:bg-subtle text-sub hover:text-main cursor-pointer active:scale-95 transition-all"
            title="Next 7 Days"
            aria-label="Next 7 Days"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Days Rows with Textareas in front */}
      <div className="space-y-2.5">
        {days.map((dStr) => (
          <DayNoteRow
            key={dStr}
            dateStr={dStr}
            initialValue={dayNotes[dStr] || ''}
            isToday={dStr === todayStr}
            isSelected={dStr === selectedDate}
            onSave={saveDayNote}
            onSelect={onSelectDate}
          />
        ))}
      </div>

      <div className="text-[10px] font-mono text-sub text-center uppercase tracking-widest pt-1">
        NOTES AUTOSAVE AS YOU TYPE
      </div>
    </div>
  );
}
