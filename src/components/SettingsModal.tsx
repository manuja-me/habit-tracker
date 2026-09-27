'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sun, 
  Moon, 
  Volume2, 
  VolumeX, 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  Check, 
  Bell, 
  Share2, 
  Keyboard, 
  UserPlus, 
  Lock, 
  Shield, 
  Sparkles,
  Sliders,
  Laptop,
  Clock
} from 'lucide-react';
import { useHabitStore } from '../lib/store';
import { useTheme } from '../lib/theme';
import { isSoundEnabled, setSoundEnabled } from '../lib/utils/sound';
import { LAST_VISIT_STORAGE_KEY, formatLastVisitReadable } from '../lib/utils/presence';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenInviteModal?: () => void;
  onOpenShortcutsModal?: () => void;
  onOpenShareModal?: () => void;
  onOpenNotificationModal?: () => void;
  onTriggerAbsenceCheck?: () => void;
  onLockApp: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  onOpenInviteModal,
  onOpenShortcutsModal,
  onOpenShareModal,
  onOpenNotificationModal,
  onTriggerAbsenceCheck,
  onLockApp,
}: SettingsModalProps) {
  const { isSyncing, isCloudReady, currentUser, syncWithCloud, syncError } = useHabitStore();
  const { theme, setTheme } = useTheme();
  const [soundOn, setSoundOn] = useState(true);
  const [justSynced, setJustSynced] = useState(false);
  const [lastVisitDisplay, setLastVisitDisplay] = useState('First recorded session');

  useEffect(() => {
    setSoundOn(isSoundEnabled());
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(LAST_VISIT_STORAGE_KEY);
      setLastVisitDisplay(formatLastVisitReadable(stored));
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSyncClick = async () => {
    if (isSyncing) return;
    await syncWithCloud();
    setJustSynced(true);
    setTimeout(() => setJustSynced(false), 2000);
  };

  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-black/60 backdrop-blur-xs font-mono animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg bg-card border border-main p-5 sm:p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-subtle pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-subtle border border-main flex items-center justify-center text-main">
              <Sliders className="w-4 h-4 text-[#FF3B30]" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black font-sans uppercase tracking-tight text-main">
                Settings & Preferences
              </h2>
              <p className="text-[11px] font-mono text-sub">
                Configure appearance, sync & advanced tools
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-sub hover:text-main hover:bg-subtle transition-colors cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section 1: Appearance */}
        <div className="space-y-3">
          <label className="text-xs font-mono font-bold uppercase tracking-wider text-sub block">
            Appearance
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { id: 'gruvbox-dark', label: 'Gruvbox Dark', icon: Moon },
              { id: 'gruvbox-light', label: 'Gruvbox Light', icon: Sun },
            ].map((t) => {
              const Icon = t.icon;
              const isSelected = theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id as any)}
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 px-3 border text-xs font-sans font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#FF3B30] bg-[#FF3B30]/10 text-main font-black shadow-xs'
                      : 'border-subtle bg-input text-sub hover:text-main hover:border-main'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-[#FF3B30]' : 'text-sub'}`} />
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: Sound Feedback */}
        <div className="space-y-3 pt-3 border-t border-subtle">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-sans font-bold text-main uppercase tracking-tight">
                Audio Feedback
              </div>
              <div className="text-[11px] font-mono text-sub">
                Tactile click sounds when checking off habits
              </div>
            </div>
            <button
              onClick={handleToggleSound}
              className={`flex items-center gap-1.5 h-8 px-3 border text-xs font-mono font-bold transition-all cursor-pointer ${
                soundOn
                  ? 'border-[#FF3B30]/50 bg-[#FF3B30]/10 text-[#FF3B30]'
                  : 'border-subtle bg-input text-sub'
              }`}
            >
              {soundOn ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-[#FF3B30]" />
                  <span>ON</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-sub" />
                  <span>MUTED</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Section 3: Cloud & Storage */}
        <div className="space-y-3 pt-3 border-t border-subtle">
          <label className="text-xs font-mono font-bold uppercase tracking-wider text-sub block">
            Cloud & Sync
          </label>
          <div className="p-3.5 bg-input border border-subtle space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {isCloudReady ? (
                  <Cloud className="w-4 h-4 text-[#FF3B30]" />
                ) : (
                  <CloudOff className="w-4 h-4 text-sub" />
                )}
                <div>
                  <div className="text-xs font-sans font-bold text-main">
                    {isCloudReady ? 'Cloud Connected' : 'Local Storage Mode'}
                  </div>
                  <div className="text-[10px] font-mono text-sub">
                    {isCloudReady
                      ? 'Habits and progress sync automatically'
                      : 'Data stored locally on this device'}
                  </div>
                </div>
              </div>

              <button
                onClick={handleSyncClick}
                disabled={isSyncing}
                className={`flex items-center gap-1.5 h-8 px-3 border text-xs font-mono font-bold transition-all cursor-pointer select-none ${
                  isSyncing
                    ? 'border-[#FF3B30] bg-[#FF3B30]/10 text-[#FF3B30]'
                    : justSynced
                    ? 'border-[#FF3B30] bg-[#FF3B30]/10 text-[#FF3B30]'
                    : 'border-main bg-card hover:border-[#FF3B30] text-main'
                }`}
              >
                {isSyncing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#FF3B30]" />
                ) : justSynced ? (
                  <Check className="w-3.5 h-3.5 text-[#FF3B30]" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>{isSyncing ? 'SYNCING...' : justSynced ? 'SYNCED' : 'SYNC NOW'}</span>
              </button>
            </div>

            {syncError && (
              <div className="text-[11px] font-mono text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2">
                Sync notice: {syncError}
              </div>
            )}
          </div>
        </div>

        {/* Section 4: Daily Reminders & Sharing Tools */}
        <div className="space-y-3 pt-3 border-t border-subtle">
          <label className="text-xs font-mono font-bold uppercase tracking-wider text-sub block">
            Tools & Reminders
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {onOpenNotificationModal && (
              <button
                onClick={() => {
                  onClose();
                  onOpenNotificationModal();
                }}
                className="flex items-center gap-2.5 p-3 bg-input hover:bg-subtle border border-subtle hover:border-main text-left transition-colors cursor-pointer"
              >
                <div className="w-7 h-7 bg-card border border-main flex items-center justify-center text-main flex-shrink-0">
                  <Bell className="w-3.5 h-3.5 text-[#FF3B30]" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-sans font-bold text-main truncate">
                    Daily Reminder
                  </div>
                  <div className="text-[10px] font-mono text-sub truncate">
                    Schedule check-in alert
                  </div>
                </div>
              </button>
            )}

            {onOpenShareModal && (
              <button
                onClick={() => {
                  onClose();
                  onOpenShareModal();
                }}
                className="flex items-center gap-2.5 p-3 bg-input hover:bg-subtle border border-subtle hover:border-main text-left transition-colors cursor-pointer"
              >
                <div className="w-7 h-7 bg-card border border-main flex items-center justify-center text-main flex-shrink-0">
                  <Share2 className="w-3.5 h-3.5 text-[#FF3B30]" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-sans font-bold text-main truncate">
                    Share Card
                  </div>
                  <div className="text-[10px] font-mono text-sub truncate">
                    Export streak graphic
                  </div>
                </div>
              </button>
            )}

            {onOpenShortcutsModal && (
              <button
                onClick={() => {
                  onClose();
                  onOpenShortcutsModal();
                }}
                className="flex items-center gap-2.5 p-3 bg-input hover:bg-subtle border border-subtle hover:border-main text-left transition-colors cursor-pointer sm:col-span-2"
              >
                <div className="w-7 h-7 bg-card border border-main flex items-center justify-center text-main flex-shrink-0">
                  <Keyboard className="w-3.5 h-3.5 text-sub" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-sans font-bold text-main truncate">
                    Keyboard Shortcuts
                  </div>
                  <div className="text-[10px] font-mono text-sub truncate">
                    Press <span className="text-[#FF3B30] font-bold">?</span> anywhere to view navigation keys
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Section: Activity & Session Audit */}
        <div className="space-y-3 pt-3 border-t border-subtle">
          <label className="text-xs font-mono font-bold uppercase tracking-wider text-sub block">
            Presence & Activity Audit
          </label>
          <div className="p-3.5 bg-input border border-subtle flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-card border border-main flex items-center justify-center text-main flex-shrink-0">
                <Clock className="w-3.5 h-3.5 text-[#FF3B30]" />
              </div>
              <div>
                <div className="text-xs font-sans font-bold text-main">
                  24-Hour Absence Detection
                </div>
                <div className="text-[10px] font-mono text-sub">
                  Last recorded visit: {lastVisitDisplay}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 border border-[#FF3B30]/40 text-[#FF3B30] bg-[#FF3B30]/5 uppercase">
                ACTIVE
              </span>
              {onTriggerAbsenceCheck && (
                <button
                  onClick={() => {
                    onClose();
                    onTriggerAbsenceCheck();
                  }}
                  className="text-[10px] font-mono font-bold px-2.5 py-1 border border-subtle hover:border-main bg-card hover:bg-subtle text-sub hover:text-main uppercase transition-colors cursor-pointer"
                  title="Run an absence check / test catch-up audit"
                >
                  AUDIT NOW
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Section 5: Team & Security */}
        <div className="space-y-3 pt-3 border-t border-subtle">
          <label className="text-xs font-mono font-bold uppercase tracking-wider text-sub block">
            Account & Security
          </label>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 bg-input border border-subtle">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-card border border-main flex items-center justify-center text-main flex-shrink-0">
                <Shield className="w-3.5 h-3.5 text-[#FF3B30]" />
              </div>
              <div>
                <div className="text-xs font-sans font-bold text-main">
                  {currentUser?.username ? currentUser.username.toUpperCase() : 'MASTER OWNER'}
                </div>
                <div className="text-[10px] font-mono text-sub uppercase">
                  Role: {currentUser?.role || 'Owner'} // Protected Vault
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onOpenInviteModal && (currentUser?.role === 'owner' || !currentUser) && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenInviteModal();
                  }}
                  className="flex items-center gap-1.5 h-8 px-3 border border-[#FF3B30]/40 hover:border-[#FF3B30] text-[#FF3B30] bg-[#FF3B30]/5 text-xs font-mono font-bold transition-all cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>INVITE</span>
                </button>
              )}

              <button
                onClick={() => {
                  onClose();
                  onLockApp();
                }}
                className="flex items-center gap-1.5 h-8 px-3 border border-subtle hover:border-rose-500 hover:text-rose-400 bg-card text-sub text-xs font-mono font-bold transition-all cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>LOCK</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
