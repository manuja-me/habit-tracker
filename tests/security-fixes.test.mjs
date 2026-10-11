import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import {
  createSessionToken,
  getSessionUserFromToken,
  getClientIp,
  checkRateLimit,
  recordFailedAttempt,
  resetFailedAttempts,
  hashPin,
  hashPinScrypt,
  verifyPinHash,
  isScryptHash,
  isValidPinFormat,
  SESSION_MAX_AGE_MS,
  SECRET_HMAC_KEY,
} from '../src/lib/server/auth-utils.ts';

test('Finding 1: RLS policies in schema.sql restrict habits, habit_logs, and day_notes to service_role', () => {
  const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf-8');

  // Verify permissive policies granting public or anon access are absent
  assert.doesNotMatch(schema, /CREATE POLICY "Allow access habits" ON public\.habits FOR ALL TO public/);
  assert.doesNotMatch(schema, /CREATE POLICY "Allow access habit_logs" ON public\.habit_logs FOR ALL TO public/);
  assert.doesNotMatch(schema, /CREATE POLICY "Allow access day_notes" ON public\.day_notes FOR ALL TO public/);

  // Verify service_role only policies are present
  assert.match(
    schema,
    /CREATE POLICY "Allow service role only habits" ON public\.habits FOR ALL TO service_role USING \(true\) WITH CHECK \(true\);/
  );
  assert.match(
    schema,
    /CREATE POLICY "Allow service role only habit_logs" ON public\.habit_logs FOR ALL TO service_role USING \(true\) WITH CHECK \(true\);/
  );
  assert.match(
    schema,
    /CREATE POLICY "Allow service role only day_notes" ON public\.day_notes FOR ALL TO service_role USING \(true\) WITH CHECK \(true\);/
  );
  assert.match(
    schema,
    /CREATE POLICY "Allow service role only auth_rate_limits" ON public\.auth_rate_limits FOR ALL TO service_role USING \(true\) WITH CHECK \(true\);/
  );
});

test('Finding 2: Insecure default secrets throw fatal error on startup in production', () => {
  // 1. Should throw in production when secrets are unset/default
  assert.throws(
    () => {
      execSync('node --experimental-strip-types -e "import(\'./src/lib/server/auth-utils.ts\')"', {
        env: { ...process.env, NODE_ENV: 'production' },
        stdio: 'pipe',
      });
    },
    (err) => {
      const output = err.stderr ? err.stderr.toString() : '';
      return output.includes('FATAL SECURITY ERROR');
    },
    'Expected fatal startup error when default secrets are used in production'
  );

  // 2. Should throw in production when secrets are whitespace
  assert.throws(
    () => {
      execSync('node --experimental-strip-types -e "import(\'./src/lib/server/auth-utils.ts\')"', {
        env: {
          ...process.env,
          NODE_ENV: 'production',
          SESSION_SECRET: '   ',
          PIN_SALT: '   ',
        },
        stdio: 'pipe',
      });
    },
    (err) => {
      const output = err.stderr ? err.stderr.toString() : '';
      return output.includes('FATAL SECURITY ERROR');
    },
    'Expected fatal startup error when whitespace secrets are provided in production'
  );

  // 3. Should succeed in production when secure secrets are provided
  const successOutput = execSync(
    'node --experimental-strip-types -e "import(\'./src/lib/server/auth-utils.ts\').then(() => console.log(\'OK\'))"',
    {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        SESSION_SECRET: 'my_production_super_secret_session_key_32bytes_long',
        PIN_SALT: 'my_production_super_secret_salt_32bytes_long',
      },
      stdio: 'pipe',
    }
  ).toString();
  assert.ok(successOutput.includes('OK'), 'Should start up cleanly when custom secrets are provided');
});

