'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sun, 
  Moon, 
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
  Sliders,
  Clock,
  ExternalLink,
  AlertTriangle,
  UserX,
  KeyRound,
} from 'lucide-react';
import { GithubIcon } from './ui/GithubIcon';
import { useHabitStore } from '../lib/store';
import { useTheme, Theme, GruvboxAccent } from '../lib/theme';
import { LAST_VISIT_STORAGE_KEY, formatLastVisitReadable } from '../lib/utils/presence';
import { deactivateAccountAction, changePinAction } from '../lib/server/auth';

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

export function SettingsModal(props: SettingsModalProps) {
  if (!props.isOpen) return null;
  return <SettingsModalDialog {...props} />;
}

function SettingsModalDialog({
  onClose,
  onOpenInviteModal,
  onOpenShortcutsModal,
  onOpenShareModal,
  onOpenNotificationModal,
  onTriggerAbsenceCheck,
  onLockApp,
}: SettingsModalProps) {
  const { isSyncing, isCloudReady, currentUser, syncWithCloud, syncError } = useHabitStore();
  const { theme, setTheme, accent, setAccent } = useTheme();
  const [justSynced, setJustSynced] = useState(false);
  const [lastVisitDisplay] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(LAST_VISIT_STORAGE_KEY);
      return formatLastVisitReadable(stored);
    }
    return 'First recorded session';
  });
  const [showDeactivatePrompt, setShowDeactivatePrompt] = useState(false);
  const [deactivatePin, setDeactivatePin] = useState('');
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  const [showChangePin, setShowChangePin] = useState(false);
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [changePinMsg, setChangePinMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSyncClick = async () => {
    if (isSyncing) return;
    await syncWithCloud();
    setJustSynced(true);
    setTimeout(() => setJustSynced(false), 2000);
  };

  const handleChangePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isChangingPin) return;
    setChangePinMsg(null);
    if (currentPinInput.length !== 4 && currentPinInput.length !== 6) {
      setChangePinMsg({ type: 'err', text: 'Enter your current 4 or 6-digit PIN.' });
      return;
    }
    if (newPinInput.length !== 6) {
      setChangePinMsg({ type: 'err', text: 'New PIN must be 6 digits.' });
      return;
    }
    setIsChangingPin(true);
    try {
      const res = await changePinAction(currentPinInput, newPinInput);
      if (res.success) {
        setChangePinMsg({ type: 'ok', text: '6-digit Scrypt PIN saved (zero data loss).' });
        setCurrentPinInput('');
        setNewPinInput('');
        setTimeout(() => setShowChangePin(false), 1500);
      } else {
        setChangePinMsg({ type: 'err', text: res.error || 'Failed to update PIN.' });
      }
    } catch {
      setChangePinMsg({ type: 'err', text: 'Error updating PIN.' });
    } finally {
      setIsChangingPin(false);
    }
  };

  const handleDeactivateConfirm = async () => {
    if ((deactivatePin.length !== 6 && deactivatePin.length !== 4) || isDeactivating) return;
    setIsDeactivating(true);
    setDeactivateError(null);

    try {
      const res = await deactivateAccountAction(deactivatePin);
      if (res.success) {
        setShowDeactivatePrompt(false);
        setDeactivatePin('');
        onClose();
        onLockApp();
      } else {
        setDeactivateError(res.error || 'Failed to deactivate account.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setDeactivateError(message || 'Error occurred while deactivating account.');
    } finally {
      setIsDeactivating(false);
    }
  };

  const themes: { id: Theme; label: string; icon: typeof Moon }[] = [
    { id: 'gruvbox-dark', label: 'Gruvbox Dark', icon: Moon },
    { id: 'gruvbox-light', label: 'Gruvbox Light', icon: Sun },
  ];

  const accents: { id: GruvboxAccent; label: string; color: string }[] = [
    { id: 'orange', label: 'Orange', color: '#FE8019' },
    { id: 'aqua', label: 'Aqua', color: '#8EC07C' },
    { id: 'yellow', label: 'Yellow', color: '#FABD2F' },
    { id: 'green', label: 'Green', color: '#B8BB26' },
    { id: 'blue', label: 'Blue', color: '#83A598' },
  ];

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
            {themes.map((t) => {
              const Icon = t.icon;
              const isSelected = theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
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

          {/* Accent Tone Selection */}
          <div className="pt-2 space-y-2">
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-sub block">
              Gruvbox Accent Tone
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {accents.map((acc) => {
                const isSelected = (accent || 'orange') === acc.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setAccent(acc.id)}
                    className={`flex items-center gap-2 p-2 border text-xs font-mono font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'border-main bg-card text-main shadow-xs ring-1 ring-main'
                        : 'border-subtle bg-input text-sub hover:text-main hover:border-main'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 shrink-0 rounded-none shadow-xs border border-black/20"
                      style={{ backgroundColor: acc.color }}
                    />
                    <span className="truncate">{acc.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Section 2: Cloud & Storage */}
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

          <div className="p-3.5 bg-input border border-subtle space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-card border border-main flex items-center justify-center text-main flex-shrink-0">
                  <Shield className="w-3.5 h-3.5 text-[#FF3B30]" />
                </div>
                <div>
                  <div className="text-xs font-sans font-bold text-main">
                    {currentUser?.username ? currentUser.username.toUpperCase() : 'MASTER OWNER'}
                  </div>
                  <div className="text-[10px] font-mono text-sub uppercase">
                    Role: {currentUser?.role || 'Owner'} &bull; Scrypt-64 Vault
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setShowChangePin((prev) => !prev);
                    setChangePinMsg(null);
                  }}
                  className="flex items-center gap-1.5 h-8 px-3 border border-main hover:border-[#FF3B30] bg-card text-main text-xs font-mono font-bold transition-all cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-[#FF3B30]" />
                  <span>6-DIGIT PIN</span>
                </button>

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

            {showChangePin && (
              <form
                onSubmit={handleChangePinSubmit}
                className="p-3 bg-card border border-main space-y-2.5 animate-in fade-in"
              >
                <div className="text-[11px] font-mono font-bold text-main uppercase">
                  UPGRADE / CHANGE TO 6-DIGIT SCRYPT PIN (ZERO DATA LOSS)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={currentPinInput}
                    onChange={(e) => setCurrentPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Current PIN (4 or 6 digits)"
                    className="h-8 px-2.5 bg-input border border-main text-xs font-mono text-main focus:outline-none focus:border-[#FF3B30]"
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={newPinInput}
                    onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="New 6-digit PIN"
                    className="h-8 px-2.5 bg-input border border-main text-xs font-mono text-main focus:outline-none focus:border-[#FF3B30]"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-sub">
                    All habits, logs, planner notes & projects stay intact.
                  </span>
                  <button
                    type="submit"
                    disabled={isChangingPin}
                    className="h-7 px-3 bg-[#FF3B30] hover:bg-[#E02D24] text-white text-[11px] font-mono font-bold uppercase cursor-pointer disabled:opacity-50"
                  >
                    {isChangingPin ? 'SAVING...' : 'SAVE 6-DIGIT PIN'}
                  </button>
                </div>
                {changePinMsg && (
                  <div
                    className={`text-[11px] font-mono font-bold ${
                      changePinMsg.type === 'ok' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {changePinMsg.text}
                  </div>
                )}
              </form>
            )}
          </div>
        </div>

        {/* Danger Zone: Account Deactivation (Members Only) */}
        {currentUser && currentUser.role !== 'owner' && (
          <div className="space-y-3 pt-3 border-t border-rose-500/30">
            <label className="text-xs font-mono font-bold uppercase tracking-wider text-rose-500 block">
              Danger Zone // Account Deactivation
            </label>
            <div className="p-3.5 bg-rose-500/5 border border-rose-500/30 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="text-xs font-sans font-bold text-rose-500 uppercase">
                    Deactivate Personal Account
                  </div>
                  <p className="text-[11px] font-mono text-sub leading-relaxed">
                    Deactivating starts an automatic <strong className="text-main">7-day grace period</strong> before your account, habits, completions, and notes are <strong className="text-rose-400">permanently wiped</strong>. You can cancel this at any time by logging in during the 7 days.
                  </p>
                </div>
              </div>

              {!showDeactivatePrompt ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowDeactivatePrompt(true);
                    setDeactivatePin('');
                    setDeactivateError(null);
                  }}
                  className="w-full sm:w-auto h-8 px-3 border border-rose-500 text-rose-500 hover:bg-rose-500 hover:text-white text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <UserX className="w-3.5 h-3.5" />
                  <span>DEACTIVATE MY ACCOUNT</span>
                </button>
              ) : (
                <div className="p-3 bg-card border border-rose-500/50 space-y-2.5 animate-in fade-in">
                  <div className="text-xs font-mono font-bold text-main">
                    ENTER PIN TO CONFIRM DEACTIVATION:
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={deactivatePin}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setDeactivatePin(val);
                        setDeactivateError(null);
                      }}
                      onKeyDown={(e) => {
                        if (
                          e.key === 'Enter' &&
                          (deactivatePin.length === 6 || deactivatePin.length === 4) &&
                          !isDeactivating
                        ) {
                          e.preventDefault();
                          handleDeactivateConfirm();
                        }
                      }}
                      placeholder="••••••"
                      className="w-32 h-8 px-2.5 bg-input border border-main text-center text-sm font-mono tracking-widest text-main focus:outline-none focus:border-rose-500"
                      autoFocus
                    />
                    <button
                      type="button"
                      disabled={(deactivatePin.length !== 6 && deactivatePin.length !== 4) || isDeactivating}
                      onClick={handleDeactivateConfirm}
                      className="h-8 px-3 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-mono font-bold text-xs uppercase cursor-pointer flex items-center gap-1.5 transition-colors"
                    >
                      {isDeactivating ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>DEACTIVATING...</span>
                        </>
                      ) : (
                        <span>CONFIRM DEACTIVATION</span>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={isDeactivating}
                      onClick={() => {
                        setShowDeactivatePrompt(false);
                        setDeactivatePin('');
                        setDeactivateError(null);
                      }}
                      className="h-8 px-2.5 border border-subtle hover:border-main text-sub hover:text-main text-xs font-mono cursor-pointer transition-colors"
                    >
                      CANCEL
                    </button>
                  </div>

                  {deactivateError && (
                    <div className="text-[11px] font-mono text-rose-500 font-bold">
                      {deactivateError}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section 6: Open Source & Repository */}
        <div className="pt-3 border-t border-subtle flex items-center justify-between text-xs font-mono">
          <span className="text-sub uppercase text-[10px] tracking-wider">Zenith // Open Source</span>
          <a
            href="https://github.com/manuja-me/habit-tracker"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sub hover:text-main transition-colors text-[11px] font-bold uppercase underline-offset-4 hover:underline"
          >
            <GithubIcon className="w-3.5 h-3.5" />
            <span>GitHub Repository</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        </div>
      </div>
    </div>
  );
}
