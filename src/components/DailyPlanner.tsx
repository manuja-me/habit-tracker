'use client';

import React, { useState, useEffect, useRef } from 'react';
import { format, parseISO, addDays, subDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useHabitStore } from '../lib/store';
import { getTodayDateString } from '../lib/utils/date';

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
  const [value, setValue] = useState(initialValue);
  const [isSavedRecently, setIsSavedRecently] = useState(false);
  const isFocusedRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const dateObj = parseISO(dateStr);
  const dayNum = format(dateObj, 'dd');
  const dayName = format(dateObj, 'EEEE'); // Full English name e.g. FRIDAY
  const month = format(dateObj, 'MMM');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    if (!isFocusedRef.current) {
      setValue(initialValue || '');
    }
  }, [initialValue]);

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
    setValue(nextVal);

    // Immediate auto-expand on typing without waiting for state effect
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      onSave(dateStr, nextVal);
      setIsSavedRecently(true);
      setTimeout(() => setIsSavedRecently(false), 1500);
    }, 400);
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    onSave(dateStr, value);
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
            ? 'bg-[#FF3B30] text-white'
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
            <span className="text-[8px] font-mono font-black uppercase px-1.5 py-0.2 bg-black/40 text-white border border-white/20">
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
          onChange={handleChange}
          onFocus={() => {
            isFocusedRef.current = true;
          }}
          onBlur={handleBlur}
          placeholder={`Directives & tasks for ${dayName}...`}
          style={{ fieldSizing: 'content', overflow: 'hidden' } as React.CSSProperties}
          className="w-full bg-transparent text-xs font-mono text-main placeholder-muted-custom focus:outline-none resize-none leading-relaxed overflow-hidden p-0 border-0 min-h-[38px] break-words"
        />

        {/* Autosave status indicator */}
        <div className="flex items-center justify-between h-3 text-[9px] font-mono text-sub mt-2">
          <span className="text-[8px] uppercase tracking-wider text-muted-custom">
            {isSelected ? 'ACTIVE // SYNCED' : ''}
          </span>
          {isSavedRecently && (
            <span className="inline-flex items-center gap-1 text-[#FF3B30] animate-in fade-in duration-150">
              <Check className="w-2.5 h-2.5 stroke-[3]" /> SAVED
            </span>
          )}
        </div>
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
  const [anchorDate, setAnchorDate] = useState<string>(selectedDate || todayStr);

  // Keep anchorDate in sync if external selectedDate changes outside the current 7-day window
  useEffect(() => {
    if (selectedDate) {
      try {
        const currentStart = parseISO(anchorDate);
        const sel = parseISO(selectedDate);
        const diff = Math.floor((sel.getTime() - currentStart.getTime()) / (1000 * 3600 * 24));
        if (diff < 0 || diff >= 7) {
          setAnchorDate(selectedDate);
        }
      } catch {}
    }
  }, [selectedDate, anchorDate]);

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
        AUTOSAVES INSTANTLY ON TYPING
      </div>
    </div>
  );
}
