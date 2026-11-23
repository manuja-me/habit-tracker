import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

// Resolve extensionless relative TypeScript imports and Next stubs when running directly under Node's test runner
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'next/headers') {
      return {
        url: 'data:text/javascript,export const cookies = () => ({ get: () => undefined, set: () => {}, delete: () => {} }); export const headers = () => new Map();',
        shortCircuit: true,
      };
    }
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw err;
    }
  },
});

const { getServerSupabase, getCleanSupabaseConfig } = await import('../src/lib/server/supabase.ts');
const { checkSessionUserAction, checkSessionAction } = await import('../src/lib/server/auth.ts');

test('Supabase client singleton connection caching and local CLI URL support', () => {
  // 1. Remote Supabase HTTPS URL
  process.env.SUPABASE_URL = 'https://abcdefghijklmnop.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-12345';

  const client1 = getServerSupabase();
  const client2 = getServerSupabase();

  assert.ok(client1, 'Client 1 must be created');
  assert.ok(client2, 'Client 2 must be created');
  assert.strictEqual(client1, client2, 'Consecutive calls must return the identical cached singleton instance');

  // 2. Local Supabase CLI URL (127.0.0.1 / localhost)
  process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
  const localConfig1 = getCleanSupabaseConfig();
  assert.ok(localConfig1, 'Must accept http://127.0.0.1 for local Supabase CLI');
  assert.strictEqual(localConfig1.url, 'http://127.0.0.1:54321');

  process.env.SUPABASE_URL = 'http://localhost:54321';
  const localConfig2 = getCleanSupabaseConfig();
  assert.ok(localConfig2, 'Must accept http://localhost for local Supabase CLI');
  assert.strictEqual(localConfig2.url, 'http://localhost:54321');

  // 3. Insecure external HTTP URL must still be rejected
  process.env.SUPABASE_URL = 'http://insecure-external-domain.com';
  const insecureConfig = getCleanSupabaseConfig();
  assert.strictEqual(insecureConfig, null, 'Must reject insecure non-localhost HTTP URL');
  process.env.SUPABASE_URL = 'http://localhost.example.test:54321';
  assert.strictEqual(getCleanSupabaseConfig(), null, 'Must match the complete loopback hostname');
  process.env.SUPABASE_URL = 'https://user:password@database.example.test';
  assert.strictEqual(getCleanSupabaseConfig(), null, 'Must reject credentials in the URL');
});

test('checkSessionUserAction returns false and null user when unauthenticated', async () => {
  const result = await checkSessionUserAction();
  assert.deepStrictEqual(result, { authenticated: false, user: null });

  const isAuth = await checkSessionAction();
  assert.strictEqual(isAuth, false);
});

test('Database waterfall elimination & parallel query dispatch in actions.ts', () => {
  const actionsCode = readFileSync(new URL('../src/lib/server/actions.ts', import.meta.url), 'utf-8');

  // Verify non-blocking purgeExpiredDayNotes decoupled from read path
  assert.match(actionsCode, /void purgeExpiredDayNotes\(supabase, now\)\.catch/);

  // Verify habits, habit_logs, day_notes, app_users queried concurrently in 1 Promise.all round-trip
  assert.match(actionsCode, /const \[habitsRes, logsRes, notesRes, userRes\] = await Promise\.all\(\[/);
  assert.match(actionsCode, /validHabitIdSet\.has\(l\.habit_id\)/);
});

test('Auth rate limit query elimination and concurrent post-auth tasks in auth.ts', () => {
  const authCode = readFileSync(new URL('../src/lib/server/auth.ts', import.meta.url), 'utf-8');

  // Verify clearRateLimits only executes DB query when count > 0
  assert.match(authCode, /clearRateLimits\(rateLimitKey, cookieStore, rateCheck\.currentCount > 0\)/);
  assert.match(authCode, /if \(shouldClearDb\) \{/);

  // Verify last_login_at and clearRateLimits are dispatched concurrently via Promise.allSettled
  assert.match(authCode, /await Promise\.allSettled\(postAuthTasks\)/);

  // Verify checkSessionUserAction export
  assert.match(authCode, /export async function checkSessionUserAction\(\)/);
});

test('Optimistic local-first unlock and session check guard in PinLockScreen, LoadingScreen, and page.tsx', () => {
  const pinLockCode = readFileSync(new URL('../src/components/PinLockScreen.tsx', import.meta.url), 'utf-8');
  const loadingScreenCode = readFileSync(new URL('../src/components/LoadingScreen.tsx', import.meta.url), 'utf-8');
  const pageCode = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf-8');

  // PinLockScreen propagates SessionUser to onUnlock callback across standard, upgrade, and reactivation flows
  assert.match(pinLockCode, /onUnlock\(result\.user\)/);
  assert.match(pinLockCode, /onUnlock\(authenticatedUserRef\.current\)/);
  assert.match(pinLockCode, /onUnlock\(res\.user \|\| authenticatedUserRef\.current\)/);

  // LoadingScreen triggers onComplete immediately when isReady is true without 40ms interval loop
  assert.match(loadingScreenCode, /if \(isReady\) \{\s*onCompleteRef\.current\?\.\(\);\s*\}/);
  assert.match(loadingScreenCode, /\}, \[targetProgress, isReady\]\);/);

  // page.tsx verifies sessions only while restoring an unlocked tab.
  assert.match(pageCode, /if \(isUnlocked !== null\) return;/);

  // page.tsx consumes checkSessionUserAction on mount
  assert.match(pageCode, /const \{ authenticated, user: sessionUser \} = await checkSessionUserAction\(\)/);

  // page.tsx unlocks immediately (setIsVaultReady(true)) if local cached habits exist
  assert.match(pageCode, /const hasCachedHabits = localData\.habits\.length > 0;\s*setIsVaultReady\(hasCachedHabits\);/);
});

test('Composite database performance indexes in schema.sql', () => {
  const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf-8');

  // Verify composite indexes for concurrent queries on habit_logs and habits
  assert.match(schema, /CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date ON public\.habit_logs\(user_id, date DESC\);/);
  assert.match(schema, /CREATE INDEX IF NOT EXISTS idx_habits_user_archived ON public\.habits\(user_id, archived, sort_order\);/);
});
