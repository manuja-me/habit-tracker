import { differenceInHours, differenceInCalendarDays, format, parseISO, subDays } from 'date-fns';
import { getTodayDateString } from './date';
import { LAST_USER_KEY } from './storage';
import { recordAccountVisitAction } from '../server/actions';

export const LAST_VISIT_STORAGE_KEY = 'zenith_last_visit_at';
export const LAST_ACKNOWLEDGED_ABSENCE_KEY = 'zenith_last_ack_absence_at';

let lastServerVisitPingMs = 0;

function resolveUid(userId?: string): string | undefined {
  if (typeof window === 'undefined') return userId;
  return userId || localStorage.getItem(LAST_USER_KEY) || undefined;
}

function getLastVisitKey(userId?: string): string {
  const uid = resolveUid(userId);
  return uid ? `${LAST_VISIT_STORAGE_KEY}_${uid}` : LAST_VISIT_STORAGE_KEY;
}

function getLastAckKey(userId?: string): string {
  const uid = resolveUid(userId);
  return uid ? `${LAST_ACKNOWLEDGED_ABSENCE_KEY}_${uid}` : LAST_ACKNOWLEDGED_ABSENCE_KEY;
}

export interface AbsenceDetectionResult {
  wasAway: boolean;
  hoursAway: number;
  daysAway: number;
  previousVisitIso: string | null;
  missedDates: string[]; // YYYY-MM-DD list of calendar days missed between last visit date and today
}

/**
 * Checks if the user's account was inactive for 24+ hours across all devices.
 * Uses the more recent timestamp between local storage and cloud account activity.
 */
export function checkInactivity(
  thresholdHours = 24,
  cloudLastActiveIso?: string | null,
  userId?: string
): AbsenceDetectionResult {
  if (typeof window === 'undefined') {
    return {
      wasAway: false,
      hoursAway: 0,
      daysAway: 0,
      previousVisitIso: null,
      missedDates: [],
    };
  }

  const uid = resolveUid(userId);
  const allowLegacyFallback = !uid || uid === 'owner';
  const localVisit =
    localStorage.getItem(getLastVisitKey(uid)) ??
    (allowLegacyFallback ? localStorage.getItem(LAST_VISIT_STORAGE_KEY) : null);

  const localMs = localVisit ? Date.parse(localVisit) : 0;
  const cloudMs = cloudLastActiveIso ? Date.parse(cloudLastActiveIso) : 0;

  // Use whichever activity timestamp is more recent across this device and the cloud account
  const effectiveVisit =
    cloudMs > (Number.isFinite(localMs) ? localMs : 0)
      ? cloudLastActiveIso!
      : localVisit;

  if (cloudMs > (Number.isFinite(localMs) ? localMs : 0) && cloudLastActiveIso) {
    try {
      localStorage.setItem(getLastVisitKey(uid), cloudLastActiveIso);
    } catch {}
  }

  if (!effectiveVisit) {
    // First time visit on this account: record current visit immediately
    recordCurrentVisit(uid, true);
    return {
      wasAway: false,
      hoursAway: 0,
      daysAway: 0,
      previousVisitIso: null,
      missedDates: [],
    };
  }

  try {
    const lastVisitDate = parseISO(effectiveVisit);
    const now = new Date();
    const hoursAway = differenceInHours(now, lastVisitDate);
    const daysAway = differenceInCalendarDays(now, lastVisitDate);

    // If an absence was already acknowledged recently for this gap, don't re-trigger
    const lastAck =
      localStorage.getItem(getLastAckKey(uid)) ??
      (allowLegacyFallback ? localStorage.getItem(LAST_ACKNOWLEDGED_ABSENCE_KEY) : null);
    if (lastAck && parseISO(lastAck) >= lastVisitDate) {
      return {
        wasAway: false,
        hoursAway,
        daysAway,
        previousVisitIso: effectiveVisit,
        missedDates: [],
      };
    }

    const wasAway = hoursAway >= thresholdHours || daysAway >= 1;

    // Calculate missed calendar dates (excluding today, only prior complete or partial missed days)
    const missedDates: string[] = [];
    if (wasAway && daysAway >= 1) {
      const todayStr = getTodayDateString();
      for (let i = daysAway; i >= 1; i--) {
        const dStr = format(subDays(now, i), 'yyyy-MM-dd');
        if (dStr !== todayStr) {
          missedDates.push(dStr);
        }
      }
    }

    return {
      wasAway,
      hoursAway,
      daysAway,
      previousVisitIso: effectiveVisit,
      missedDates,
    };
  } catch (e) {
    console.error('Error calculating visit inactivity', e);
    return {
      wasAway: false,
      hoursAway: 0,
      daysAway: 0,
      previousVisitIso: null,
      missedDates: [],
    };
  }
}

/**
 * Persists the current timestamp as the latest active visit locally and in Supabase.
 */
export function recordCurrentVisit(userId?: string, forceServer = false): void {
  if (typeof window === 'undefined') return;
  try {
    const nowIso = new Date().toISOString();
    const uid = resolveUid(userId);
    localStorage.setItem(getLastVisitKey(uid), nowIso);
    if (!uid || uid === 'owner') {
      localStorage.setItem(LAST_VISIT_STORAGE_KEY, nowIso);
    }
    const nowMs = Date.now();
    if (forceServer || nowMs - lastServerVisitPingMs > 5 * 60 * 1000) {
      lastServerVisitPingMs = nowMs;
      recordAccountVisitAction().catch(() => {});
    }
  } catch (e) {
    console.error('Failed to record visit timestamp', e);
  }
}

/**
 * Acknowledges that the user has seen or reviewed the absence catch-up screen.
 */
export function acknowledgeAbsence(userId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const nowIso = new Date().toISOString();
    const uid = resolveUid(userId);
    localStorage.setItem(getLastAckKey(uid), nowIso);
    if (!uid || uid === 'owner') {
      localStorage.setItem(LAST_ACKNOWLEDGED_ABSENCE_KEY, nowIso);
    }
    recordCurrentVisit(uid, true);
  } catch (e) {
    console.error('Failed to acknowledge absence', e);
  }
}

/**
 * Formats a readable summary of the last visit timestamp.
 */
export function formatLastVisitReadable(isoString: string | null): string {
  if (!isoString) return 'First recorded session';
  try {
    const date = parseISO(isoString);
    return format(date, 'MMM d, yyyy · h:mm a');
  } catch {
    return 'Unknown';
  }
}

