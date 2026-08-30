'use client';

import React, { useState, useEffect } from 'react';
import { Flame, Terminal } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
  statusText?: string;
}

const BOOT_LOGS = [
  'INITIALIZING ZENITH KERNEL...',
  'AUTHENTICATING SECURE SESSION...',
  'SYNCING ROUTINE REGISTRIES...',
  'CALIBRATING STREAK MATRICES...',
  'SYSTEM READY.',
];

export function LoadingScreen({
  message = 'INITIALIZING SYSTEM...',
  statusText = 'ZENITH // SECURE ENGINE',
}: LoadingScreenProps) {
  const [logIndex, setLogIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setLogIndex((prev) => (prev < BOOT_LOGS.length - 1 ? prev + 1 : prev));
    }, 450);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-main text-main flex flex-col items-center justify-center p-4 font-mono select-none">
      <div className="flex flex-col items-center gap-6 max-w-sm w-full animate-in fade-in duration-200">
        {/* Brand Icon Box with Pulsing Aura */}
        <div className="relative">
          <div className="absolute -inset-2 bg-emerald-500/20 blur-md rounded-none animate-pulse" />
          <div className="relative w-12 h-12 bg-emerald-500 flex items-center justify-center text-black border border-emerald-400 shadow-xl">
            <Flame className="w-6 h-6 fill-black animate-pulse" />
          </div>
        </div>

        {/* Brand Header */}
        <div className="text-center space-y-1 w-full">
          <div className="text-[10px] sm:text-[11px] font-bold tracking-widest text-emerald-500 uppercase">
            {statusText}
          </div>
          <div className="text-xs sm:text-sm font-bold text-main tracking-wider uppercase">
            {message}
          </div>
        </div>

        {/* High-Tech Terminal Laser Scanner Bar */}
        <div className="w-56 h-1.5 bg-card border border-main relative overflow-hidden">
          <div className="absolute top-0 bottom-0 w-20 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-laser" />
        </div>

        {/* Terminal Boot Log Output */}
        <div className="w-56 p-2.5 bg-card border border-subtle space-y-1">
          <div className="flex items-center gap-1.5 text-[9px] text-emerald-500 font-bold border-b border-subtle/60 pb-1">
            <Terminal className="w-2.5 h-2.5" />
            <span>CONSOLE LOG</span>
          </div>
          <div className="text-[10px] text-sub font-mono h-4 overflow-hidden truncate">
            <span className="text-emerald-500 mr-1">&gt;</span>
            {BOOT_LOGS[logIndex]}
          </div>
        </div>

        {/* Micro Status Indicators */}
        <div className="flex items-center justify-between w-56 text-[9px] text-sub font-mono tracking-widest uppercase">
          <span>MEM: 64MB</span>
          <span className="text-emerald-500 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-none bg-emerald-500 animate-ping inline-block" />
            STANDBY
          </span>
          <span>v1.0.4</span>
        </div>
      </div>
    </div>
  );
}
