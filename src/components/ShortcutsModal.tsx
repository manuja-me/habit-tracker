'use client';

import React, { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts = [
    { key: 'j / ↓', desc: 'Focus next habit' },
    { key: 'k / ↑', desc: 'Focus previous habit' },
    { key: 'Space / x', desc: 'Check / uncheck focused habit' },
    { key: '+ / -', desc: 'Step numeric habit counter' },
    { key: 'n', desc: 'Create new habit' },
    { key: 't', desc: 'Jump selected date to Today' },
    { key: '1 – 6', desc: 'Switch tabs (Today, Week, Planner, Heatmap, Stats, Users)' },
    { key: 'm', desc: 'Toggle tactile sound effects' },
    { key: '?', desc: 'Toggle this shortcuts modal' },
    { key: 'Esc', desc: 'Close any active modal' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-black/75 backdrop-blur-xs font-mono">
      <div className="w-full max-w-md bg-card border border-main p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-subtle pb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-none bg-[#FF3B30]/15 text-[#FF3B30] border border-[#FF3B30]/30 flex items-center justify-center">
              <Keyboard className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-main">
              VIM / KEYBOARD SHORTCUTS
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-sub hover:text-main hover:bg-input transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {shortcuts.map((s, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between py-1.5 px-2 rounded-none bg-input/40 border border-subtle text-xs"
            >
              <span className="text-sub font-mono text-[11px] sm:text-xs">{s.desc}</span>
              <kbd className="px-2 py-0.5 font-bold font-mono text-[10px] sm:text-[11px] bg-card text-[#FF3B30] border border-[#FF3B30]/40 rounded-none shadow-xs">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-subtle flex items-center justify-between text-[10px] text-sub">
          <span>Shortcuts disabled while typing in text inputs</span>
          <button
            onClick={onClose}
            className="px-3 py-1 font-bold text-main bg-input hover:bg-input-focus border border-main transition-colors uppercase"
          >
            [CLOSE]
          </button>
        </div>
      </div>
    </div>
  );
}
