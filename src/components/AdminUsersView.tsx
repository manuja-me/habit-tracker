'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { Users, UserPlus, RefreshCw, ShieldCheck, Clock, CheckCircle2, User } from 'lucide-react';
import { getAdminUsersAction, AdminUserRecord } from '../lib/server/actions';

interface AdminUsersViewProps {
  onOpenInvite?: () => void;
}

export function AdminUsersView({ onOpenInvite }: AdminUsersViewProps) {
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchUsers = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await getAdminUsersAction();
      if (res.success && res.users) {
        setUsers(res.users);
      } else {
        setErrorMsg(res.error || 'Failed to retrieve system users.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'A network error occurred while loading directory.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const formatLastLogin = (dateStr: string | null) => {
    if (!dateStr) return { text: 'Never / No login recorded', isRecent: false };
    try {
      const parsed = parseISO(dateStr);
      const diffMs = Date.now() - parsed.getTime();
      const isRecent = diffMs < 1000 * 60 * 30; // within 30 minutes
      const relative = formatDistanceToNow(parsed, { addSuffix: true });
      const exact = format(parsed, 'MMM dd, yyyy • h:mm a');
      return { text: `${relative} (${exact})`, isRecent };
    } catch {
      return { text: dateStr, isRecent: false };
    }
  };

  return (
    <div className="w-full max-w-4xl xl:max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-subtle">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#FF3B30]" />
            <h2 className="text-lg font-black font-sans uppercase tracking-tight text-main">
              System Directory & Users
            </h2>
          </div>
          <p className="text-xs font-mono text-sub">
            Registered accounts, membership roles, and authentication timestamps.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchUsers(true)}
            disabled={isLoading || isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 border border-subtle bg-input hover:border-main text-sub hover:text-main text-xs font-mono font-bold uppercase transition-all cursor-pointer disabled:opacity-50"
            title="Refresh Users"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#FF3B30]' : ''}`} />
            <span>Refresh</span>
          </button>

          {onOpenInvite && (
            <button
              onClick={onOpenInvite}
              className="flex items-center gap-1.5 px-3.5 py-2 border border-[#FF3B30] bg-[#FF3B30] text-white hover:bg-[#E02D24] text-xs font-mono font-bold uppercase transition-all cursor-pointer shadow-xs active:scale-98"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Invite Member</span>
            </button>
          )}
        </div>
      </div>

      {/* Privacy & Isolation Guarantee Banner */}
      <div className="p-4 border border-subtle bg-card shadow-xs space-y-2">
        <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-main">
          <ShieldCheck className="w-4 h-4 text-[#FF3B30]" />
          <span>Security Protocol // Zero Cross-User Visibility</span>
        </div>
        <p className="text-xs font-mono text-sub leading-relaxed">
          Zenith enforces strict multi-tenant data boundaries. Each member&apos;s habits, completions, and daily planner notes are completely isolated. User PINs are cryptographically salted and hashed with SHA-256 — neither administrators nor database queries can access another user&apos;s private data or credentials.
        </p>
      </div>

      {/* Error notification */}
      {errorMsg && (
        <div className="p-3 border border-red-500/50 bg-red-500/10 text-red-400 text-xs font-mono">
          {errorMsg}
        </div>
      )}

      {/* Users Count Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-3.5 border border-main bg-card shadow-xs">
          <div className="text-[10px] font-mono uppercase tracking-wider text-sub">Total Registered Users</div>
          <div className="text-2xl font-black font-sans text-main mt-1">
            {isLoading ? '...' : users.length}
          </div>
        </div>

        <div className="p-3.5 border border-main bg-card shadow-xs">
          <div className="text-[10px] font-mono uppercase tracking-wider text-sub">Owner / Admin</div>
          <div className="text-2xl font-black font-sans text-main mt-1">
            {isLoading ? '...' : users.filter((u) => u.role === 'owner').length}
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 p-3.5 border border-main bg-card shadow-xs">
          <div className="text-[10px] font-mono uppercase tracking-wider text-sub">Invited Members</div>
          <div className="text-2xl font-black font-sans text-main mt-1">
            {isLoading ? '...' : users.filter((u) => u.role === 'member').length}
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="border border-main bg-card shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-subtle flex items-center justify-between bg-subtle">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-main">
            Registered Accounts ({users.length})
          </span>
          <span className="text-[10px] font-mono text-sub uppercase">
            LIVE SYNCHRONIZED
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs font-mono text-sub">
            Loading system directory...
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-xs font-mono text-sub">
            No registered users found.
          </div>
        ) : (
          <div className="divide-y divide-subtle">
            {users.map((u) => {
              const loginInfo = formatLastLogin(u.last_login_at);
              const isOwner = u.role === 'owner';
              const createdDate = format(parseISO(u.created_at), 'MMM dd, yyyy');

              return (
                <div
                  key={u.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-subtle/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 flex items-center justify-center font-mono font-bold text-xs border select-none ${
                        isOwner
                          ? 'border-[#FF3B30] bg-[#FF3B30]/15 text-[#FF3B30]'
                          : 'border-main bg-input text-main'
                      }`}
                    >
                      {u.username.slice(0, 2).toUpperCase()}
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-sans font-bold text-main">
                          {u.username}
                        </span>
                        <span
                          className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 border ${
                            isOwner
                              ? 'border-[#FF3B30] text-[#FF3B30] bg-[#FF3B30]/10'
                              : 'border-subtle text-sub bg-input'
                          }`}
                        >
                          {isOwner ? 'OWNER / ADMIN' : 'MEMBER'}
                        </span>
                      </div>

                      <div className="text-[11px] font-mono text-sub">
                        Joined on {createdDate}
                      </div>
                    </div>
                  </div>

                  {/* Last Logged In Timestamp */}
                  <div className="flex sm:flex-col sm:items-end justify-between items-center text-right font-mono text-xs pt-2 sm:pt-0 border-t sm:border-t-0 border-subtle">
                    <div className="flex items-center gap-1.5 text-main text-[11px]">
                      <span
                        className={`w-2 h-2 rounded-full inline-block ${
                          loginInfo.isRecent ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-500'
                        }`}
                        title={loginInfo.isRecent ? 'Active recently' : 'Inactive'}
                      />
                      <Clock className="w-3 h-3 text-sub" />
                      <span className="font-bold">Last Logged In:</span>
                    </div>
                    <span className="text-[11px] text-sub mt-0.5">
                      {loginInfo.text}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
