import assert from 'node:assert/strict';
import test from 'node:test';
import { runClient } from '../src/client.js';
import { operations } from '../src/generated/operations.js';
import { MemoryProjects } from './helpers.js';

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

test('catalog commands work without reading configured projects or credentials', async () => {
  const projects = new MemoryProjects();
  projects.list = async () => {
    throw new Error('Catalog commands must not access credentials');
  };
  const listed = await runClient(['list'], { projects });
  assert.equal(listed.isError, false);
  assert.equal(listed.payload.count, 222);
  const listedOperations = listed.payload.operations;
  const array = Array.isArray(listedOperations);
  assert.equal(array, true);
  const filtered = await runClient(['list', 'server'], { projects });
  assert.equal(filtered.isError, false);
  const filteredCount = Number(filtered.payload.count);
  assert.ok(filteredCount > 0);
  assert.ok(filteredCount < 222);
  const selected = operation('create_server');
  const described = await runClient(['describe', selected.name], { projects });
  assert.equal(described.isError, false);
  assert.deepEqual(described.payload.operation, selected);
});

test('call automatically selects the sole configured project and returns the API payload', async () => {
  const projects = new MemoryProjects({ Production: 'private-project-token' });
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
  const result = await runClient(['call', selected.name], { projects, input, fetch: fetchMock });
  assert.equal(result.isError, false);
  assert.equal(result.payload.status, 200);
  assert.deepEqual(result.payload.data, data);
  assert.equal(calls, 1);
  const serialized = JSON.stringify(result);
  const exposesSecret = serialized.includes('private-project-token');
  assert.equal(exposesSecret, false);
  assert.deepEqual(projects.selected, ['Production']);
});

test('multiple projects require an explicit choice and each call uses only the selected token', async () => {
  const projects = new MemoryProjects({ Default: 'default-secret', Production: 'production-secret' });
  const selected = operation('list_servers');
  const authorizations: Array<string | null> = [];
  const fetchMock: typeof globalThis.fetch = async (_url, init) => {
    const headers = new Headers(init?.headers);
    const authorization = headers.get('authorization');
    authorizations.push(authorization);
    return new Response('{"servers":[]}');
  };
  const unspecified = await runClient(['call', selected.name], { projects, fetch: fetchMock });
  assert.equal(unspecified.isError, true);
  record(unspecified.payload.error);
  assert.equal(unspecified.payload.error.code, 'project_required');
  assert.deepEqual(unspecified.payload.projects, ['Default', 'Production']);
  assert.deepEqual(authorizations, []);
  const production = await runClient(['call', selected.name, '--project', 'Production'], { projects, fetch: fetchMock });
  assert.equal(production.isError, false);
  const defaultProject = await runClient(['call', selected.name, '--project', ' default '], { projects, fetch: fetchMock });
  assert.equal(defaultProject.isError, false);
  const wrongCase = await runClient(['call', selected.name, '--project', 'production'], { projects, fetch: fetchMock });
  assert.equal(wrongCase.isError, true);
  record(wrongCase.payload.error);
  assert.equal(wrongCase.payload.error.code, 'project_not_found');
  assert.deepEqual(authorizations, ['Bearer production-secret', 'Bearer default-secret']);
});

test('project names are trimmed and Unicode-normalized without changing case-sensitive names', async () => {
  const projects = new MemoryProjects({ 'Café': 'cafe-secret', Default: 'default-secret' });
  const selected = operation('list_servers');
  let authorization: string | null = null;
  const fetchMock: typeof globalThis.fetch = async (_url, init) => {
    const headers = new Headers(init?.headers);
    authorization = headers.get('authorization');
    return new Response('{"servers":[]}');
  };
  const result = await runClient(['call', selected.name, '--project', ' Cafe\u0301 '], { projects, fetch: fetchMock });
  assert.equal(result.isError, false);
  assert.equal(authorization, 'Bearer cafe-secret');
  assert.deepEqual(projects.selected, ['Café']);
});

test('projects and status return project names and connection state without exposing tokens', async () => {
  const projects = new MemoryProjects({ Default: 'default-secret', Production: 'production-secret' });
  const listed = await runClient(['projects'], { projects });
  assert.equal(listed.isError, false);
  assert.deepEqual(listed.payload, { projects: ['Default', 'Production'] });
  const status = await runClient(['status'], { projects });
  assert.equal(status.isError, false);
  assert.deepEqual(status.payload, { projects: ['Default', 'Production'], connected: true });
  const selected = await runClient(['status', '--project', ' DEFAULT '], { projects });
  assert.deepEqual(selected.payload, { projects: ['Default', 'Production'], project: 'Default', connected: true });
  const missing = await runClient(['status', '--project', 'Missing'], { projects });
  assert.equal(missing.isError, false);
  assert.deepEqual(missing.payload, { projects: ['Default', 'Production'], project: 'Missing', connected: false });
  const serialized = JSON.stringify([listed, status, selected, missing]);
  const exposesSecret = serialized.includes('secret');
  assert.equal(exposesSecret, false);
});

