import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import type { CallToolResult } from '@modelcontextprotocol/server';
import { createServer } from '../src/server.js';

type ServerOptions = Parameters<typeof createServer>[0];

async function connect(options: ServerOptions, legacy = false) {
  const transports = InMemoryTransport.createLinkedPair();
  const server = createServer(options);
  const clientOptions = legacy ? { supportedProtocolVersions: ['2025-11-25'] } : {};
  const client = new Client({ name: 'hetzner-plugin-tests', version: '0.1.0' }, clientOptions);
  await server.connect(transports[1]);
  await client.connect(transports[0]);
  return { client, server };
}

async function withClient(options: ServerOptions, run: (client: Client) => Promise<void>, legacy = false) {
  const session = await connect(options, legacy);
  try {
    await run(session.client);
  } finally {
    await session.client.close();
    await session.server.close();
  }
}

function requireRecord(value: unknown): asserts value is Record<string, unknown> {
  assert.ok(value);
  assert.equal(typeof value, 'object');
  const array = Array.isArray(value);
  assert.equal(array, false);
}

function content(result: CallToolResult) {
  const structured = result.structuredContent;
  requireRecord(structured);
  return structured;
}

async function rejectUnexpectedFetch(): Promise<Response> {
  throw new Error('Unexpected network call');
}

test('MCP discovery covers every official operation and advertises read/write annotations', async () => {
  const expected = new Set<string>();
  for (const api of ['cloud', 'hetzner']) {
    const url = new URL(`../spec/${api}.spec.json`, import.meta.url);
    const source = await readFile(url, 'utf8');
    const spec = JSON.parse(source);
    for (const path of Object.values(spec.paths)) {
      const item = path as Record<string, { operationId?: string }>;
      for (const operation of Object.values(item)) {
        if (operation.operationId) {
          expected.add(`${api}_${operation.operationId}`);
        }
      }
    }
  }
  await withClient({ token: '', fetch: rejectUnexpectedFetch }, async (client) => {
    const result = await client.listTools();
    const names = result.tools.map((tool) => tool.name);
    const actual = new Set(names);
    assert.equal(actual.size, 222);
    assert.deepEqual(actual, expected);
    const read = result.tools.find((tool) => tool.name === 'cloud_list_servers');
    const write = result.tools.find((tool) => tool.name === 'cloud_delete_server');
    assert.equal(read?.annotations?.readOnlyHint, true);
    assert.equal(write?.annotations?.destructiveHint, true);
    assert.equal(write?.annotations?.openWorldHint, true);
  });
});

test('legacy Codex MCP initialization supports discovery and reports a missing token without making a request', async () => {
  await withClient({ token: '', fetch: rejectUnexpectedFetch }, async (client) => {
    const result = await client.listTools();
    assert.equal(result.tools.length, 222);
    const response = await client.callTool({ name: 'cloud_list_servers', arguments: {} });
    assert.equal(response.isError, true);
    const payload = content(response);
    const error = payload.error as Record<string, unknown>;
    assert.equal(error.code, 'missing_token');
  }, true);
});

test('invalid enum, missing path, missing body fields and unknown query keys never reach Hetzner', async () => {
  let calls = 0;
  const fetchMock: typeof globalThis.fetch = async () => {
    calls += 1;
    return new Response('{}');
  };
  await withClient({ token: 'test-token', fetch: fetchMock }, async (client) => {
    const cases = [
      { name: 'cloud_list_servers', arguments: { query: { status: ['sleeping'] } } },
      { name: 'cloud_get_server', arguments: {} },
      { name: 'cloud_create_server', arguments: { body: { name: 'test' } } },
      { name: 'cloud_list_servers', arguments: { query: { per_page: 51 } } },
      { name: 'cloud_list_servers', arguments: { query: { invented: true } } },
      { name: 'cloud_get_server', arguments: { path: { id: '../secrets' } } }
    ];
    for (const input of cases) {
      const response = await client.callTool(input);
      assert.equal(response.isError, true);
      const payload = content(response);
      const error = payload.error as Record<string, unknown>;
      assert.equal(error.code, 'invalid_arguments');
    }
  });
  assert.equal(calls, 0);
});

