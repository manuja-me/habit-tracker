'use client';

import React from 'react';
import { GithubIcon } from './ui/GithubIcon';

interface AppFooterProps {
  onOpenShortcutsModal: () => void;
}

export function AppFooter({ onOpenShortcutsModal }: AppFooterProps) {
  return (
    <footer className="w-full max-w-4xl xl:max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-4 border-t border-subtle/40 mt-12 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono text-sub select-none">
      <div className="flex items-center gap-2">
        <span>ZENITH // SWISS HABIT SYSTEM</span>
        <span>•</span>
        <span>LOCAL-FIRST VAULT</span>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={onOpenShortcutsModal}
          className="hover:text-main transition-colors uppercase cursor-pointer"
        >
          [?] Shortcuts
        </button>
        <a
          href="https://github.com/manuja-me/habit-tracker"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 hover:text-main transition-colors uppercase cursor-pointer"
        >
          <GithubIcon className="w-3.5 h-3.5" />
          <span>GitHub</span>
        </a>
      </div>
    </footer>
  );
}
