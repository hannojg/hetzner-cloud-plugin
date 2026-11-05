import assert from 'node:assert/strict';
import test from 'node:test';
import { runClient } from '../src/client.js';
import { operations } from '../src/generated/operations.js';
import { MemoryStore } from './helpers.js';

function operation(operationId: string) {
  const selected = operations.find((item) => item.api === 'cloud' && item.operationId === operationId);
  assert.ok(selected);
  return selected;
}

function record(value: unknown): asserts value is Record<string, unknown> {
  assert.ok(value);
  assert.equal(typeof value, 'object');
  const array = Array.isArray(value);
  assert.equal(array, false);
}

test('catalog commands work without opening the credential store', async () => {
  const store = new MemoryStore();
  store.read = async () => {
    throw new Error('Catalog commands must not access credentials');
  };
  const listed = await runClient(['list'], { store });
  assert.equal(listed.isError, false);
  assert.equal(listed.payload.count, 222);
  const listedOperations = listed.payload.operations;
  const array = Array.isArray(listedOperations);
  assert.equal(array, true);
  const filtered = await runClient(['list', 'server'], { store });
  assert.equal(filtered.isError, false);
  const filteredCount = Number(filtered.payload.count);
  assert.ok(filteredCount > 0);
  assert.ok(filteredCount < 222);
  const selected = operation('create_server');
  const described = await runClient(['describe', selected.name], { store });
  assert.equal(described.isError, false);
  assert.deepEqual(described.payload.operation, selected);
});

test('call reads JSON input, uses the local credential and returns the original API payload', async () => {
  const store = new MemoryStore('private-project-token');
  const selected = operation('get_server');
  const input = JSON.stringify({ path: { id: 42 } });
  let calls = 0;
  const data = { server: { id: 42, name: 'example' } };
  const fetchMock: typeof globalThis.fetch = async (url, init) => {
    calls += 1;
    const target = String(url);
    assert.equal(target, 'https://api.hetzner.cloud/v1/servers/42');
    const headers = new Headers(init?.headers);
    const authorization = headers.get('authorization');
    assert.equal(authorization, 'Bearer private-project-token');
    const response = JSON.stringify(data);
    return new Response(response);
  };
  const result = await runClient(['call', selected.name], { store, input, fetch: fetchMock });
  assert.equal(result.isError, false);
  assert.equal(result.payload.status, 200);
  assert.deepEqual(result.payload.data, data);
  assert.equal(calls, 1);
  const serialized = JSON.stringify(result);
  const exposesSecret = serialized.includes('private-project-token');
  assert.equal(exposesSecret, false);
});

test('invalid JSON, unknown operations and credential arguments fail before accessing credentials', async () => {
  const store = new MemoryStore('stored-secret');
  const selected = operation('list_servers');
  const invalidJson = await runClient(['call', selected.name], { store, input: '{' });
  assert.equal(invalidJson.isError, true);
  record(invalidJson.payload.error);
  assert.equal(invalidJson.payload.error.code, 'invalid_json');
  const unknown = await runClient(['describe', 'invented_operation'], { store });
  assert.equal(unknown.isError, true);
  record(unknown.payload.error);
  assert.equal(unknown.payload.error.code, 'unknown_operation');
  const secret = 'must-not-be-an-argument';
  let setups = 0;
  const setup = async () => {
    setups += 1;
    return { url: 'http://127.0.0.1:12345/private-session', expiresAt: '2026-11-05T12:10:00.000Z' };
  };
  for (const args of [['status', secret], ['setup', secret], ['call', selected.name, secret], ['describe', selected.name, secret]]) {
    const rejected = await runClient(args, { store, setup });
    assert.equal(rejected.isError, true);
    record(rejected.payload.error);
    assert.equal(rejected.payload.error.code, 'invalid_arguments');
    const serialized = JSON.stringify(rejected);
    const echoesSecret = serialized.includes(secret);
    assert.equal(echoesSecret, false);
  }
  const input = JSON.stringify({ token: secret });
  const credentialInBody = await runClient(['call', selected.name], { store, input });
  assert.equal(credentialInBody.isError, true);
  record(credentialInBody.payload.error);
  assert.equal(credentialInBody.payload.error.code, 'invalid_arguments');
  assert.equal(store.reads, 0);
  assert.equal(setups, 0);
});

test('status reveals only the connection flag and setup returns the private browser session', async () => {
  const token = 'stored-secret-for-status';
  const store = new MemoryStore(token);
  const status = await runClient(['status'], { store });
  assert.equal(status.isError, false);
  assert.deepEqual(status.payload, { connected: true });
  await store.remove();
  const disconnected = await runClient(['status'], { store });
  assert.deepEqual(disconnected.payload, { connected: false });
  const session = { url: 'http://127.0.0.1:12345/private-session', expiresAt: '2026-11-05T12:10:00.000Z' };
  let starts = 0;
  const setup = async () => {
    starts += 1;
    return session;
  };
  const result = await runClient(['setup'], { store, setup });
  assert.equal(result.isError, false);
  assert.deepEqual(result.payload, session);
  assert.equal(starts, 1);
  const serialized = JSON.stringify(result);
  const exposesSecret = serialized.includes(token);
  assert.equal(exposesSecret, false);
});
