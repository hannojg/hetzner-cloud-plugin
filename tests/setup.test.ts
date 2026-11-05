import assert from 'node:assert/strict';
import { request } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { startSetup } from '../src/setup-server.js';
import { MemoryStore } from './helpers.js';

type SetupSession = Awaited<ReturnType<typeof startSetup>>;

async function post(setup: SetupSession, route: string, value: unknown, origin?: string) {
  const body = JSON.stringify(value);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (origin) {
    headers.Origin = origin;
  }
  return globalThis.fetch(`${setup.url}/${route}`, { method: 'POST', headers, body });
}

function origin(setup: SetupSession) {
  const parsed = new URL(setup.url);
  return parsed.origin;
}

async function validUpstream(): Promise<Response> {
  return new Response('{"servers":[],"meta":{"pagination":{"next_page":null}}}');
}

test('local setup serves a masked credential field with CSP and never includes the saved token', async () => {
  const token = 'saved-secret-must-not-reach-page';
  const store = new MemoryStore(token);
  const setup = await startSetup({ store, fetch: validUpstream });
  try {
    const parsed = new URL(setup.url);
    assert.equal(parsed.hostname, '127.0.0.1');
    assert.equal(parsed.protocol, 'http:');
    assert.ok(parsed.port);
    assert.ok(parsed.pathname.length >= 25);
    const response = await globalThis.fetch(setup.url);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /type=["']password["']/);
    const exposesToken = html.includes(token);
    assert.equal(exposesToken, false);
    const policy = response.headers.get('content-security-policy');
    assert.ok(policy);
    assert.match(policy, /default-src 'none'/);
    assert.match(policy, /script-src 'nonce-/);
    const cors = response.headers.get('access-control-allow-origin');
    assert.equal(cors, null);
    const cache = response.headers.get('cache-control');
    assert.match(cache ?? '', /no-store/);
    const status = await globalThis.fetch(`${setup.url}/status`);
    const payload = await status.json();
    assert.deepEqual(payload, { connected: true });
    const missingNonce = await globalThis.fetch(parsed.origin);
    assert.equal(missingNonce.status, 404);
  } finally {
    await setup.close();
  }
});

test('same-origin submission validates read-only against Hetzner and writes only the validated token', async () => {
  const token = 'new-validated-project-token';
  const store = new MemoryStore();
  let calls = 0;
  const fetchMock: typeof globalThis.fetch = async (input, init) => {
    calls += 1;
    const url = String(input);
    assert.equal(url, 'https://api.hetzner.cloud/v1/servers?per_page=1');
    assert.equal(init?.method, 'GET');
    assert.equal(init?.redirect, 'error');
    const headers = new Headers(init?.headers);
    const authorization = headers.get('authorization');
    assert.equal(authorization, `Bearer ${token}`);
    return validUpstream();
  };
  const setup = await startSetup({ store, fetch: fetchMock });
  try {
    const localOrigin = origin(setup);
    const response = await post(setup, 'connect', { token }, localOrigin);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.deepEqual(payload, { connected: true });
    assert.equal(store.value, token);
    assert.deepEqual(store.writes, [token]);
    assert.equal(calls, 1);
    const status = await globalThis.fetch(`${setup.url}/status`);
    const body = await status.text();
    const exposesToken = body.includes(token);
    assert.equal(exposesToken, false);
  } finally {
    await setup.close();
  }
});

test('missing and foreign origins cannot connect or disconnect credentials', async () => {
  const store = new MemoryStore('existing-secret');
  const setup = await startSetup({ store, fetch: validUpstream });
  try {
    for (const route of ['connect', 'disconnect']) {
      for (const suppliedOrigin of [undefined, 'https://malicious.example', 'null']) {
        const response = await post(setup, route, { token: 'attacker-token' }, suppliedOrigin);
        assert.equal(response.status, 403);
        const cors = response.headers.get('access-control-allow-origin');
        assert.equal(cors, null);
      }
    }
    assert.equal(store.value, 'existing-secret');
    assert.deepEqual(store.writes, []);
    assert.equal(store.removals, 0);
  } finally {
    await setup.close();
  }
});

test('a rebinding Host header is denied before serving the credential page', async () => {
  const store = new MemoryStore();
  const setup = await startSetup({ store, fetch: validUpstream });
  try {
    const parsed = new URL(setup.url);
    const options = { hostname: '127.0.0.1', port: parsed.port, path: parsed.pathname, headers: { Host: 'malicious.example' } };
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const outgoing = request(options, (response) => {
        response.resume();
        resolve(response.statusCode);
      });
      outgoing.on('error', reject);
      outgoing.end();
    });
    assert.equal(status, 403);
  } finally {
    await setup.close();
  }
});

