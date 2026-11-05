import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { executeOperation } from '../src/api-client.js';
import { operations } from '../src/generated/operations.js';
import type { ApiName } from '../src/api-types.js';
import { MemoryStore } from './helpers.js';

function operation(api: ApiName, operationId: string) {
  const found = operations.find((item) => item.api === api && item.operationId === operationId);
  assert.ok(found);
  return found;
}

async function rejectUnexpectedFetch(): Promise<Response> {
  throw new Error('Unexpected network call');
}

test('operation catalog covers every official API operation', async () => {
  const expected = new Set<string>();
  for (const api of ['cloud', 'hetzner']) {
    const url = new URL(`../spec/${api}.spec.json`, import.meta.url);
    const source = await readFile(url, 'utf8');
    const spec = JSON.parse(source);
    for (const path of Object.values(spec.paths)) {
      const item = path as Record<string, { operationId?: string }>;
      for (const documented of Object.values(item)) {
        if (documented.operationId) {
          expected.add(`${api}:${documented.operationId}`);
        }
      }
    }
  }
  const names = operations.map((item) => `${item.api}:${item.operationId}`);
  const actual = new Set(names);
  assert.equal(actual.size, 222);
  assert.deepEqual(actual, expected);
});

test('invalid arguments are rejected before reading credentials or contacting Hetzner', async () => {
  let calls = 0;
  const fetchMock: typeof globalThis.fetch = async () => {
    calls += 1;
    return new Response('{}');
  };
  const store = new MemoryStore('test-token');
  const cases = [
    { id: 'list_servers', args: { query: { status: ['sleeping'] } } },
    { id: 'get_server', args: {} },
    { id: 'create_server', args: { body: { name: 'test' } } },
    { id: 'list_servers', args: { query: { per_page: 51 } } },
    { id: 'list_servers', args: { query: { invented: true } } },
    { id: 'get_server', args: { path: { id: '../secrets' } } }
  ];
  for (const input of cases) {
    const selected = operation('cloud', input.id);
    const response = await executeOperation(selected, input.args, { store, fetch: fetchMock });
    assert.equal(response.isError, true);
    const error = response.payload.error as Record<string, unknown>;
    assert.equal(error.code, 'invalid_arguments');
  }
  assert.equal(calls, 0);
  assert.equal(store.reads, 0);
});

test('cloud requests preserve repeated query keys, encoded selectors and pagination metadata', async () => {
  let calls = 0;
  const data = { servers: [], meta: { pagination: { next_page: 3 } } };
  const fetchMock: typeof globalThis.fetch = async (input, init) => {
    calls += 1;
    const inputUrl = String(input);
    const url = new URL(inputUrl);
    assert.equal(url.origin, 'https://api.hetzner.cloud');
    assert.equal(url.pathname, '/v1/servers');
    const states = url.searchParams.getAll('status');
    assert.deepEqual(states, ['running', 'off']);
    const selector = url.searchParams.get('label_selector');
    assert.equal(selector, 'env=prod,service in (api,web)');
    const page = url.searchParams.get('page');
    assert.equal(page, '2');
    const pageSize = url.searchParams.get('per_page');
    assert.equal(pageSize, '50');
    const headers = new Headers(init?.headers);
    const authorization = headers.get('authorization');
    assert.equal(authorization, 'Bearer test-token');
    assert.equal(init?.method, 'GET');
    assert.equal(init?.redirect, 'error');
    const body = JSON.stringify(data);
    return new Response(body, { headers: { 'Content-Type': 'application/json', 'RateLimit-Limit': '3600', 'RateLimit-Remaining': '3599', 'RateLimit-Reset': '1234' } });
  };
  const store = new MemoryStore('test-token');
  const selected = operation('cloud', 'list_servers');
  const args = { query: { status: ['running', 'off'], label_selector: 'env=prod,service in (api,web)', page: 2, per_page: 50 } };
  const response = await executeOperation(selected, args, { store, fetch: fetchMock });
  assert.equal(response.isError, false);
  assert.deepEqual(response.payload.data, data);
  assert.ok(response.payload.rateLimit);
  assert.equal(calls, 1);
});

