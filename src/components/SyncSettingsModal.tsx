'use client';

import React from 'react';
import { useHabitStore } from '../lib/store';
import { 
  X, 
  Cloud, 
  Smartphone, 
  Laptop, 
  ShieldCheck, 
  Check, 
  RefreshCw,
  Lock
} from 'lucide-react';

interface SyncSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SyncSettingsModal({ isOpen, onClose }: SyncSettingsModalProps) {
  const { isSyncing, syncWithCloud, syncError } = useHabitStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-100 font-mono">
      <div className="w-full max-w-md rounded-none bg-card border border-main p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-subtle">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-none bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center justify-center">
              <Cloud className="w-4 h-4" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-main">
              SERVER & CLOUD SYNC
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-none text-sub hover:text-main hover:bg-subtle transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="pt-4 space-y-4">
          <div className="p-4 rounded-none bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-600 dark:text-emerald-300 space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-500">
              <Check className="w-4 h-4" />
              SERVER ACTION GATEWAY ACTIVE
            </div>
            <p className="text-sub leading-relaxed text-[11px]">
              Your database is protected behind server-side authentication. Direct public client access is blocked.
            </p>
            <div className="flex items-center gap-4 pt-2 text-[10px] text-sub">
              <span className="flex items-center gap-1.5"><Laptop className="w-3.5 h-3.5 text-main" /> LAPTOP READY</span>
              <span className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5 text-main" /> PHONE READY</span>
            </div>
          </div>

          {syncError && (
            <div className="p-3 rounded-none bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-500 font-mono">
              SYNC NOTICE: {syncError}
            </div>
          )}

          <button
            onClick={() => syncWithCloud()}
            disabled={isSyncing}
            className="w-full py-2.5 flex items-center justify-center gap-2 text-xs font-mono font-bold bg-emerald-500 hover:bg-emerald-400 text-black rounded-none border border-emerald-400 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'SYNCING...' : 'FORCE SYNC NOW'}</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2 text-xs font-mono font-medium bg-subtle hover:bg-main border border-subtle text-main rounded-none transition-all cursor-pointer"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
