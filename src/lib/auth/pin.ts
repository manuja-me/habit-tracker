// Salted PIN Verification Engine
const PIN_SALT = 'zenith_v1_secure_salt_77a9';
const SALTED_PIN_HASH = '4d47425a43a76ef9ea6f80610c081361697ecb70cae1937026aff7cf3b71d1bb';
const PIN_STORAGE_KEY = 'zenith_auth_token_v1';

export async function hashPinWithSalt(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin.trim() + PIN_SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPin(pin: string): Promise<boolean> {
  if (!pin || pin.length < 4) return false;
  try {
    const computedHash = await hashPinWithSalt(pin);
    return computedHash === SALTED_PIN_HASH;
  } catch (err) {
    console.error('PIN verification error:', err);
    return false;
  }
}

export function isDeviceUnlocked(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const storedToken = localStorage.getItem(PIN_STORAGE_KEY);
    return storedToken === SALTED_PIN_HASH;
  } catch {
    return false;
  }
}

export function setDeviceUnlocked(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PIN_STORAGE_KEY, SALTED_PIN_HASH);
  } catch (err) {
    console.error('Failed to save auth token:', err);
  }
}

export function lockDevice(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PIN_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to remove auth token:', err);
  }
}