test('creation preserves the JSON body without injecting defaults or polling returned actions', async () => {
  let calls = 0;
  const body = { name: 'test-server', server_type: 'cpx22', image: 'ubuntu-24.04', labels: { 'example.com/service': 'api' }, public_net: { enable_ipv4: false, ipv6: null } };
  const data = { server: { id: 42 }, action: { id: 7, status: 'running' }, next_actions: [] };
  const fetchMock: typeof globalThis.fetch = async (input, init) => {
    calls += 1;
    const inputUrl = String(input);
    assert.equal(inputUrl, 'https://api.hetzner.cloud/v1/servers');
    assert.equal(init?.method, 'POST');
    const headers = new Headers(init?.headers);
    const contentType = headers.get('content-type');
    assert.equal(contentType, 'application/json');
    const serializedBody = String(init?.body);
    const sent = JSON.parse(serializedBody);
    assert.deepEqual(sent, body);
    const response = JSON.stringify(data);
    return new Response(response, { status: 201 });
  };
  const store = new MemoryStore('test-token');
  const selected = operation('cloud', 'create_server');
  const response = await executeOperation(selected, { body }, { store, fetch: fetchMock });
  assert.equal(response.isError, false);
  assert.deepEqual(response.payload.data, data);
  assert.equal(response.payload.status, 201);
  assert.equal(calls, 1);
});

test('Storage Box requests use the official host, path parameters and JSON body', async () => {
  const paths: string[] = [];
  const body = { name: 'backups', storage_box_type: 'bx20', location: 'fsn1', password: 'test-password', access_settings: { ssh_enabled: true } };
  const fetchMock: typeof globalThis.fetch = async (input, init) => {
    const inputUrl = String(input);
    const url = new URL(inputUrl);
    assert.equal(url.origin, 'https://api.hetzner.com');
    paths.push(url.pathname);
    if (init?.method === 'POST') {
      const serializedBody = String(init.body);
      const sent = JSON.parse(serializedBody);
      assert.deepEqual(sent, body);
    }
    return new Response('{"storage_box":{"id":42}}');
  };
  const store = new MemoryStore('test-token');
  const create = operation('hetzner', 'create_storage_box');
  const created = await executeOperation(create, { body }, { store, fetch: fetchMock });
  assert.equal(created.isError, false);
  const get = operation('hetzner', 'get_storage_box');
  const read = await executeOperation(get, { path: { id: 42 } }, { store, fetch: fetchMock });
  assert.equal(read.isError, false);
  assert.deepEqual(paths, ['/v1/storage_boxes', '/v1/storage_boxes/42']);
});

test('upstream errors preserve JSON and rate-limit details without retrying writes', async () => {
  for (const status of [401, 429, 503]) {
    let calls = 0;
    const data = { error: { code: status === 401 ? 'unauthorized' : 'rate_limit_exceeded', message: 'upstream message', details: { sample: true } } };
    const fetchMock: typeof globalThis.fetch = async () => {
      calls += 1;
      const response = JSON.stringify(data);
      return new Response(response, { status, headers: { 'RateLimit-Remaining': '0', 'Retry-After': '60' } });
    };
    const store = new MemoryStore('test-token');
    const selected = operation('cloud', 'create_server');
    const args = { body: { name: 'test', server_type: 'cpx22', image: 'ubuntu-24.04' } };
    const response = await executeOperation(selected, args, { store, fetch: fetchMock });
    assert.equal(response.isError, true);
    assert.equal(response.payload.status, status);
    assert.deepEqual(response.payload.data, data);
    assert.equal(response.payload.retryAfter, '60');
    assert.equal(calls, 1);
  }
});

