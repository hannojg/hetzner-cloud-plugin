import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { normalizeProjectName } from './project-store.js';
import type { ProjectStore } from './project-store.js';
import { setupPage } from './setup-page.js';
import { version } from './version.js';

interface SetupOptions {
  projects: ProjectStore;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

export interface SetupSession {
  url: string;
  expiresAt: string;
  close(): Promise<void>;
}

function respond(response: ServerResponse, status: number, data: Record<string, unknown>): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  const body = JSON.stringify(data);
  response.end(body);
}

function error(response: ServerResponse, status: number, code: string, message: string): void {
  respond(response, status, { error: { code, message } });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  const array = Array.isArray(value);
  return value !== null && typeof value === 'object' && array === false;
}

async function readBody(request: IncomingMessage, response: ServerResponse): Promise<Record<string, unknown> | null> {
  const buffers: Buffer[] = [];
  let length = 0;
  const chunks = request.iterator({ destroyOnReturn: false });
  for await (const chunk of chunks) {
    const buffer: Buffer = chunk;
    length += buffer.length;
    if (length > 4096) {
      request.resume();
      error(response, 413, 'payload_too_large', 'The setup request is too large.');
      return null;
    }
    buffers.push(buffer);
  }
  const bytes = Buffer.concat(buffers);
  const text = bytes.toString('utf8');
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    error(response, 400, 'invalid_request', 'The setup request must contain JSON.');
    return null;
  }
  if (isRecord(body) === false) {
    error(response, 400, 'invalid_request', 'The setup request must be an object.');
    return null;
  }
  return body;
}

export async function startSetup(options: SetupOptions): Promise<SetupSession> {
  const random = randomBytes(32);
  const sessionId = random.toString('base64url');
  const scriptRandom = randomBytes(24);
  const scriptNonce = scriptRandom.toString('base64url');
  const path = `/${sessionId}`;
  const html = setupPage(scriptNonce);
  const fetchRequest = options.fetch ?? globalThis.fetch;
  const abort = new AbortController();
  const timeoutMs = options.timeoutMs ?? 600_000;
  const now = Date.now();
  const expires = new Date(now + timeoutMs);
  const expiresAt = expires.toISOString();
  let origin = '';
  let host = '';
  let busy = false;

  async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${scriptNonce}'; style-src 'nonce-${scriptNonce}'; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'`);
    if (request.headers.host !== host) {
      error(response, 403, 'invalid_host', 'This setup page is only available on its local address.');
      return;
    }
    if (request.method === 'GET' && request.url === path) {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(html);
      return;
    }
    if (request.method === 'GET' && request.url === `${path}/status`) {
      try {
        const projects = await options.projects.list();
        respond(response, 200, { projects });
      } catch {
        error(response, 503, 'credential_store_unavailable', 'Your system credential store could not be opened. Unlock it and try again.');
      }
      return;
    }
    const connect = request.url === `${path}/connect`;
    const disconnect = request.url === `${path}/disconnect`;
    if (request.method !== 'POST' || (connect === false && disconnect === false)) {
      error(response, 404, 'not_found', 'This setup address is not available.');
      return;
    }
    if (request.headers.origin !== origin) {
      error(response, 403, 'invalid_origin', 'Open the private setup page to change this connection.');
      return;
    }
    const contentType = request.headers['content-type'] ?? '';
    const contentTypes = contentType.split(';');
    if (contentTypes[0] !== 'application/json') {
      error(response, 415, 'invalid_content_type', 'The setup request must use application/json.');
      return;
    }
    if (busy) {
      error(response, 409, 'setup_busy', 'A connection update is already in progress.');
      return;
    }
    busy = true;
    try {
      const body = await readBody(request, response);
      if (body === null) return;
      const keys = Object.keys(body);
      const project = normalizeProjectName(body.project);
      if (project === null) {
        error(response, 400, 'invalid_project', 'Enter a project name with 1 to 30 characters and no control characters.');
        return;
      }
      const store = options.projects.forProject(project);
      if (disconnect) {
        if (keys.length !== 1) {
          error(response, 400, 'invalid_request', 'Choose the project connection to remove.');
          return;
        }
        try {
          await store.remove();
          respond(response, 200, { project, connected: false });
        } catch {
          error(response, 503, 'credential_store_unavailable', 'The saved token could not be removed. Unlock your system credential store and try again.');
        }
        return;
      }
      if (keys.length !== 2 || typeof body.token !== 'string') {
        error(response, 400, 'invalid_request', 'Enter a project API token.');
        return;
      }
      const token = body.token.trim();
      const validToken = /^[A-Za-z0-9_-]{1,512}$/.test(token);
      if (validToken === false) {
        error(response, 400, 'invalid_token', 'Enter a valid project API token from Hetzner Console.');
        return;
      }
      const timeout = AbortSignal.timeout(15_000);
      const signal = AbortSignal.any([timeout, abort.signal]);
      let verification: Response;
      try {
        verification = await fetchRequest('https://api.hetzner.cloud/v1/servers?per_page=1', {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'User-Agent': `hetzner-cloud-plugin/${version}` },
          method: 'GET',
          redirect: 'error',
          signal,
        });
      } catch {
        error(response, 502, 'verification_failed', 'Could not reach Hetzner. Your token has not been saved; try again.');
        return;
      }
      await verification.body?.cancel();
      if (verification.status === 401 || verification.status === 403) {
        error(response, 401, 'invalid_token', 'Hetzner did not accept this token. Check the token and its project permissions.');
        return;
      }
      if (verification.ok === false) {
        error(response, 502, 'verification_failed', 'Hetzner could not verify access right now. Your token has not been saved; try again.');
        return;
      }
      if (abort.signal.aborted) return;
      try {
        await store.write(token);
        respond(response, 200, { project, connected: true });
      } catch {
        error(response, 503, 'credential_store_unavailable', 'Your token could not be saved. Unlock your system credential store and try again.');
      }
    } finally {
      busy = false;
    }
  }

  const server = createServer((request, response) => {
    const pending = route(request, response);
    pending.catch(() => {
      if (response.headersSent === false) {
        error(response, 500, 'setup_failed', 'The setup request could not be completed. Try again.');
      } else {
        response.end();
      }
    });
  });
  server.requestTimeout = 20_000;
  server.headersTimeout = 10_000;
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('The local setup page could not be started.');
  }
  host = `127.0.0.1:${address.port}`;
  origin = `http://${host}`;
  let closed = false;
  let timer: ReturnType<typeof setTimeout>;
  async function close(): Promise<void> {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    abort.abort();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  timer = setTimeout(() => { void close(); }, timeoutMs);
  timer.unref();
  return { url: `${origin}${path}`, expiresAt, close };
}
