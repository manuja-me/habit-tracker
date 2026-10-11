'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { validateInviteTokenAction, completeInviteSetupAction } from '../../lib/server/auth';
import { ShieldCheck, ShieldAlert, ArrowRight, User, KeyRound, Check } from 'lucide-react';
import { ZenithLogo } from '../../components/ui/ZenithLogo';

function JoinForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';

  const [isValidating, setIsValidating] = useState<boolean>(() => Boolean(token));
  const [isValidToken, setIsValidToken] = useState<boolean>(false);
  const [tokenError, setTokenError] = useState<string | null>(() => {
    return token ? null : 'No invitation token was provided in the link.';
  });

  const [username, setUsername] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (!token) return;

    let ignore = false;
    validateInviteTokenAction(token)
      .then((res) => {
        if (ignore) return;
        setIsValidating(false);
        if (res.valid) {
          setIsValidToken(true);
        } else {
          setIsValidToken(false);
          setTokenError(res.error || 'Invitation is invalid or has already been used.');
        }
      })
      .catch(() => {
        if (ignore) return;
        setIsValidating(false);
        setIsValidToken(false);
        setTokenError('Failed to validate invitation token.');
      });

    return () => {
      ignore = true;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = username.trim();
    if (!cleanName || cleanName.length < 2) {
      setErrorMsg('Please enter a display name (at least 2 characters).');
      return;
    }

    if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      setErrorMsg('PIN must be exactly 6 numeric digits.');
      return;
    }

    if (pin !== confirmPin) {
      setErrorMsg('PINs do not match. Please re-enter.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await completeInviteSetupAction(token, cleanName, pin);
      if (res.success) {
        setIsSuccess(true);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('zenith_session_unlocked', 'true');
        }
        setTimeout(() => {
          router.push('/');
        }, 800);
      } else {
        setErrorMsg(res.error || 'Failed to complete registration.');
        setIsSubmitting(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message || 'A network error occurred.');
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#FF3B30] border-t-transparent animate-spin" />
        <span className="text-xs font-mono uppercase tracking-wider text-sub">
          VALIDATING INVITATION...
        </span>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="w-full max-w-md bg-card border border-main p-6 sm:p-8 space-y-4 text-center">
        <div className="w-12 h-12 rounded-none bg-[#FF3B30]/15 text-[#FF3B30] border border-[#FF3B30]/40 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-base font-black font-sans uppercase tracking-tight text-main">
          INVITATION INVALID
        </h2>
        <p className="text-xs font-mono text-sub leading-relaxed">
          {tokenError || 'This invitation link is expired, invalid, or has already been consumed.'}
        </p>
        <div className="pt-3">
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 px-4 bg-subtle text-main border border-main text-xs font-mono font-bold uppercase hover:bg-neutral-800 transition-colors"
          >
            RETURN TO ZENITH HOME
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-card border-2 border-main p-6 sm:p-8 space-y-6 shadow-xl">
      {/* Swiss Masthead */}
      <div className="pb-4 border-b border-subtle">
        <div className="flex items-center gap-2 mb-1">
          <ZenithLogo className="w-6 h-6 flex-shrink-0" />
          <span className="text-xs font-mono font-black text-[#FF3B30]">ZENITH // ONBOARDING</span>
        </div>
        <h1 className="text-xl font-black font-sans uppercase tracking-tight text-main">
          PRIVATE PROFILE SETUP
        </h1>
        <p className="text-xs font-mono text-sub mt-1">
          Set up your private account and choose your personal 6-digit PIN.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-[#FF3B30]/10 border border-[#FF3B30]/40 text-[#FF3B30] text-xs font-mono flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {isSuccess && (
        <div className="p-3 bg-[#FF3B30]/15 border border-[#FF3B30]/40 text-[#FF3B30] text-xs font-mono flex items-center gap-2">
          <Check className="w-4 h-4 flex-shrink-0" />
          <span>Profile created successfully! Initializing workspace...</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name input */}
        <div className="space-y-1.5">
          <label className="block text-xs font-mono font-bold uppercase tracking-wider text-sub">
            YOUR NAME OR HANDLE
          </label>
          <div className="relative flex items-center">
            <User className="absolute left-3 w-4 h-4 text-sub" />
            <input
              type="text"
              required
              disabled={isSubmitting || isSuccess}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Alex"
              className="w-full pl-9 pr-3 py-2.5 bg-input border border-main text-xs font-mono text-main placeholder-muted-custom focus:outline-none focus:border-[#FF3B30] transition-colors"
            />
          </div>
        </div>

        {/* 6-digit PIN */}
        <div className="space-y-1.5">
          <label className="block text-xs font-mono font-bold uppercase tracking-wider text-sub">
            CHOOSE A 6-DIGIT PIN
          </label>
          <div className="relative flex items-center">
            <KeyRound className="absolute left-3 w-4 h-4 text-sub" />
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              required
              disabled={isSubmitting || isSuccess}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              className="w-full pl-9 pr-3 py-2.5 bg-input border border-main text-base font-mono tracking-widest text-main placeholder-muted-custom focus:outline-none focus:border-[#FF3B30] transition-colors"
            />
          </div>
        </div>

        {/* Confirm PIN */}
        <div className="space-y-1.5">
          <label className="block text-xs font-mono font-bold uppercase tracking-wider text-sub">
            CONFIRM 6-DIGIT PIN
          </label>
          <div className="relative flex items-center">
            <KeyRound className="absolute left-3 w-4 h-4 text-sub" />
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              required
              disabled={isSubmitting || isSuccess}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              className="w-full pl-9 pr-3 py-2.5 bg-input border border-main text-base font-mono tracking-widest text-main placeholder-muted-custom focus:outline-none focus:border-[#FF3B30] transition-colors"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting || isSuccess}
            className="w-full py-3.5 px-4 bg-[#FF3B30] hover:bg-[#E02D24] text-white font-sans font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-95 transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>INITIALIZING...</span>
            ) : (
              <>
                <span>SET PIN & LAUNCH TRACKER</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Privacy Notice */}
      <div className="p-3 bg-subtle/60 border border-main text-[11px] font-mono text-sub space-y-1">
        <div className="flex items-center gap-1.5 font-bold text-main">
          <ShieldCheck className="w-3.5 h-3.5 text-[#FF3B30]" />
          <span>ZERO-KNOWLEDGE PRIVACY</span>
        </div>
        <p className="leading-tight">
          Your PIN is securely salted and encrypted before saving. Nobody else—including the database owner—can see your PIN, habits, or streaks.
        </p>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <div className="min-h-screen bg-main text-main flex flex-col items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="text-xs font-mono uppercase text-sub">
            LOADING INVITATION...
          </div>
        }
      >
        <JoinForm />
      </Suspense>
    </div>
  );
}
