import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

test('service worker fetches fresh pages, bypasses private requests and removes only old Zenith caches', async () => {
  const handlers = {};
  const deleted = [];
  const origin = 'https://tracker.example';
  const cache = { match: async () => 'offline shell', keys: async () => ['zenith-cache-v1', 'zenith-cache-v2', 'other-app'], delete: key => deleted.push(key) };
  let offline = false;
  runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    self: { location: { origin }, addEventListener: (type, fn) => { handlers[type] = fn; }, clients: { claim() {} } },
    URL, caches: cache, fetch: async () => {
      if (offline) throw new Error('offline');
      return 'live page';
    },
  });
  function intercept(path, mode, method = 'GET') {
    let result;
    handlers.fetch({ request: { url: origin + path, mode, method }, respondWith(value) { result = value; } });
    return result;
  }
  assert.equal(await intercept('/', 'navigate'), 'live page');
  offline = true;
  assert.equal(await intercept('/', 'navigate'), 'offline shell');
  assert.equal(intercept('/?_rsc=abcd', 'cors'), undefined);
  assert.equal(intercept('/join?token=private', 'navigate'), undefined);
  assert.equal(intercept('/', 'cors', 'POST'), undefined);
  let activation;
  handlers.activate({ waitUntil(value) { activation = value; } });
  await activation;
  assert.deepEqual(deleted, ['zenith-cache-v1']);
});
