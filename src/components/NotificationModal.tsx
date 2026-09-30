'use client';

import React, { useState } from 'react';
import { Bell, Check, X, Clock, ShieldAlert } from 'lucide-react';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NOTIF_TIME_KEY = 'zenith_reminder_time';
const NOTIF_ENABLED_KEY = 'zenith_reminder_enabled';

export function NotificationModal({ isOpen, onClose }: NotificationModalProps) {
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });
  const [enabled, setEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(NOTIF_ENABLED_KEY) === 'true';
    }
    return false;
  });
  const [time, setTime] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(NOTIF_TIME_KEY) || '20:30';
    }
    return '20:30';
  });
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleRequestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const res = await Notification.requestPermission();
      setPermission(res);
      if (res === 'granted') {
        setEnabled(true);
        localStorage.setItem(NOTIF_ENABLED_KEY, 'true');
        new Notification('Zenith Reminders Active', {
          body: `Daily check-in reminder scheduled for ${time}`,
          icon: '/icon.png',
        });
      }
    } catch {}
  };

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(NOTIF_ENABLED_KEY, String(enabled));
      localStorage.setItem(NOTIF_TIME_KEY, time);
    }
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  const isSupported = typeof window !== 'undefined' && 'Notification' in window;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-black/75 backdrop-blur-xs font-mono">
      <div className="w-full max-w-md bg-card border border-main p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-subtle pb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-none bg-[#FF3B30]/15 text-[#FF3B30] border border-[#FF3B30]/30 flex items-center justify-center">
              <Bell className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-main">
              DAILY REMINDER NOTIFICATIONS
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-sub hover:text-main hover:bg-input transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isSupported ? (
          <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            Notifications are not supported in this browser environment.
          </div>
        ) : (
          <div className="space-y-4">
            {permission !== 'granted' ? (
              <div className="p-3 bg-input border border-subtle space-y-2">
                <div className="text-xs font-bold text-main flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  BROWSER PERMISSION REQUIRED
                </div>
                <p className="text-[11px] text-sub">
                  Allow browser notifications so Zenith can alert you when habits remain incomplete before day ends.
                </p>
                <button
                  onClick={handleRequestPermission}
                  className="w-full py-2 font-bold text-xs bg-[#FF3B30] text-white hover:bg-[#E02D24] uppercase transition-colors"
                >
                  ALLOW NOTIFICATIONS
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-input border border-subtle">
                  <div>
                    <div className="text-xs font-bold text-main">ENABLE DAILY REMINDER</div>
                    <div className="text-[10px] text-sub">Notify if pending habits exist</div>
                  </div>
                  <button
                    onClick={() => setEnabled(!enabled)}
                    className={`h-10 sm:h-8 px-3.5 sm:px-3 text-xs font-bold font-mono transition-colors border flex items-center justify-center cursor-pointer touch-manipulation active:scale-95 ${
                      enabled
                        ? 'bg-[#FF3B30] text-white border-[#FF3B30]'
                        : 'bg-card text-sub border-subtle'
                    }`}
                  >
                    {enabled ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>

                <div className="p-3 bg-input border border-subtle space-y-1.5">
                  <label className="text-xs font-bold text-main flex items-center gap-1.5">
                    <Clock className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-[#FF3B30]" />
                    REMINDER TIME (24H)
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full bg-card border border-main px-3 py-2.5 sm:py-2 text-sm font-mono text-main outline-none focus:border-[#FF3B30] min-h-[44px] sm:min-h-0"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="pt-3 border-t border-subtle flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="h-11 sm:h-9 px-4 text-xs font-mono font-medium text-sub hover:text-main uppercase cursor-pointer touch-manipulation flex items-center justify-center"
          >
            CANCEL
          </button>
          <button
            onClick={handleSave}
            className="flex items-center justify-center gap-1.5 h-11 sm:h-9 px-5 text-xs font-mono font-bold bg-[#FF3B30] text-white hover:bg-[#E02D24] uppercase transition-colors active:scale-95 cursor-pointer touch-manipulation"
          >
            {saved ? <Check className="w-4 h-4" /> : null}
            {saved ? 'SAVED' : 'SAVE SETTINGS'}
          </button>
        </div>
      </div>
    </div>
  );
}
