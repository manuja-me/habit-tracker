import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

const cookieValues = new Map();
let query;
globalThis.authTestCookies = {
  get: (key) => cookieValues.has(key) ? { value: cookieValues.get(key) } : undefined,
  set: (key, value) => cookieValues.set(key, value),
  delete: (key) => cookieValues.delete(key),
};
globalThis.authTestSupabase = {
  from: (table) => {
    const filters = [];
    let operation = 'select';
    const builder = {
      select: () => builder,
      update: () => { operation = 'update'; return builder; },
      delete: () => { operation = 'delete'; return builder; },
      upsert: () => { operation = 'upsert'; return builder; },
      eq: (key, value) => { filters.push(['eq', key, value]); return builder; },
      lte: (key, value) => { filters.push(['lte', key, value]); return builder; },
      is: (key, value) => { filters.push(['is', key, value]); return builder; },
      maybeSingle: () => query({ table, operation, filters, single: true }),
      then: (resolve) => resolve(query({ table, operation, filters, single: false })),
    };
    return builder;
  },
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'next/headers') {
      return {
        url: 'data:text/javascript,export const cookies = () => globalThis.authTestCookies; export const headers = () => new Map();',
        shortCircuit: true,
      };
    }
    if (specifier === './supabase') {
      return {
        url: 'data:text/javascript,export const getServerSupabase = () => globalThis.authTestSupabase;',
        shortCircuit: true,
      };
    }
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (!specifier.startsWith('.') || specifier.endsWith('.ts')) throw error;
      return nextResolve(`${specifier}.ts`, context);
    }
  },
});

const { COOKIE_NAME, createSessionToken, hashPin } = await import('../src/lib/server/auth-utils.ts');
const { changePinAction, getCurrentUserAction, lockSessionAction, validateInviteTokenAction } = await import('../src/lib/server/auth.ts');
const { purgeUserData } = await import('../src/lib/server/user-management.ts');
const member = { userId: '11111111-1111-1111-1111-111111111111', username: 'Member', role: 'member' };

test('invalid invitations are rejected before a database lookup', async () => {
  query = () => assert.fail('Malformed input reached the database');
  assert.equal((await validateInviteTokenAction({})).valid, false);
  assert.equal((await validateInviteTokenAction('malformed.token.extra')).valid, false);
});

test('member permissions reflect the current account role', async () => {
  cookieValues.set(COOKIE_NAME, createSessionToken({ ...member, role: 'owner' }));
  query = () => ({ data: { id: member.userId, role: 'member', username: 'Current Name', deactivated_at: null } });
  const user = await getCurrentUserAction();
  assert.equal(user.role, 'member');
  assert.equal(user.username, 'Current Name');
});

test('locking an older tab preserves the cookie for the newer account', async () => {
  const currentSession = createSessionToken(member);
  cookieValues.set(COOKIE_NAME, currentSession);
  await lockSessionAction('22222222-2222-2222-2222-222222222222');
  assert.equal(cookieValues.get(COOKIE_NAME), currentSession);
  await lockSessionAction(member.userId);
  assert.equal(cookieValues.has(COOKIE_NAME), false);
});

test('a PIN change requires the verified credential to still be current', async () => {
  const currentHash = hashPin('123456');
  cookieValues.set(COOKIE_NAME, createSessionToken(member));
  query = ({ table, operation, filters, single }) => {
    if (table === 'auth_rate_limits') return { data: null };
    if (operation === 'update') {
      assert.deepEqual(filters, [['eq', 'id', member.userId], ['eq', 'pin_hash', currentHash]]);
      return { data: null };
    }
    const row = { id: member.userId, username: 'Member', role: 'member', pin_hash: currentHash, deactivated_at: null };
    return { data: single ? row : [row] };
  };
  assert.deepEqual(await changePinAction('123456', '246802'), {
    success: false,
    error: 'Account credentials changed. Please try again.',
  });
});

test('auto-purge only cascades when a member still meets the expiry cutoff', async () => {
  const cutoff = '2026-11-16T00:00:00.000Z';
  query = ({ table, operation, filters }) => {
    assert.equal(table, 'app_users');
    assert.equal(operation, 'delete');
    assert.deepEqual(filters, [['eq', 'id', member.userId], ['eq', 'role', 'member'], ['lte', 'deactivated_at', cutoff]]);
    return { data: null };
  };
  assert.equal(await purgeUserData(globalThis.authTestSupabase, member.userId, cutoff), false);
});

test('sessions issued before credential update are revoked', async () => {
  const oldToken = createSessionToken({ ...member, issuedAt: Date.now() - 10000 });
  cookieValues.set(COOKIE_NAME, oldToken);
  query = () => ({
    data: {
      id: member.userId,
      role: 'member',
      username: 'Member',
      deactivated_at: null,
      updated_at: new Date(Date.now() - 1000).toISOString(),
    },
  });
  const user = await getCurrentUserAction();
  assert.equal(user, null);
});
