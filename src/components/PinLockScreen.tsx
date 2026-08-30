'use client';

import React, { useState, useEffect, useRef } from 'react';
import { verifyPinAction } from '../lib/server/auth';
import { Lock, ShieldAlert, Delete, Flame, Clock } from 'lucide-react';

interface PinLockScreenProps {
  onUnlock: () => void;
}

export function PinLockScreen({ onUnlock }: PinLockScreenProps) {
  const [pin, setPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  // Auto check URL query string ?pin= on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlPin = params.get('pin');
      if (urlPin && urlPin.length === 4) {
        verifyAndSubmit(urlPin);
      }
    }
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds !== null && lockoutSeconds > 0) {
      const timer = setInterval(() => {
        setLockoutSeconds((prev) => (prev !== null && prev > 1 ? prev - 1 : null));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutSeconds]);

  const verifyAndSubmit = async (enteredPin: string) => {
    if (enteredPin.length !== 4 || isVerifying || lockoutSeconds !== null) return;
    setIsVerifying(true);
    setErrorMsg(null);

    try {
      const result = await verifyPinAction(enteredPin);
      if (result.success) {
        // Clean URL if ?pin= was used
        if (typeof window !== 'undefined' && window.location.search.includes('pin=')) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        onUnlock();
      } else {
        setErrorMsg(result.error || 'Access Denied.');
        if (result.waitSeconds) {
          setLockoutSeconds(result.waitSeconds);
        }
        setPin('');
      }
    } catch (err: any) {
      setErrorMsg('Server verification failed.');
      setPin('');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDigitPress = (digit: string) => {
    if (lockoutSeconds !== null) return;
    if (pin.length < 4 && !isVerifying) {
      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length === 4) {
        verifyAndSubmit(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    if (lockoutSeconds !== null) return;
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (lockoutSeconds !== null) return;
    if (e.key >= '0' && e.key <= '9') {
      handleDigitPress(e.key);
    } else if (e.key === 'Backspace') {
      handleBackspace();
    }
  };

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="min-h-screen bg-main text-main flex flex-col items-center justify-center p-4 selection:bg-emerald-500/30 font-mono select-none outline-none"
    >
      <div className="w-full max-w-sm rounded-none bg-card border border-main p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Terminal Header */}
        <div className="border-b border-subtle pb-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-none bg-emerald-500 flex items-center justify-center text-black font-bold">
                <Flame className="w-3.5 h-3.5 fill-black" />
              </div>
              <span className="text-xs font-bold tracking-widest text-main uppercase">
                ZENITH // SECURE GATE
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-500 font-bold border border-emerald-500/30 px-1.5 py-0.5 bg-emerald-500/10">
              <Lock className="w-3 h-3" />
              PROTECTED
            </div>
          </div>
          <p className="text-[11px] text-sub">
            Server-authenticated session required.
          </p>
        </div>

        {/* PIN Dots Display */}
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-3 py-2">
            {[0, 1, 2, 3].map((index) => {
              const isFilled = pin.length > index;
              return (
                <div
                  key={index}
                  className={`w-11 h-12 rounded-none flex items-center justify-center border text-lg font-bold transition-all duration-100 ${
                    errorMsg
                      ? 'border-rose-500 bg-rose-500/10 text-rose-500'
                      : isFilled
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                      : 'border-main bg-input text-sub'
                  }`}
                >
                  {isFilled ? '●' : '_'}
                </div>
              );
            })}
          </div>

          {errorMsg && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-rose-500 font-bold text-center animate-in fade-in">
              <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {lockoutSeconds !== null && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-amber-500 font-bold text-center">
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
              <span>LOCKOUT ACTIVE: {lockoutSeconds}s REMAINING</span>
            </div>
          )}

          {isVerifying && (
            <div className="text-center text-xs text-emerald-500 animate-pulse font-bold">
              VERIFYING WITH SERVER...
            </div>
          )}
        </div>

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2 pt-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={lockoutSeconds !== null || isVerifying}
              onClick={() => handleDigitPress(digit)}
              className="h-12 rounded-none bg-input hover:bg-subtle border border-main text-sm font-bold text-main transition-all active:scale-95 cursor-pointer flex items-center justify-center font-mono disabled:opacity-40"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            disabled={lockoutSeconds !== null || isVerifying}
            onClick={() => { setPin(''); setErrorMsg(null); }}
            className="h-12 rounded-none bg-input hover:bg-subtle border border-main text-[11px] font-bold text-sub hover:text-main transition-all active:scale-95 cursor-pointer flex items-center justify-center font-mono disabled:opacity-40"
          >
            CLEAR
          </button>
          <button
            type="button"
            disabled={lockoutSeconds !== null || isVerifying}
            onClick={() => handleDigitPress('0')}
            className="h-12 rounded-none bg-input hover:bg-subtle border border-main text-sm font-bold text-main transition-all active:scale-95 cursor-pointer flex items-center justify-center font-mono disabled:opacity-40"
          >
            0
          </button>
          <button
            type="button"
            disabled={lockoutSeconds !== null || isVerifying}
            onClick={handleBackspace}
            className="h-12 rounded-none bg-input hover:bg-subtle border border-main text-sub hover:text-rose-500 transition-all active:scale-95 cursor-pointer flex items-center justify-center font-mono disabled:opacity-40"
            title="Backspace"
          >
            <Delete className="w-4 h-4" />
          </button>
        </div>

        {/* Footer Hint */}
        <div className="pt-2 text-center text-[10px] text-muted-custom border-t border-subtle">
          TIP: ENTER PIN 1001 OR VISIT ?pin=1001 ONCE
        </div>
      </div>
    </div>
  );
}
