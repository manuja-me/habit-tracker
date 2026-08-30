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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-3xl bg-card border border-main p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-subtle">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
              <Cloud className="w-4 h-4" />
            </div>
            <h2 className="text-base font-semibold text-main">
              Multi-Device Sync Status
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-sub hover:text-main hover:bg-subtle transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="pt-4 space-y-4">
          {isSupabaseConfigured ? (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-300 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-emerald-500">
                <Check className="w-4 h-4" />
                Cloud Database Connected (Single-User Mode)
              </div>
              <p className="text-sub leading-relaxed">
                Zero login required. Any habit you check off on your phone or laptop will synchronize across your devices instantly.
              </p>
              <div className="flex items-center gap-4 pt-2 text-[11px] text-sub">
                <span className="flex items-center gap-1.5"><Laptop className="w-3.5 h-3.5 text-main" /> Laptop Ready</span>
                <span className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5 text-main" /> Phone Ready</span>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-input border border-main text-xs text-sub space-y-2">
              <div className="flex items-center gap-2 text-emerald-500 font-semibold">
                <ShieldCheck className="w-4 h-4" />
                Local Storage Mode Active
              </div>
              <p className="text-sub leading-relaxed">
                Your habits are currently saved in your browser storage with 0ms latency.
              </p>
              <p className="text-sub leading-relaxed">
                To enable automatic multi-device cloud sync between your phone and laptop, add your free Supabase URL & Key to <code className="text-emerald-500">.env.local</code> or Vercel:
              </p>
              <div className="p-2.5 rounded-xl bg-card font-mono text-[11px] text-main border border-subtle space-y-1">
                <div>NEXT_PUBLIC_SUPABASE_URL=...</div>
                <div>NEXT_PUBLIC_SUPABASE_ANON_KEY=...</div>
              </div>
            </div>
          )}

          {isSupabaseConfigured && (
            <button
              onClick={() => syncWithCloud()}
              disabled={isSyncing}
              className="w-full py-2.5 flex items-center justify-center gap-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl shadow-md shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Force Sync Now'}</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full py-2 text-xs font-semibold bg-subtle hover:bg-main border border-subtle text-main rounded-xl transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