test('empty successful deletion is represented without inventing a JSON body', async () => {
  const fetchMock: typeof globalThis.fetch = async (input, init) => {
    const inputUrl = String(input);
    assert.equal(inputUrl, 'https://api.hetzner.cloud/v1/servers/42');
    assert.equal(init?.method, 'DELETE');
    return new Response(null, { status: 204 });
  };
  const store = new MemoryStore('test-token');
  const selected = operation('cloud', 'delete_server');
  const response = await executeOperation(selected, { path: { id: 42 } }, { store, fetch: fetchMock });
  assert.equal(response.isError, false);
  assert.equal(response.payload.status, 204);
  assert.equal(response.payload.data, null);
});

test('DNS string path parameters are encoded as single segments', async () => {
  const fetchMock: typeof globalThis.fetch = async (input) => {
    const inputUrl = String(input);
    assert.equal(inputUrl, 'https://api.hetzner.cloud/v1/zones/example.com/rrsets/name%2Fwith%3Fdelimiters%23/TXT');
    return new Response('{"rrset":{"name":"name/with?delimiters#","type":"TXT"}}');
  };
  const store = new MemoryStore('test-token');
  const selected = operation('cloud', 'get_zone_rrset');
  const args = { path: { id_or_name: 'example.com', rr_name: 'name/with?delimiters#', rr_type: 'TXT' } };
  const response = await executeOperation(selected, args, { store, fetch: fetchMock });
  assert.equal(response.isError, false);
});

test('credential replacement and disconnection apply to the next API call', async () => {
  const store = new MemoryStore('first-token');
  const authorizations: Array<string | null> = [];
  const fetchMock: typeof globalThis.fetch = async (_input, init) => {
    const headers = new Headers(init?.headers);
    const authorization = headers.get('authorization');
    authorizations.push(authorization);
    return new Response('{"servers":[]}');
  };
  const selected = operation('cloud', 'list_servers');
  const first = await executeOperation(selected, {}, { store, fetch: fetchMock });
  assert.equal(first.isError, false);
  await store.write('replacement-token');
  const replacement = await executeOperation(selected, {}, { store, fetch: fetchMock });
  assert.equal(replacement.isError, false);
  await store.remove();
  const disconnected = await executeOperation(selected, {}, { store, fetch: fetchMock });
  assert.equal(disconnected.isError, true);
  const error = disconnected.payload.error as Record<string, unknown>;
  assert.equal(error.code, 'not_connected');
  assert.deepEqual(authorizations, ['Bearer first-token', 'Bearer replacement-token']);
});

test('an obsolete environment token cannot supply credentials when the keyring is empty', async () => {
  const previous = process.env.HETZNER_API_TOKEN;
  process.env.HETZNER_API_TOKEN = 'obsolete-environment-token';
  try {
    const store = new MemoryStore();
    const selected = operation('cloud', 'list_servers');
    const response = await executeOperation(selected, {}, { store, fetch: rejectUnexpectedFetch });
    assert.equal(response.isError, true);
    const error = response.payload.error as Record<string, unknown>;
    assert.equal(error.code, 'not_connected');
  } finally {
    if (previous) {
      process.env.HETZNER_API_TOKEN = previous;
    } else {
      delete process.env.HETZNER_API_TOKEN;
    }
  }
});

test('credential store errors are sanitized and prevent API access', async () => {
  const secret = 'secret-inside-native-error';
  const store = new MemoryStore();
  store.read = async () => {
    throw new Error(`Credential store failure ${secret}`);
  };
  const selected = operation('cloud', 'list_servers');
  const response = await executeOperation(selected, {}, { store, fetch: rejectUnexpectedFetch });
  assert.equal(response.isError, true);
  const error = response.payload.error as Record<string, unknown>;
  assert.equal(error.code, 'credential_store_unavailable');
  const serialized = JSON.stringify(response);
  const exposesSecret = serialized.includes(secret);
  assert.equal(exposesSecret, false);
});
