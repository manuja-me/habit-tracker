const UNLOCKED_KEY = 'zenith_session_unlocked';
const USER_ID_KEY = 'zenith_session_user_id';

export function getUnlockedTabUserId(): string | null {
  try {
    return sessionStorage.getItem(UNLOCKED_KEY) === 'true'
      ? sessionStorage.getItem(USER_ID_KEY)
      : null;
  } catch {
    return null;
  }
}

export function unlockTab(userId: string): void {
  try {
    sessionStorage.setItem(USER_ID_KEY, userId);
    sessionStorage.setItem(UNLOCKED_KEY, 'true');
  } catch {}
}

export function lockTab(): void {
  try {
    sessionStorage.removeItem(UNLOCKED_KEY);
    sessionStorage.removeItem(USER_ID_KEY);
  } catch {}
}