test('Finding 3: Session token expiration enforcement and structural validation', () => {
  const user = {
    userId: '11111111-1111-1111-1111-111111111111',
    username: 'testuser',
    role: 'member',
  };

  assert.equal(SESSION_MAX_AGE_MS, 7 * 24 * 60 * 60 * 1000);

  // 1. Freshly created token is valid
  const validToken = createSessionToken(user);
  const parsedUser = getSessionUserFromToken(validToken);
  assert.ok(parsedUser);
  assert.equal(parsedUser.userId, user.userId);
  assert.equal(parsedUser.username, user.username);
  assert.equal(parsedUser.role, user.role);

  // Helper to construct a token with arbitrary payload
  function makeTokenWithPayload(payloadObj) {
    const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
    const sig = crypto.createHmac('sha256', SECRET_HMAC_KEY).update(payload).digest('hex');
    return `${payload}.${sig}`;
  }

  // 2. Expired token (older than 7 days) is rejected
  const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
  const expiredToken = makeTokenWithPayload({
    userId: user.userId,
    username: user.username,
    role: user.role,
    ts: eightDaysAgo,
  });
  assert.equal(getSessionUserFromToken(expiredToken), null, 'Expired token must return null');

  // 3. Token within 7 days is accepted
  const sixDaysAgo = Date.now() - 6 * 24 * 60 * 60 * 1000;
  const activeToken = makeTokenWithPayload({
    userId: user.userId,
    username: user.username,
    role: user.role,
    ts: sixDaysAgo,
  });
  assert.ok(getSessionUserFromToken(activeToken), 'Token within 7 days should be accepted');

  // 4. Token without ts is rejected
  const missingTsToken = makeTokenWithPayload({
    userId: user.userId,
    username: user.username,
    role: user.role,
  });
  assert.equal(getSessionUserFromToken(missingTsToken), null, 'Token missing ts must return null');

  // 5. Token with non-number ts is rejected
  const invalidTsToken = makeTokenWithPayload({
    userId: user.userId,
    username: user.username,
    role: user.role,
    ts: 'invalid-date',
  });
  assert.equal(getSessionUserFromToken(invalidTsToken), null, 'Token with string ts must return null');

  // 6. Token with infinite ts is rejected
  const infTsToken = makeTokenWithPayload({
    userId: user.userId,
    username: user.username,
    role: user.role,
    ts: Infinity,
  });
  assert.equal(getSessionUserFromToken(infTsToken), null, 'Token with Infinity ts must return null');

  // 7. Token with future timestamp (>60s clock skew) is rejected
  const futureToken = makeTokenWithPayload({
    userId: user.userId,
    username: user.username,
    role: user.role,
    ts: Date.now() + 10 * 60 * 1000,
  });
  assert.equal(getSessionUserFromToken(futureToken), null, 'Token with future ts must return null');

  // 8. Token with tampered signature is rejected
  const [p, s] = validToken.split('.');
  const tamperedToken = `${p}.${s.slice(0, -2)}aa`;
  assert.equal(getSessionUserFromToken(tamperedToken), null, 'Tampered token signature must return null');

  // 9. Malformed token structure (3 segments) is rejected
  assert.equal(getSessionUserFromToken(`${validToken}.extra`), null, 'Token with extra parts must return null');
});

