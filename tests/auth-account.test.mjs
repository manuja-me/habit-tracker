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
    let payload;
    const builder = {
      select: () => builder,
      update: (data) => { operation = 'update'; payload = data; return builder; },
      insert: (data) => { operation = 'insert'; payload = data; return builder; },
      delete: () => { operation = 'delete'; return builder; },
      upsert: (data) => { operation = 'upsert'; payload = data; return builder; },
      eq: (key, value) => { filters.push(['eq', key, value]); return builder; },
      gt: (key, value) => { filters.push(['gt', key, value]); return builder; },
      lte: (key, value) => { filters.push(['lte', key, value]); return builder; },
      is: (key, value) => { filters.push(['is', key, value]); return builder; },
      single: () => query({ table, operation, payload, filters, single: true }),
      maybeSingle: () => query({ table, operation, payload, filters, single: true }),
      then: (resolve) => resolve(query({ table, operation, payload, filters, single: false })),
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
        url: 'data:text/javascript,export const getServerSupabase = () => globalThis.authTestSupabase; export const getCleanSupabaseConfig = () => ({});',
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

const { COOKIE_NAME, OWNER_USER_ID, createSessionToken, hashPin, hashPinScrypt } = await import('../src/lib/server/auth-utils.ts');
const { changePinAction, deactivateAccountAction, getCurrentUserAction, lockSessionAction, reactivateAccountAction, validateInviteTokenAction, verifyPinAction } = await import('../src/lib/server/auth.ts');
const { recordAccountVisitAction } = await import('../src/lib/server/actions.ts');
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

test('active sessions are NOT revoked when updated_at is newer but PIN was never changed', async () => {
  const token = createSessionToken({ ...member, issuedAt: Date.now() - 10000 });
  cookieValues.set(COOKIE_NAME, token);
  query = () => ({
    data: {
      id: member.userId,
      role: 'member',
      username: 'Member',
      deactivated_at: null,
      updated_at: new Date(Date.now() - 1000).toISOString(),
      pin_changed_at: null,
    },
  });
  const user = await getCurrentUserAction();
  assert.equal(user?.userId, member.userId);
});

test('VULN-01: verifyPinAction uses verifyPinHash without pin_lookup_hash bypass and changePinAction does not store pin_lookup_hash', async () => {
  const realHash = await hashPinScrypt('482910');
  const fakeLookupHash = hashPin('999999');
  let capturedUpdatePayload = null;
  cookieValues.clear();
  query = ({ table, operation, payload, single }) => {
    if (table === 'auth_rate_limits') return { data: null };
    if (operation === 'update') {
      capturedUpdatePayload = payload;
      return { data: single ? { id: member.userId } : [{ id: member.userId }] };
    }
    const row = {
      id: member.userId,
      username: 'Member',
      role: 'member',
      pin_hash: realHash,
      pin_lookup_hash: fakeLookupHash,
      deactivated_at: null,
    };
    return { data: single ? row : [row] };
  };

  // Pin matching only pin_lookup_hash must NOT authenticate
  const spoofedRes = await verifyPinAction('999999');
  assert.equal(spoofedRes.success, false);

  // Real PIN authenticates via verifyPinHash and clears rate limits
  const validRes = await verifyPinAction('482910');
  assert.equal(validRes.success, true);

  // Changing PIN must not store pin_lookup_hash
  cookieValues.set(COOKIE_NAME, createSessionToken(member));
  const changeRes = await changePinAction('482910', '739182');
  assert.equal(changeRes.success, true);
  assert.equal('pin_lookup_hash' in capturedUpdatePayload, false);
});

test('VULN-02: getCurrentUserAction fails closed on DB error or deactivated owner session', async () => {
  const activeOwner = { userId: OWNER_USER_ID, username: 'owner', role: 'owner' };
  const deactivatedOwner = { ...activeOwner, isDeactivated: true };

  // 1. Primary query DB error must return null even for OWNER_USER_ID
  cookieValues.set(COOKIE_NAME, createSessionToken(activeOwner));
  query = () => ({ data: null, error: { message: 'connection refused' } });
  assert.equal(await getCurrentUserAction(), null);

  // 2. Legacy 42703 fallback DB error must return null even for OWNER_USER_ID
  let callCount = 0;
  query = () => {
    callCount += 1;
    if (callCount === 1) {
      return { data: null, error: { code: '42703', message: 'column deactivated_at does not exist' } };
    }
    return { data: null, error: { message: 'legacy query failed' } };
  };
  assert.equal(await getCurrentUserAction(), null);

  // 3. Deactivated owner session without DB row must fail closed
  cookieValues.set(COOKIE_NAME, createSessionToken(deactivatedOwner));
  query = () => ({ data: null, error: null });
  assert.equal(await getCurrentUserAction(), null);

  // 4. Env-only active owner without DB row and without error still succeeds
  cookieValues.set(COOKIE_NAME, createSessionToken(activeOwner));
  query = () => ({ data: null, error: null });
  assert.equal((await getCurrentUserAction())?.userId, OWNER_USER_ID);
});

test('VULN-06: auth actions hide raw DB error strings and return generic safe errors', async () => {
  const currentHash = hashPin('123456');
  cookieValues.set(COOKIE_NAME, createSessionToken(member));

  let deactivatedAt = null;
  query = ({ table, operation, single }) => {
    if (table === 'auth_rate_limits') return { data: null };
    if (operation === 'update') {
      return { data: null, error: { message: 'PG_INTERNAL_SECRET_SCHEMA_DETAIL: constraint foo_bar' } };
    }
    const row = { id: member.userId, username: 'Member', role: 'member', pin_hash: currentHash, deactivated_at: deactivatedAt };
    return { data: single ? row : [row] };
  };

  const changeRes = await changePinAction('123456', '246802');
  assert.equal(changeRes.success, false);
  assert.doesNotMatch(changeRes.error, /PG_INTERNAL_SECRET_SCHEMA_DETAIL/);

  const deactivateRes = await deactivateAccountAction('123456');
  assert.equal(deactivateRes.success, false);
  assert.doesNotMatch(deactivateRes.error, /PG_INTERNAL_SECRET_SCHEMA_DETAIL/);

  deactivatedAt = new Date().toISOString();
  cookieValues.set(COOKIE_NAME, createSessionToken({ ...member, isDeactivated: true }));
  const reactivateRes = await reactivateAccountAction();
  assert.equal(reactivateRes.success, false);
  assert.equal(reactivateRes.error, 'Failed to reactivate account.');
});

test('VULN-08: lockSessionAction revokes tokens issued at/before lock while allowing immediate re-login', async () => {
  const issuedAt = Date.now();
  const lockedToken = createSessionToken({ ...member, issuedAt });
  cookieValues.set(COOKIE_NAME, lockedToken);

  let storedPinChangedAt = null;
  query = ({ table, operation, payload, filters }) => {
    if (table === 'app_users' && operation === 'update') {
      assert.deepEqual(filters, [['eq', 'id', member.userId]]);
      storedPinChangedAt = payload.pin_changed_at;
      return { data: null, error: null };
    }
    return {
      data: {
        id: member.userId,
        role: 'member',
        username: 'Member',
        deactivated_at: null,
        pin_changed_at: storedPinChangedAt,
      },
    };
  };

  await lockSessionAction(member.userId);
  assert.equal(cookieValues.has(COOKIE_NAME), false);
  assert.ok(storedPinChangedAt, 'pin_changed_at must be updated on lock');

  // Replaying the pre-lock token (even in a copied cookie jar) must be rejected
  cookieValues.set(COOKIE_NAME, lockedToken);
  assert.equal(await getCurrentUserAction(), null);

  // A new token issued immediately after lock succeeds
  const freshToken = createSessionToken({ ...member, issuedAt: Date.now() + 5 });
  cookieValues.set(COOKIE_NAME, freshToken);
  assert.equal((await getCurrentUserAction())?.userId, member.userId);
});

test('recordAccountVisitAction updates last_login_at without touching updated_at', async () => {
  cookieValues.set(COOKIE_NAME, createSessionToken(member));
  let updatedPayload = null;
  globalThis.authTestSupabase = {
    from: () => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: () => ({
          data: {
            id: member.userId,
            username: member.username,
            role: member.role,
            deactivated_at: null,
            pin_changed_at: null,
            updated_at: new Date().toISOString(),
          },
        }),
        update: (payload) => {
          updatedPayload = payload;
          return builder;
        },
        then: (resolve) => resolve({ error: null }),
      };
      return builder;
    },
  };

  const result = await recordAccountVisitAction(member.userId);
  assert.equal(result.success, true);
  assert.ok(updatedPayload?.last_login_at);
  assert.equal(updatedPayload?.updated_at, undefined);
});
