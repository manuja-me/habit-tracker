'use client';

import React from 'react';

interface LoadingScreenProps {
  message?: string;
  statusText?: string;
}

export function LoadingScreen({
  message,
}: LoadingScreenProps) {
  return (
    <div className="min-h-screen bg-main text-main flex flex-col items-center justify-center p-4 font-mono select-none">
      <div className="flex flex-col items-center gap-3 w-48 sm:w-56 animate-in fade-in duration-150">
        {/* Simple Minimal Loading Bar */}
        <div className="w-full h-1 bg-subtle border border-main relative overflow-hidden">
          <div className="absolute top-0 bottom-0 left-0 w-24 bg-emerald-500 animate-loading-bar" />
        </div>
        {message && (
          <span className="text-[11px] font-mono text-sub uppercase tracking-wider">
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