test('cloud query arrays repeat keys, selectors are encoded, and pagination metadata is retained', async () => {
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
  await withClient({ token: 'test-token', fetch: fetchMock }, async (client) => {
    const response = await client.callTool({ name: 'cloud_list_servers', arguments: { query: { status: ['running', 'off'], label_selector: 'env=prod,service in (api,web)', page: 2, per_page: 50 } } });
    assert.equal(response.isError, false);
    const payload = content(response);
    assert.deepEqual(payload.data, data);
    assert.ok(payload.rateLimit);
  });
  assert.equal(calls, 1);
});

test('server creation preserves the JSON body without adding defaults or retrying writes', async () => {
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
  await withClient({ token: 'test-token', fetch: fetchMock }, async (client) => {
    const response = await client.callTool({ name: 'cloud_create_server', arguments: { body } });
    const payload = content(response);
    assert.deepEqual(payload.data, data);
    assert.equal(payload.status, 201);
  });
  assert.equal(calls, 1);
});

test('Storage Box operations use api.hetzner.com and serialize path parameters and body', async () => {
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
  await withClient({ token: 'test-token', fetch: fetchMock }, async (client) => {
    const created = await client.callTool({ name: 'hetzner_create_storage_box', arguments: { body } });
    assert.equal(created.isError, false);
    const read = await client.callTool({ name: 'hetzner_get_storage_box', arguments: { path: { id: 42 } } });
    assert.equal(read.isError, false);
  });
  assert.deepEqual(paths, ['/v1/storage_boxes', '/v1/storage_boxes/42']);
});

test('upstream authentication and rate-limit errors preserve details and are returned without retries', async () => {
  for (const status of [401, 429, 503]) {
    let calls = 0;
    const data = { error: { code: status === 401 ? 'unauthorized' : 'rate_limit_exceeded', message: 'upstream message', details: { sample: true } } };
    const fetchMock: typeof globalThis.fetch = async () => {
      calls += 1;
      const response = JSON.stringify(data);
      return new Response(response, { status, headers: { 'RateLimit-Remaining': '0', 'Retry-After': '60' } });
    };
    await withClient({ token: 'test-token', fetch: fetchMock }, async (client) => {
      const response = await client.callTool({ name: 'cloud_create_server', arguments: { body: { name: 'test', server_type: 'cpx22', image: 'ubuntu-24.04' } } });
      assert.equal(response.isError, true);
      const payload = content(response);
      assert.equal(payload.status, status);
      assert.deepEqual(payload.data, data);
      assert.equal(payload.retryAfter, '60');
    });
    assert.equal(calls, 1);
  }
});

test('empty successful delete response is represented without inventing a JSON body', async () => {
  const fetchMock: typeof globalThis.fetch = async (input, init) => {
    const inputUrl = String(input);
    assert.equal(inputUrl, 'https://api.hetzner.cloud/v1/servers/42');
    assert.equal(init?.method, 'DELETE');
    return new Response(null, { status: 204 });
  };
  await withClient({ token: 'test-token', fetch: fetchMock }, async (client) => {
    const response = await client.callTool({ name: 'cloud_delete_server', arguments: { path: { id: 42 } } });
    assert.equal(response.isError, false);
    const payload = content(response);
    assert.equal(payload.status, 204);
    assert.equal(payload.data, null);
  });
});

test('unknown tools return an MCP error without making a request', async () => {
  await withClient({ token: 'test-token', fetch: rejectUnexpectedFetch }, async (client) => {
    const response = await client.callTool({ name: 'cloud_invented_operation', arguments: {} });
    assert.equal(response.isError, true);
  });
});


test('DNS string path parameters are encoded as single segments', async () => {
  const fetchMock: typeof globalThis.fetch = async (input) => {
    const inputUrl = String(input);
    assert.equal(inputUrl, 'https://api.hetzner.cloud/v1/zones/example.com/rrsets/name%2Fwith%3Fdelimiters%23/TXT');
    return new Response('{"rrset":{"name":"name/with?delimiters#","type":"TXT"}}');
  };
  await withClient({ token: 'test-token', fetch: fetchMock }, async (client) => {
    const response = await client.callTool({ name: 'cloud_get_zone_rrset', arguments: { path: { id_or_name: 'example.com', rr_name: 'name/with?delimiters#', rr_type: 'TXT' } } });
    assert.equal(response.isError, false);
  });
});
