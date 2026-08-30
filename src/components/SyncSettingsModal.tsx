'use client';

import React from 'react';
import { useHabitStore } from '../lib/store';
import { isSupabaseConfigured } from '../lib/supabase';
import { 
  X, 
  Cloud, 
  Smartphone, 
  Laptop, 
  ShieldCheck, 
  Check, 
  RefreshCw 
} from 'lucide-react';

interface SyncSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SyncSettingsModal({ isOpen, onClose }: SyncSettingsModalProps) {
  const { isSyncing, syncWithCloud } = useHabitStore();

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
              MULTI-DEVICE SYNC
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
          {isSupabaseConfigured ? (
            <div className="p-4 rounded-none bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-600 dark:text-emerald-300 space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-500">
                <Check className="w-4 h-4" />
                DATABASE CONNECTED
              </div>
              <p className="text-sub leading-relaxed text-[11px]">
                Zero login required. Habits updated on phone or laptop sync instantly.
              </p>
              <div className="flex items-center gap-4 pt-2 text-[10px] text-sub">
                <span className="flex items-center gap-1.5"><Laptop className="w-3.5 h-3.5 text-main" /> LAPTOP READY</span>
                <span className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5 text-main" /> PHONE READY</span>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-none bg-input border border-main text-xs text-sub space-y-2">
              <div className="flex items-center gap-2 text-emerald-500 font-bold">
                <ShieldCheck className="w-4 h-4" />
                LOCAL MODE ACTIVE
              </div>
              <p className="text-sub leading-relaxed text-[11px]">
                Habits stored locally in browser memory. Add Supabase keys to .env.local or Vercel for multi-device sync:
              </p>
              <div className="p-2.5 rounded-none bg-card font-mono text-[10px] text-main border border-subtle space-y-1">
                <div>NEXT_PUBLIC_SUPABASE_URL=...</div>
                <div>NEXT_PUBLIC_SUPABASE_ANON_KEY=...</div>
              </div>
            </div>
          )}

          {isSupabaseConfigured && (
            <button
              onClick={() => syncWithCloud()}
              disabled={isSyncing}
              className="w-full py-2.5 flex items-center justify-center gap-2 text-xs font-mono font-bold bg-emerald-500 hover:bg-emerald-400 text-black rounded-none border border-emerald-400 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'SYNCING...' : 'FORCE SYNC NOW'}</span>
            </button>
          )}

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