test('Finding 4: Client IP extraction prevents X-Forwarded-For spoofing and enforces progressive lockout without cookies', () => {
  const makeHeaders = (map) => ({
    get: (key) => map[key.toLowerCase()] || null,
  });

  // 1. Spoofed leftmost X-Forwarded-For is ignored; rightmost IP appended by proxy is selected
  const spoofedHeaders = makeHeaders({
    'x-forwarded-for': '10.0.0.1, 10.0.0.2, 203.0.113.195',
  });
  assert.equal(getClientIp(spoofedHeaders), '203.0.113.195', 'Must pick right-most IP from X-Forwarded-For');

  // 2. Client-provided CF-Connecting-IP and X-Real-IP CANNOT override right-most X-Forwarded-For
  const forgedHeaders = makeHeaders({
    'x-forwarded-for': '1.1.1.1, 203.0.113.195',
    'cf-connecting-ip': '198.51.100.42',
    'x-real-ip': '198.51.100.99',
  });
  assert.equal(
    getClientIp(forgedHeaders),
    '203.0.113.195',
    'X-Forwarded-For rightmost hop must take precedence over client-forged headers'
  );

  // 3. Port stripping on IPv4 addresses
  const portHeaders = makeHeaders({
    'x-forwarded-for': '203.0.113.195:45678',
  });
  assert.equal(getClientIp(portHeaders), '203.0.113.195', 'Must strip port from IPv4 address');

  // 4. X-Real-IP is used as fallback ONLY when X-Forwarded-For is not present
  const realIpHeaders = makeHeaders({
    'x-real-ip': '198.51.100.99',
  });
  assert.equal(getClientIp(realIpHeaders), '198.51.100.99', 'Must use x-real-ip as fallback');

  // 5. Missing headers fall back to 127.0.0.1
  assert.equal(getClientIp(makeHeaders({})), '127.0.0.1');

  // 6. Progressive rate-limiting ladder WITHOUT cookies (cannot be bypassed by dropping cookies)
  const testKey = 'test_cookie_bypass_suite_' + Date.now();
  resetFailedAttempts(testKey);

  // Attempt 1 without cookie
  const fail1 = recordFailedAttempt(testKey, undefined);
  assert.equal(fail1.count, 1);
  assert.equal(fail1.waitSeconds, 0);

  // Attempt 2 without cookie
  const fail2 = recordFailedAttempt(testKey, undefined);
  assert.equal(fail2.count, 2);
  assert.equal(fail2.waitSeconds, 0);

  // Attempt 3 without cookie (triggers 60s lockout)
  const fail3 = recordFailedAttempt(testKey, undefined);
  assert.equal(fail3.count, 3);
  assert.equal(fail3.waitSeconds, 60);

  // Check DURING lockout WITHOUT cookie: must be blocked
  const checkDuringLockout = checkRateLimit(testKey, undefined);
  assert.equal(checkDuringLockout.allowed, false, 'Check during lockout must be blocked');
  assert.ok(checkDuringLockout.waitSeconds > 0);

  // Simulate time advancing 65 seconds (past the 60s lockout)
  const originalDateNow = Date.now;
  const timeAfterLockout1 = fail3.lockedUntil + 5000;
  Date.now = () => timeAfterLockout1;

  try {
    // Check AFTER 60s lockout: allowed to attempt
    const checkAfterLockout1 = checkRateLimit(testKey, undefined);
    assert.equal(checkAfterLockout1.allowed, true, 'Check after lockout should allow next attempt');

    // Attempt 4 WITHOUT cookie: MUST escalate to count 4 and 300s (5 min) lockout!
    const fail4 = recordFailedAttempt(testKey, undefined);
    assert.equal(fail4.count, 4, 'Attempt 4 without cookie must escalate count to 4');
    assert.equal(fail4.waitSeconds, 300, 'Attempt 4 without cookie must enforce 300s lockout');

    // Simulate time advancing 305 seconds (past the 300s lockout)
    const timeAfterLockout2 = fail4.lockedUntil + 5000;
    Date.now = () => timeAfterLockout2;

    // Attempt 5 WITHOUT cookie: MUST escalate to count 5 and 900s (15 min) lockout!
    const fail5 = recordFailedAttempt(testKey, undefined);
    assert.equal(fail5.count, 5, 'Attempt 5 without cookie must escalate count to 5');
    assert.equal(fail5.waitSeconds, 900, 'Attempt 5 without cookie must enforce 900s lockout');
  } finally {
    Date.now = originalDateNow;
    resetFailedAttempts(testKey);
  }
});

test('Finding 5: PIN and username collision error messages are generic to prevent enumeration oracle', () => {
  const authCode = readFileSync(new URL('../src/lib/server/auth.ts', import.meta.url), 'utf-8');

  // Specific oracle leak messages must NOT exist
  assert.doesNotMatch(authCode, /This PIN is already taken/);
  assert.doesNotMatch(authCode, /This PIN is already reserved/);
  assert.doesNotMatch(authCode, /This username is already taken/);

  // Generic normalized error message must be present
  assert.match(
    authCode,
    /Unable to complete registration with the provided details\. Please choose a different PIN or display name\./
  );
});

test('Finding 6: 6-digit Scrypt per-user salted PIN hashing and zero-data-loss legacy SHA-256 compatibility', () => {
  // 1. 6-digit format required for new PINs; 4-digit allowed only when allowLegacy4Digit=true
  assert.equal(isValidPinFormat('482910', false), true);
  assert.equal(isValidPinFormat('1001', false), false);
  assert.equal(isValidPinFormat('1001', true), true);
  assert.equal(isValidPinFormat('12345', true), false);

  // 2. Scrypt hashes use unique per-user salts even for identical PINs
  const h1 = hashPinScrypt('482910');
  const h2 = hashPinScrypt('482910');
  assert.ok(isScryptHash(h1));
  assert.notEqual(h1, h2, 'Each Scrypt hash must have a unique random salt');
  assert.equal(verifyPinHash('482910', h1), true);
  assert.equal(verifyPinHash('482910', h2), true);
  assert.equal(verifyPinHash('000000', h1), false);

  // 3. Existing legacy SHA-256 hashes still verify (zero data loss for existing DB accounts)
  const legacyHash = hashPin('1001');
  assert.equal(isScryptHash(legacyHash), false);
  assert.equal(verifyPinHash('1001', legacyHash), true);
  assert.equal(verifyPinHash('9999', legacyHash), false);
});
