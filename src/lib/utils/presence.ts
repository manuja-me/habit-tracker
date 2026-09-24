import { differenceInHours, differenceInCalendarDays, format, parseISO, subDays } from 'date-fns';
import { getTodayDateString } from './date';

export const LAST_VISIT_STORAGE_KEY = 'zenith_last_visit_at';
export const LAST_ACKNOWLEDGED_ABSENCE_KEY = 'zenith_last_ack_absence_at';

export interface AbsenceDetectionResult {
  wasAway: boolean;
  hoursAway: number;
  daysAway: number;
  previousVisitIso: string | null;
  missedDates: string[]; // YYYY-MM-DD list of calendar days missed between last visit date and today
}

/**
 * Checks if the user was inactive for 24+ hours or crossed calendar days without visiting.
 */
export function checkInactivity(thresholdHours = 24): AbsenceDetectionResult {
  if (typeof window === 'undefined') {
    return {
      wasAway: false,
      hoursAway: 0,
      daysAway: 0,
      previousVisitIso: null,
      missedDates: [],
    };
  }

  const storedVisit = localStorage.getItem(LAST_VISIT_STORAGE_KEY);
  if (!storedVisit) {
    // First time visit or storage cleared: record current visit immediately
    recordCurrentVisit();
    return {
      wasAway: false,
      hoursAway: 0,
      daysAway: 0,
      previousVisitIso: null,
      missedDates: [],
    };
  }

  try {
    const lastVisitDate = parseISO(storedVisit);
    const now = new Date();
    const hoursAway = differenceInHours(now, lastVisitDate);
    const daysAway = differenceInCalendarDays(now, lastVisitDate);

    // If an absence was already acknowledged recently for this gap, don't re-trigger
    const lastAck = localStorage.getItem(LAST_ACKNOWLEDGED_ABSENCE_KEY);
    if (lastAck && parseISO(lastAck) >= lastVisitDate) {
      return {
        wasAway: false,
        hoursAway,
        daysAway,
        previousVisitIso: storedVisit,
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
      previousVisitIso: storedVisit,
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
 * Persists the current timestamp as the latest active visit.
 */
export function recordCurrentVisit(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LAST_VISIT_STORAGE_KEY, new Date().toISOString());
  } catch (e) {
    console.error('Failed to record visit timestamp', e);
  }
}

/**
 * Acknowledges that the user has seen or reviewed the absence catch-up screen.
 */
export function acknowledgeAbsence(): void {
  if (typeof window === 'undefined') return;
  try {
    const nowIso = new Date().toISOString();
    localStorage.setItem(LAST_ACKNOWLEDGED_ABSENCE_KEY, nowIso);
    localStorage.setItem(LAST_VISIT_STORAGE_KEY, nowIso);
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
