'use client';

import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useHabitStore } from '../lib/store';
import { 
  X, 
  Cloud, 
  Smartphone, 
  Laptop, 
  ShieldCheck, 
  KeyRound, 
  Mail, 
  Check, 
  AlertCircle,
  ExternalLink 
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { user } = useHabitStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !isSupabaseConfigured) return;

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        setMessage('Success! Check your email to confirm your account or sign in.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        setMessage('Signed in successfully! Your habits are syncing.');
        setTimeout(() => onClose(), 1000);
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-3xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Cloud className="w-4 h-4" />
            </div>
            <h2 className="text-base font-semibold text-white">
              Multi-Device Cloud Sync
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* If Supabase is not configured yet */}
        {!isSupabaseConfigured ? (
          <div className="pt-4 space-y-4">
            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-300 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <ShieldCheck className="w-4 h-4" />
                Local Standalone Mode Active
              </div>
              <p className="text-neutral-400 leading-relaxed">
                Your habits are currently saved securely in your browser storage with zero latency.
              </p>
              <p className="text-neutral-400 leading-relaxed">
                To enable <strong>multi-device cloud sync across your phone & laptop</strong>, connect your free Supabase project by adding these environment variables to <code className="text-emerald-400">.env.local</code> or Vercel:
              </p>
              <div className="p-2.5 rounded-xl bg-neutral-900 font-mono text-[11px] text-neutral-300 space-y-1">
                <div>NEXT_PUBLIC_SUPABASE_URL=https://...</div>
                <div>NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...</div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl transition-all"
            >
              Continue in Local Mode
            </button>
          </div>
        ) : user ? (
          /* User is signed in */
          <div className="pt-4 space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <Check className="w-4 h-4 text-emerald-400" />
                Logged in & Synced
              </div>
              <p className="text-neutral-300">
                Account: <span className="font-mono text-white font-semibold">{user.email}</span>
              </p>
              <p className="text-neutral-400 text-[11px]">
                All habits and daily completions are automatically synced across your devices.
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                onClick={handleSignOut}
                disabled={loading}
                className="w-full py-2.5 text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl transition-all"
              >
                {loading ? 'Signing out...' : 'Sign Out'}
              </button>
              <button
                onClick={onClose}
                className="w-full py-2.5 text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl transition-all"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          /* Sign In / Sign Up Form */
          <form onSubmit={handleAuth} className="space-y-4 pt-4">
            <p className="text-xs text-neutral-400">
              Sign in to automatically sync your habits between your phone, tablet, and computer.
            </p>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {message && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
                <Check className="w-4 h-4 flex-shrink-0" />
                <span>{message}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl shadow-md shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-xs text-neutral-400 hover:text-emerald-400 transition-colors"
              >
                {isSignUp
                  ? 'Already have an account? Sign In'
                  : 'New user? Create a free account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
