'use client';

import React, { useState } from 'react';
import { generateInviteAction } from '../lib/server/auth';
import { X, UserPlus, Copy, Check, ShieldCheck, RefreshCw } from 'lucide-react';
import { ZenithLogo } from './ui/ZenithLogo';

interface InviteFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InviteFriendModal({ isOpen, onClose }: InviteFriendModalProps) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setIsCopied(false);

    try {
      const res = await generateInviteAction();
      if (res.success && res.token) {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        setInviteUrl(`${origin}/join?token=${res.token}`);
      } else {
        setErrorMsg(res.error || 'Failed to generate invitation link.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message || 'A network error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-100 font-mono">
      <div className="w-full max-w-md bg-card border-2 border-main p-5 sm:p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-subtle">
          <div className="flex items-center gap-2">
            <ZenithLogo className="w-7 h-7 flex-shrink-0" />
            <div>
              <div className="text-[10px] font-mono font-bold text-[#FF3B30] uppercase">
                02 // ACCESS CONTROL
              </div>
              <h2 className="text-sm font-black font-sans uppercase tracking-tight text-main">
                INVITE FRIEND (PRIVATE PROFILE)
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-sub hover:text-main hover:bg-subtle transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4">
          <p className="text-xs text-sub leading-relaxed">
            Generate a one-time secret link for your friend. When he opens it, he will create his own name and choose his own private 4-digit PIN.
          </p>

          <div className="p-3 bg-subtle/50 border border-main text-[11px] space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-main">
              <ShieldCheck className="w-4 h-4 text-[#FF3B30]" />
              <span>END-TO-END PRIVACY</span>
            </div>
            <p className="text-sub leading-tight">
              His PIN is encrypted on his device. You will never see his PIN, and neither of you can see each other&apos;s routines.
            </p>
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-[#FF3B30]/10 border border-[#FF3B30]/40 text-[#FF3B30] text-xs font-mono">
              {errorMsg}
            </div>
          )}

          {inviteUrl ? (
            <div className="space-y-2.5 pt-2">
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-main">
                ONE-TIME INVITATION LINK (EXPIRES IN 7 DAYS):
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  readOnly
                  value={inviteUrl}
                  className="flex-1 bg-input border border-main px-3 py-2 text-xs font-mono text-main truncate select-all focus:outline-none"
                />
                <button
                  onClick={handleCopy}
                  className={`px-3.5 py-2 text-xs font-mono font-bold uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
                    isCopied
                      ? 'bg-card text-[#FF3B30] border border-[#FF3B30]'
                      : 'bg-[#FF3B30] hover:bg-[#E02D24] text-white border border-[#FF3B30]'
                  }`}
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>COPIED</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>COPY</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between text-[10px] text-sub pt-1">
                <span>Send via WhatsApp, Telegram, or Signal</span>
                <button
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className="text-sub hover:text-main flex items-center gap-1 underline cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" /> Regenerate
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-2">
              <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="w-full py-3 px-4 bg-[#FF3B30] hover:bg-[#E02D24] text-white font-sans font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-95 transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <span>GENERATING LINK...</span>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>GENERATE SECRET INVITE LINK</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