test('invalid replacement tokens leave the saved credential intact and do not echo upstream secrets', async () => {
  const token = 'invalid-replacement-secret';
  const store = new MemoryStore('previous-working-token');
  const upstreamBody = JSON.stringify({ error: { code: 'unauthorized', message: `Never expose ${token}` } });
  const fetchMock: typeof globalThis.fetch = async () => {
    return new Response(upstreamBody, { status: 401 });
  };
  const setup = await startSetup({ store, fetch: fetchMock });
  try {
    const localOrigin = origin(setup);
    const response = await post(setup, 'connect', { token }, localOrigin);
    assert.equal(response.status, 401);
    const body = await response.text();
    const exposesToken = body.includes(token);
    assert.equal(exposesToken, false);
    assert.equal(store.value, 'previous-working-token');
    assert.deepEqual(store.writes, []);
  } finally {
    await setup.close();
  }
});

test('network and keyring failures are sanitized without replacing stored credentials', async () => {
  const token = 'failure-must-never-print-this';
  const store = new MemoryStore('previous-working-token');
  const fetchMock: typeof globalThis.fetch = async () => {
    throw new Error(`Network exception includes ${token}`);
  };
  const setup = await startSetup({ store, fetch: fetchMock });
  try {
    const localOrigin = origin(setup);
    const response = await post(setup, 'connect', { token }, localOrigin);
    assert.equal(response.status, 502);
    const body = await response.text();
    const exposesToken = body.includes(token);
    assert.equal(exposesToken, false);
    assert.equal(store.value, 'previous-working-token');
    assert.deepEqual(store.writes, []);
  } finally {
    await setup.close();
  }
  const failedStore = new MemoryStore('previous-working-token');
  failedStore.write = async () => {
    throw new Error(`Keyring exception includes ${token}`);
  };
  const secondSetup = await startSetup({ store: failedStore, fetch: validUpstream });
  try {
    const localOrigin = origin(secondSetup);
    const response = await post(secondSetup, 'connect', { token }, localOrigin);
    assert.equal(response.status, 503);
    const body = await response.text();
    const exposesToken = body.includes(token);
    assert.equal(exposesToken, false);
    assert.equal(failedStore.value, 'previous-working-token');
  } finally {
    await secondSetup.close();
  }
});

test('credential submission rejects wrong content type, invalid JSON, extra fields and oversized bodies', async () => {
  const store = new MemoryStore();
  let upstreamCalls = 0;
  const fetchMock: typeof globalThis.fetch = async () => {
    upstreamCalls += 1;
    return validUpstream();
  };
  const setup = await startSetup({ store, fetch: fetchMock });
  try {
    const localOrigin = origin(setup);
    const wrongContent = await globalThis.fetch(`${setup.url}/connect`, { method: 'POST', headers: { Origin: localOrigin, 'Content-Type': 'text/plain' }, body: '{"token":"secret"}' });
    assert.equal(wrongContent.status, 415);
    const invalidJson = await globalThis.fetch(`${setup.url}/connect`, { method: 'POST', headers: { Origin: localOrigin, 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(invalidJson.status, 400);
    const extraField = await post(setup, 'connect', { token: 'secret', unrelated: true }, localOrigin);
    assert.equal(extraField.status, 400);
    const emptyToken = await post(setup, 'connect', { token: '' }, localOrigin);
    assert.equal(emptyToken.status, 400);
    const oversized = 'x'.repeat(5000);
    const largeBody = JSON.stringify({ token: oversized });
    const tooLarge = await globalThis.fetch(`${setup.url}/connect`, { method: 'POST', headers: { Origin: localOrigin, 'Content-Type': 'application/json' }, body: largeBody });
    assert.equal(tooLarge.status, 413);
    assert.equal(upstreamCalls, 0);
    assert.deepEqual(store.writes, []);
  } finally {
    await setup.close();
  }
});

test('same-origin disconnect removes the credential and status never exposes its old value', async () => {
  const token = 'secret-to-disconnect';
  const store = new MemoryStore(token);
  const setup = await startSetup({ store, fetch: validUpstream });
  try {
    const localOrigin = origin(setup);
    const disconnected = await post(setup, 'disconnect', {}, localOrigin);
    assert.equal(disconnected.status, 200);
    const payload = await disconnected.json();
    assert.deepEqual(payload, { connected: false });
    assert.equal(store.value, null);
    assert.equal(store.removals, 1);
    const response = await globalThis.fetch(`${setup.url}/status`);
    const status = await response.json();
    assert.deepEqual(status, { connected: false });
    const serialized = JSON.stringify(status);
    const exposesToken = serialized.includes(token);
    assert.equal(exposesToken, false);
  } finally {
    await setup.close();
  }
});

test('setup links expire and stop accepting connections', async () => {
  const store = new MemoryStore();
  const setup = await startSetup({ store, fetch: validUpstream, timeoutMs: 25 });
  try {
    await delay(80);
    const connect = async () => {
      await globalThis.fetch(setup.url);
    };
    await assert.rejects(connect);
    assert.deepEqual(store.writes, []);
  } finally {
    await setup.close();
  }
});