test('an unconfigured client reports disconnected state without contacting Hetzner', async () => {
  const projects = new MemoryProjects();
  const selected = operation('list_servers');
  let calls = 0;
  const fetchMock: typeof globalThis.fetch = async () => {
    calls += 1;
    return new Response('{}');
  };
  const result = await runClient(['call', selected.name], { projects, fetch: fetchMock });
  assert.equal(result.isError, true);
  record(result.payload.error);
  assert.equal(result.payload.error.code, 'not_connected');
  const status = await runClient(['status'], { projects });
  assert.deepEqual(status.payload, { projects: [], connected: false });
  assert.equal(calls, 0);
});

test('invalid JSON, unknown operations and credential arguments fail before token reads', async () => {
  const projects = new MemoryProjects({ Default: 'stored-secret' });
  const store = projects.forProject('Default');
  const selected = operation('list_servers');
  const invalidJson = await runClient(['call', selected.name], { projects, input: '{' });
  assert.equal(invalidJson.isError, true);
  record(invalidJson.payload.error);
  assert.equal(invalidJson.payload.error.code, 'invalid_json');
  const unknown = await runClient(['describe', 'invented_operation'], { projects });
  assert.equal(unknown.isError, true);
  record(unknown.payload.error);
  assert.equal(unknown.payload.error.code, 'unknown_operation');
  const secret = 'must-not-be-an-argument';
  let setups = 0;
  const setup = async () => {
    setups += 1;
    return { url: 'http://127.0.0.1:12345/private-session', expiresAt: '2026-11-05T12:10:00.000Z' };
  };
  const invalid = [
    ['status', secret], ['setup', secret], ['call', selected.name, secret], ['describe', selected.name, secret],
    ['projects', '--project', 'Default'], ['list', '--project', 'Default'], ['setup', '--project', 'Default'],
    ['describe', selected.name, '--project', 'Default'], ['call', selected.name, '--project']
  ];
  for (const args of invalid) {
    const rejected = await runClient(args, { projects, setup });
    assert.equal(rejected.isError, true);
    record(rejected.payload.error);
    assert.equal(rejected.payload.error.code, 'invalid_arguments');
    const serialized = JSON.stringify(rejected);
    const echoesSecret = serialized.includes(secret);
    assert.equal(echoesSecret, false);
  }
  const input = JSON.stringify({ token: secret });
  const credentialInBody = await runClient(['call', selected.name], { projects, input });
  assert.equal(credentialInBody.isError, true);
  record(credentialInBody.payload.error);
  assert.equal(credentialInBody.payload.error.code, 'invalid_arguments');
  assert.equal(store.reads, 0);
  assert.equal(setups, 0);
});

test('setup starts the private browser session without selecting a project or exposing tokens', async () => {
  const projects = new MemoryProjects({ Default: 'stored-secret' });
  const session = { url: 'http://127.0.0.1:12345/private-session', expiresAt: '2026-11-05T12:10:00.000Z' };
  let starts = 0;
  const setup = async () => {
    starts += 1;
    return session;
  };
  const result = await runClient(['setup'], { projects, setup });
  assert.equal(result.isError, false);
  assert.deepEqual(result.payload, session);
  assert.equal(starts, 1);
  assert.deepEqual(projects.selected, []);
  const serialized = JSON.stringify(result);
  const exposesSecret = serialized.includes('stored-secret');
  assert.equal(exposesSecret, false);
});

test('project discovery failures are sanitized and prevent any API request', async () => {
  const projects = new MemoryProjects({ Default: 'default-secret', Production: 'production-secret' });
  const secret = 'private-error-detail';
  projects.list = async () => {
    throw new Error(`Project discovery failed: ${secret}`);
  };
  let calls = 0;
  const fetchMock: typeof globalThis.fetch = async () => {
    calls += 1;
    return new Response('{}');
  };
  const selected = operation('list_servers');
  for (const args of [['projects'], ['status'], ['call', selected.name, '--project', 'Production']]) {
    const result = await runClient(args, { projects, fetch: fetchMock });
    assert.equal(result.isError, true);
    record(result.payload.error);
    assert.equal(result.payload.error.code, 'credential_store_unavailable');
    const serialized = JSON.stringify(result);
    const leaksDetail = serialized.includes(secret);
    assert.equal(leaksDetail, false);
  }
  assert.equal(calls, 0);
  assert.deepEqual(projects.selected, []);
});

test('a selected project credential failure never uses another project token', async () => {
  const projects = new MemoryProjects({ Default: 'default-secret', Production: 'production-secret' });
  const production = projects.forProject('Production');
  const defaultStore = projects.forProject('Default');
  projects.selected.length = 0;
  production.read = async () => {
    production.reads += 1;
    throw new Error('Credential denied for production-secret');
  };
  let calls = 0;
  const fetchMock: typeof globalThis.fetch = async () => {
    calls += 1;
    return new Response('{}');
  };
  const selected = operation('list_servers');
  const result = await runClient(['call', selected.name, '--project', 'Production'], { projects, fetch: fetchMock });
  assert.equal(result.isError, true);
  record(result.payload.error);
  assert.equal(result.payload.error.code, 'credential_store_unavailable');
  assert.equal(result.payload.project, 'Production');
  assert.equal(production.reads, 1);
  assert.equal(defaultStore.reads, 0);
  assert.equal(calls, 0);
  assert.deepEqual(projects.selected, ['Production']);
  const serialized = JSON.stringify(result);
  const leaksCredential = serialized.includes('production-secret');
  assert.equal(leaksCredential, false);
});
