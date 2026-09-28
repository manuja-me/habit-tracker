'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import {
  Users,
  UserPlus,
  RefreshCw,
  ShieldCheck,
  Clock,
  Trash2,
  AlertTriangle,
  AlertOctagon,
} from 'lucide-react';
import {
  getAdminUsersAction,
  adminDeleteUserAction,
  AdminUserRecord,
} from '../lib/server/actions';

interface AdminUsersViewProps {
  onOpenInvite?: () => void;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function AdminUsersView({ onOpenInvite }: AdminUsersViewProps) {
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState<string | null>(null);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

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

  const isUserInactive30Days = (u: AdminUserRecord) => {
    if (u.role === 'owner') return false;
    if (u.deactivated_at) return false;
    const rawDate = u.last_login_at || u.created_at;
    if (!rawDate) return false;
    const timestamp = new Date(rawDate).getTime();
    if (isNaN(timestamp)) return false;
    return Date.now() - timestamp >= THIRTY_DAYS_MS;
  };

  const getDeactivationStatus = (deactivatedAt: string | null | undefined) => {
    if (!deactivatedAt) return null;
    const deactTime = new Date(deactivatedAt).getTime();
    if (isNaN(deactTime)) return null;
    const remainingMs = SEVEN_DAYS_MS - (Date.now() - deactTime);
    if (remainingMs <= 0) {
      return { isExpired: true, text: 'AUTO-PURGE EXPIRED' };
    }
    const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    const countdownText = days > 0
      ? `AUTO-PURGE IN ${days}d ${hours}h`
      : hours > 0
      ? `AUTO-PURGE IN ${hours}h ${minutes}m`
      : `AUTO-PURGE IN ${Math.max(1, minutes)}m`;
    return { isExpired: false, text: countdownText };
  };

  const handleConfirmDelete = async (userId: string) => {
    if (isDeleting) return;
    setIsDeleting(true);
    setErrorMsg(null);
    setDeleteSuccessMsg(null);

    try {
      const res = await adminDeleteUserAction(userId);
      if (res.success) {
        setConfirmDeleteUserId(null);
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        setDeleteSuccessMsg('USER DELETED // All habits, logs, and account records permanently wiped.');
        setTimeout(() => setDeleteSuccessMsg(null), 4000);
        await fetchUsers(true);
      } else {
        setErrorMsg(res.error || 'Failed to delete user.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error occurred while deleting user.');
    } finally {
      setIsDeleting(false);
    }
  };

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

      {/* Status Notifications */}
      {errorMsg && (
        <div className="p-3 border border-red-500/50 bg-red-500/10 text-red-400 text-xs font-mono">
          {errorMsg}
        </div>
      )}

      {deleteSuccessMsg && (
        <div className="p-3 border border-emerald-500/50 bg-emerald-500/10 text-emerald-400 text-xs font-mono">
          {deleteSuccessMsg}
        </div>
      )}

      {/* Users Count Summary (4 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 border border-main bg-card shadow-xs">
          <div className="text-[10px] font-mono uppercase tracking-wider text-sub">Total Users</div>
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

        <div className="p-3.5 border border-amber-500/50 bg-card shadow-xs">
          <div className="text-[10px] font-mono uppercase tracking-wider text-amber-500 font-bold">
            Inactive (30+ Days)
          </div>
          <div className="text-2xl font-black font-sans text-amber-500 mt-1">
            {isLoading ? '...' : users.filter(isUserInactive30Days).length}
          </div>
        </div>

        <div className="p-3.5 border border-rose-500/50 bg-card shadow-xs">
          <div className="text-[10px] font-mono uppercase tracking-wider text-rose-500 font-bold">
            Deactivating (7d)
          </div>
          <div className="text-2xl font-black font-sans text-rose-500 mt-1">
            {isLoading ? '...' : users.filter((u) => u.role !== 'owner' && u.deactivated_at != null).length}
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
              const deactInfo = getDeactivationStatus(u.deactivated_at);
              const isInactive30 = isUserInactive30Days(u);

              return (
                <div
                  key={u.id}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    u.deactivated_at
                      ? 'bg-rose-500/5 hover:bg-rose-500/10'
                      : isInactive30
                      ? 'bg-amber-500/5 hover:bg-amber-500/10'
                      : 'hover:bg-subtle/50'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div
                      className={`w-9 h-9 flex items-center justify-center font-mono font-bold text-xs border select-none shrink-0 ${
                        isOwner
                          ? 'border-[#FF3B30] bg-[#FF3B30]/15 text-[#FF3B30]'
                          : u.deactivated_at
                          ? 'border-rose-500 bg-rose-500/20 text-rose-500'
                          : isInactive30
                          ? 'border-amber-500 bg-amber-500/20 text-amber-500'
                          : 'border-main bg-input text-main'
                      }`}
                    >
                      {u.username.slice(0, 2).toUpperCase()}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
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

                        {/* Deactivation Badge */}
                        {u.deactivated_at && (
                          <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 border border-rose-500/60 text-rose-500 bg-rose-500/10 flex items-center gap-1">
                            <AlertOctagon className="w-2.5 h-2.5" />
                            <span>DEACTIVATING // {deactInfo?.text || 'PENDING WIPE'}</span>
                          </span>
                        )}

                        {/* Inactivity Badge */}
                        {isInactive30 && (
                          <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 border border-amber-500/60 text-amber-500 bg-amber-500/10 flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>INACTIVE 30+ DAYS // NO LOGIN IN A LONG TIME</span>
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] font-mono text-sub">
                        Joined on {createdDate}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Last Logged In Timestamp + Delete Action */}
                  <div className="flex flex-col sm:items-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-subtle">
                    <div className="flex items-center gap-1.5 text-main text-[11px] font-mono">
                      <span
                        className={`w-2 h-2 rounded-full inline-block ${
                          loginInfo.isRecent ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-500'
                        }`}
                        title={loginInfo.isRecent ? 'Active recently' : 'Inactive'}
                      />
                      <Clock className="w-3 h-3 text-sub" />
                      <span className="font-bold">Last Logged In:</span>
                      <span className="text-sub">{loginInfo.text}</span>
                    </div>

                    {/* Admin Delete User Button (Non-Owner Only) */}
                    {!isOwner && (
                      <div className="flex items-center">
                        {confirmDeleteUserId === u.id ? (
                          <div className="flex items-center gap-1.5 p-1 bg-rose-500/10 border border-rose-500 animate-in fade-in">
                            <span className="text-[10px] font-mono text-rose-500 font-bold px-1 uppercase">
                              CONFIRM WIPE?
                            </span>
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => handleConfirmDelete(u.id)}
                              className="px-2 py-0.5 bg-rose-500 text-white font-mono font-bold text-[10px] uppercase hover:bg-rose-600 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {isDeleting ? 'WIPING...' : 'YES, DELETE'}
                            </button>
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => setConfirmDeleteUserId(null)}
                              className="px-2 py-0.5 bg-card text-sub hover:text-main font-mono text-[10px] uppercase border border-subtle transition-colors cursor-pointer"
                            >
                              CANCEL
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteUserId(u.id);
                              setErrorMsg(null);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono font-bold text-sub hover:text-rose-500 border border-subtle hover:border-rose-500/60 bg-input hover:bg-rose-500/5 transition-all cursor-pointer"
                            title="Permanently delete user without needing PIN"
                          >
                            <Trash2 className="w-3 h-3 text-sub hover:text-rose-500" />
                            <span>DELETE USER</span>
                          </button>
                        )}
                      </div>
                    )}
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
