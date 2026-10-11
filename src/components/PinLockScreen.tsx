'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { verifyPinAction, reactivateAccountAction, lockSessionAction, changePinAction } from '../lib/server/auth';
import { Lock, ShieldAlert, Delete, Clock, ShieldCheck } from 'lucide-react';
import { ReactivationModal } from './ReactivationModal';
import { ZenithLogo } from './ui/ZenithLogo';

interface PinLockScreenProps {
  onUnlock: () => void;
}

export function PinLockScreen({ onUnlock }: PinLockScreenProps) {
  const [pin, setPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [legacyPinToUpgrade, setLegacyPinToUpgrade] = useState<string | null>(null);
  const [pendingNewPin, setPendingNewPin] = useState<string | null>(null);
  const [reactivationInfo, setReactivationInfo] = useState<{
    username: string;
    deactivatedAt: string;
    remainingMs: number;
  } | null>(null);
  const [isReactivating, setIsReactivating] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef(pin);
  const isVerifyingRef = useRef(isVerifying);
  const lockoutSecondsRef = useRef(lockoutSeconds);
  const reactivationInfoRef = useRef(reactivationInfo);
  const legacyPinRef = useRef(legacyPinToUpgrade);
  const pendingNewPinRef = useRef(pendingNewPin);

  useEffect(() => {
    pinRef.current = pin;
    isVerifyingRef.current = isVerifying;
    lockoutSecondsRef.current = lockoutSeconds;
    reactivationInfoRef.current = reactivationInfo;
    legacyPinRef.current = legacyPinToUpgrade;
    pendingNewPinRef.current = pendingNewPin;
  }, [pin, isVerifying, lockoutSeconds, reactivationInfo, legacyPinToUpgrade, pendingNewPin]);

  // Auto focus container on mount so key events work instantly without clicking
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds !== null && lockoutSeconds > 0) {
      const timer = setInterval(() => {
        setLockoutSeconds((prev) => {
          const next = prev !== null && prev > 1 ? prev - 1 : null;
          lockoutSecondsRef.current = next;
          return next;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutSeconds]);

  const submitPinUpgrade = useCallback(async (oldPin: string, newSixDigitPin: string) => {
    isVerifyingRef.current = true;
    setIsVerifying(true);
    setErrorMsg(null);
    try {
      const res = await changePinAction(oldPin, newSixDigitPin);
      if (res.success) {
        onUnlock();
      } else {
        setErrorMsg(res.error || 'FAILED TO UPGRADE PIN');
        pendingNewPinRef.current = null;
        setPendingNewPin(null);
        pinRef.current = '';
        setPin('');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message || 'FAILED TO UPGRADE PIN');
      pendingNewPinRef.current = null;
      setPendingNewPin(null);
      pinRef.current = '';
      setPin('');
    } finally {
      isVerifyingRef.current = false;
      setIsVerifying(false);
    }
  }, [onUnlock]);

  const verifyAndSubmit = useCallback(async (enteredPin: string) => {
    if (
      (enteredPin.length !== 6 && enteredPin.length !== 4) ||
      isVerifyingRef.current ||
      lockoutSecondsRef.current !== null ||
      reactivationInfoRef.current !== null
    ) {
      return;
    }
    isVerifyingRef.current = true;
    setIsVerifying(true);
    setErrorMsg(null);

    try {
      const result = await verifyPinAction(enteredPin);
      if (result.success) {
        if (result.requiresReactivation && result.deactivatedAt) {
          setReactivationInfo({
            username: result.user?.username || 'member',
            deactivatedAt: result.deactivatedAt,
            remainingMs: result.remainingMs || 0,
          });
          return;
        }
        if (result.isLegacyPin) {
          legacyPinRef.current = enteredPin;
          setLegacyPinToUpgrade(enteredPin);
          pinRef.current = '';
          setPin('');
          return;
        }
        onUnlock();
      } else {
        setErrorMsg(result.error || 'INVALID PIN // ACCESS DENIED');
        if (result.waitSeconds) {
          setLockoutSeconds(result.waitSeconds);
          lockoutSecondsRef.current = result.waitSeconds;
        }
        pinRef.current = '';
        setPin('');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('verifyPinAction client exception:', message);
      setErrorMsg(message ? `SERVER ERROR: ${message}` : 'SERVER VERIFICATION FAILED');
      pinRef.current = '';
      setPin('');
    } finally {
      isVerifyingRef.current = false;
      setIsVerifying(false);
    }
  }, [onUnlock]);

  const handleConfirmReactivation = async () => {
    if (isReactivating) return;
    setIsReactivating(true);
    try {
      const res = await reactivateAccountAction();
      if (res.success) {
        setReactivationInfo(null);
        pinRef.current = '';
        setPin('');
        onUnlock();
      } else {
        setErrorMsg(res.error || 'Failed to reactivate account.');
        setReactivationInfo(null);
        pinRef.current = '';
        setPin('');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message || 'Error occurred during account reactivation.');
      setReactivationInfo(null);
      pinRef.current = '';
      setPin('');
    } finally {
      setIsReactivating(false);
    }
  };

  const handleKeepDeactivated = async () => {
    setReactivationInfo(null);
    pinRef.current = '';
    setPin('');
    try {
      await lockSessionAction();
    } catch {}
    setErrorMsg('ACCOUNT REMAINS DEACTIVATED // Countdown continues.');
  };

  const handleDigitPress = useCallback((digit: string) => {
    if (lockoutSecondsRef.current !== null || isVerifyingRef.current) return;
    const currentPin = pinRef.current;
    if (currentPin.length < 6) {
      const nextPin = currentPin + digit;
      pinRef.current = nextPin;
      setPin(nextPin);
      if (nextPin.length === 6) {
        if (legacyPinRef.current) {
          if (!pendingNewPinRef.current) {
            pendingNewPinRef.current = nextPin;
            setPendingNewPin(nextPin);
            pinRef.current = '';
            setPin('');
            setErrorMsg(null);
          } else if (pendingNewPinRef.current === nextPin) {
            submitPinUpgrade(legacyPinRef.current, nextPin);
          } else {
            setErrorMsg('PINS DO NOT MATCH // Enter new 6-digit PIN again.');
            pendingNewPinRef.current = null;
            setPendingNewPin(null);
            pinRef.current = '';
            setPin('');
          }
        } else {
          verifyAndSubmit(nextPin);
        }
      }
    }
  }, [verifyAndSubmit, submitPinUpgrade]);

  const handleBackspace = useCallback(() => {
    if (lockoutSecondsRef.current !== null || isVerifyingRef.current) return;
    const nextPin = pinRef.current.slice(0, -1);
    pinRef.current = nextPin;
    setPin(nextPin);
    setErrorMsg(null);
  }, []);

  const handleClear = useCallback(() => {
    if (lockoutSecondsRef.current !== null || isVerifyingRef.current) return;
    pinRef.current = '';
    setPin('');
    setErrorMsg(null);
  }, []);

  // Global window listener: allows immediate typing anywhere on the page without clicking
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (
        lockoutSecondsRef.current !== null ||
        isVerifyingRef.current ||
        reactivationInfoRef.current !== null
      ) {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigitPress(e.key);
      } else if (e.key === 'Enter' && !legacyPinRef.current && (pinRef.current.length === 4 || pinRef.current.length === 6)) {
        e.preventDefault();
        verifyAndSubmit(pinRef.current);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleDigitPress, handleBackspace, handleClear, verifyAndSubmit]);

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').trim();
    if (legacyPinRef.current) return;
    if (/^\d{4}$|^\d{6}$/.test(text) && lockoutSecondsRef.current === null && !isVerifyingRef.current) {
      e.preventDefault();
      pinRef.current = text;
      setPin(text);
      verifyAndSubmit(text);
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onPaste={handlePaste}
      className="min-h-screen bg-main text-main flex flex-col items-center justify-center p-3.5 sm:p-6 font-mono select-none outline-none focus:outline-none"
    >
      <div className="w-full max-w-[360px] sm:max-w-[400px] bg-card border-2 border-main p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Swiss Masthead */}
        <div className="border-b border-subtle pb-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ZenithLogo className="w-8 h-8 flex-shrink-0" />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-mono font-bold text-[#FF3B30]">00 //</span>
                  <h1 className="text-base sm:text-lg font-black font-sans uppercase tracking-tight text-main">
                    {legacyPinToUpgrade ? 'PIN MIGRATION' : 'ZENITH GATE'}
                  </h1>
                </div>
                <div className="text-[9px] font-mono tracking-widest text-sub uppercase">
                  {legacyPinToUpgrade
                    ? pendingNewPin
                      ? 'STEP 2 OF 2 // CONFIRM 6-DIGIT PIN'
                      : 'STEP 1 OF 2 // SET NEW 6-DIGIT PIN'
                    : 'AUTHENTICATION PROTOCOL'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-[#FF3B30] border border-[#FF3B30] px-2 py-0.5 bg-[#FF3B30]/10">
              <Lock className="w-3 h-3" />
              <span>{legacyPinToUpgrade ? 'UPGRADE' : 'SECURED'}</span>
            </div>
          </div>
          <p className="text-xs font-mono text-sub pt-1 leading-tight">
            {legacyPinToUpgrade
              ? pendingNewPin
                ? 'Re-enter your new 6-digit PIN to save Scrypt upgrade and unlock.'
                : '4-digit PIN verified. Enter a new 6-digit PIN to upgrade your account.'
              : 'Enter 6-digit protocol PIN to unlock your personal workspace.'}
          </p>
        </div>

        {/* PIN Digits Display (Swiss Modular 6-Slot Grid) */}
        <div className="space-y-3">
          <div className="grid grid-cols-6 gap-1.5 sm:gap-2 py-1">
            {[0, 1, 2, 3, 4, 5].map((index) => {
              const isFilled = pin.length > index;
              return (
                <div
                  key={index}
                  className={`h-13 sm:h-14 rounded-none flex items-center justify-center border-2 transition-all duration-100 ${
                    errorMsg
                      ? 'border-[#FF3B30] bg-[#FF3B30]/10 text-[#FF3B30]'
                      : isFilled
                      ? 'border-[#FF3B30] bg-subtle text-main shadow-xs'
                      : 'border-main bg-input text-sub'
                  }`}
                >
                  {isFilled ? (
                    <span className="w-3 h-3 rounded-none bg-[#FF3B30] shadow-xs" />
                  ) : (
                    <span className="text-[11px] font-mono text-muted-custom font-bold">
                      {`0${index + 1}`}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {!legacyPinToUpgrade && pin.length === 4 && !isVerifying && lockoutSeconds === null && (
            <button
              type="button"
              onClick={() => verifyAndSubmit(pin)}
              className="w-full py-1.5 px-2.5 bg-subtle hover:bg-[#FF3B30]/15 border border-main hover:border-[#FF3B30] text-[10px] font-mono font-bold uppercase tracking-wider text-sub hover:text-[#FF3B30] transition-colors cursor-pointer"
            >
              USING LEGACY 4-DIGIT PIN? PRESS ENTER [↵] TO UNLOCK
            </button>
          )}

          {legacyPinToUpgrade && !isVerifying && (
            <button
              type="button"
              onClick={() => onUnlock()}
              className="w-full py-1.5 px-2.5 bg-subtle hover:bg-input border border-subtle text-[10px] font-mono font-bold uppercase tracking-wider text-sub hover:text-main transition-colors cursor-pointer"
            >
              SKIP FOR NOW // UPGRADE LATER IN SETTINGS →
            </button>
          )}

          {/* Feedback & Status Indicators */}
          {errorMsg && (
            <div className="p-2.5 bg-[#FF3B30]/10 border border-[#FF3B30] text-[#FF3B30] text-xs font-mono font-bold text-center flex items-center justify-center gap-1.5 animate-in fade-in">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {lockoutSeconds !== null && (
            <div className="p-2.5 bg-amber-500/10 border border-amber-500 text-amber-500 text-xs font-mono font-bold text-center flex items-center justify-center gap-1.5 animate-in fade-in">
              <Clock className="w-4 h-4 flex-shrink-0 animate-pulse" />
              <span>
                LOCKOUT ACTIVE // {lockoutSeconds >= 3600
                  ? `${Math.floor(lockoutSeconds / 3600)}h ${Math.floor((lockoutSeconds % 3600) / 60)}m`
                  : lockoutSeconds >= 60
                  ? `${Math.floor(lockoutSeconds / 60)}m ${String(lockoutSeconds % 60).padStart(2, '0')}s`
                  : `${lockoutSeconds}s`} REMAINING
              </span>
            </div>
          )}

          {isVerifying && (
            <div className="p-2.5 bg-subtle border border-main text-xs font-mono font-bold text-center flex items-center justify-center gap-2 text-main">
              <div className="w-3.5 h-3.5 border-2 border-[#FF3B30] border-t-transparent animate-spin" />
              <span>AUTHENTICATING PROTOCOL...</span>
            </div>
          )}
        </div>

        {/* Numeric Keypad (High Contrast Swiss Keypad) */}
        <div className="grid grid-cols-3 gap-2 sm:gap-2.5 pt-1">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={lockoutSeconds !== null || isVerifying}
              onClick={() => handleDigitPress(digit)}
              className="h-14 sm:h-16 rounded-none bg-input hover:bg-subtle active:bg-[#FF3B30] active:text-white border border-main hover:border-[#FF3B30] text-xl sm:text-2xl font-black font-sans text-main transition-all active:scale-[0.96] cursor-pointer flex items-center justify-center disabled:opacity-30 touch-manipulation select-none shadow-xs"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            disabled={lockoutSeconds !== null || isVerifying}
            onClick={handleClear}
            className="h-14 sm:h-16 rounded-none bg-input hover:bg-subtle active:bg-neutral-800 border border-main text-xs font-mono font-black tracking-wider text-sub hover:text-main transition-all active:scale-[0.96] cursor-pointer flex items-center justify-center disabled:opacity-30 touch-manipulation select-none"
          >
            CLEAR
          </button>
          <button
            type="button"
            disabled={lockoutSeconds !== null || isVerifying}
            onClick={() => handleDigitPress('0')}
            className="h-14 sm:h-16 rounded-none bg-input hover:bg-subtle active:bg-[#FF3B30] active:text-white border border-main hover:border-[#FF3B30] text-xl sm:text-2xl font-black font-sans text-main transition-all active:scale-[0.96] cursor-pointer flex items-center justify-center disabled:opacity-30 touch-manipulation select-none shadow-xs"
          >
            0
          </button>
          <button
            type="button"
            disabled={lockoutSeconds !== null || isVerifying}
            onClick={handleBackspace}
            className="h-14 sm:h-16 rounded-none bg-input hover:bg-subtle active:bg-[#FF3B30]/20 border border-main text-sub hover:text-[#FF3B30] transition-all active:scale-[0.96] cursor-pointer flex items-center justify-center disabled:opacity-30 touch-manipulation select-none"
            title="Backspace"
            aria-label="Backspace"
          >
            <Delete className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Telemetry & Keyboard Hint */}
        <div className="pt-3 border-t border-subtle flex items-center justify-between text-[10px] font-mono text-sub">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-[#FF3B30]" /> SCRYPT-64 // DB GUARD
          </span>
          <span className="uppercase tracking-widest text-muted-custom">
            KEYBOARD READY [0-9]
          </span>
        </div>
      </div>

      {reactivationInfo && (
        <ReactivationModal
          isOpen={Boolean(reactivationInfo)}
          username={reactivationInfo.username}
          deactivatedAt={reactivationInfo.deactivatedAt}
          initialRemainingMs={reactivationInfo.remainingMs}
          onReactivate={handleConfirmReactivation}
          onKeepDeactivated={handleKeepDeactivated}
          isProcessing={isReactivating}
        />
      )}
    </div>
  );
}
