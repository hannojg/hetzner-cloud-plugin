import assert from 'node:assert/strict';
import { mkdtemp, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

function requireRecord(value: unknown): asserts value is Record<string, unknown> {
  assert.ok(value);
  assert.equal(typeof value, 'object');
  const array = Array.isArray(value);
  assert.equal(array, false);
}

test('committed bundle starts from a standalone plugin directory without npm dependencies or credentials', { timeout: 30000 }, async () => {
  const temporaryRoot = tmpdir();
  const prefix = join(temporaryRoot, 'hetzner-plugin-test-');
  const temporaryPath = await mkdtemp(prefix);
  const pluginUrl = new URL('../plugins/hetzner-cloud/', import.meta.url);
  const pluginPath = fileURLToPath(pluginUrl);
  await cp(pluginPath, temporaryPath, { recursive: true });
  const transport = new StdioClientTransport({ command: process.execPath, args: ['./dist/server.mjs'], cwd: temporaryPath, env: { HETZNER_API_TOKEN: '' }, stderr: 'pipe' });
  const client = new Client({ name: 'bundle-smoke-test', version: '0.1.0' });
  let stderr = '';
  transport.stderr?.on('data', (chunk) => {
    stderr += String(chunk);
  });
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    assert.equal(listed.tools.length, 222);
    const result = await client.callTool({ name: 'cloud_list_servers', arguments: {} });
    assert.equal(result.isError, true);
    const payload = result.structuredContent;
    requireRecord(payload);
    const error = payload.error as Record<string, unknown>;
    assert.equal(error.code, 'missing_token');
    assert.equal(stderr, '');
  } finally {
    await client.close();
    await rm(temporaryPath, { recursive: true, force: true });
  }
});
