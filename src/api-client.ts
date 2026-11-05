import type { CallToolResult } from '@modelcontextprotocol/server';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { ValidateFunction } from 'ajv';
import type { ApiName, Operation } from './api-types.js';

const baseUrls: Record<ApiName, string> = {
  cloud: 'https://api.hetzner.cloud/v1',
  hetzner: 'https://api.hetzner.com/v1',
};

const ajv = new Ajv2020({ allErrors: true, strict: false, ownProperties: true });
ajv.addFormat('int64', { type: 'number', validate: Number.isSafeInteger });
const validators = new Map<Operation, ValidateFunction<OperationArguments>>();

type ParameterValue = string | number | boolean;

interface OperationArguments {
  path?: Record<string, ParameterValue>;
  query?: Record<string, ParameterValue | ParameterValue[]>;
  body?: unknown;
}

export interface ClientOptions {
  token?: string;
  fetch?: typeof globalThis.fetch;
  signal?: AbortSignal;
}

export function toolResult(payload: Record<string, unknown>, isError = false): CallToolResult {
  const text = JSON.stringify(payload);
  return { content: [{ type: 'text', text }], structuredContent: payload, isError };
}

function requestUrl(operation: Operation, args: OperationArguments): URL {
  let path = operation.path;
  for (const parameter of operation.parameters) {
    if (parameter.in !== 'path') {
      continue;
    }
    const value = args.path?.[parameter.name];
    const stringValue = String(value);
    const encoded = encodeURIComponent(stringValue);
    path = path.replace(`{${parameter.name}}`, encoded);
  }
  const base = baseUrls[operation.api];
  const url = new URL(`${base}${path}`);
  for (const parameter of operation.parameters) {
    if (parameter.in !== 'query') {
      continue;
    }
    const value = args.query?.[parameter.name];
    if (value === undefined) {
      continue;
    }
    const isArray = Array.isArray(value);
    if (isArray) {
      if (parameter.explode === false) {
        const joined = value.join(',');
        url.searchParams.append(parameter.name, joined);
      } else {
        for (const item of value) {
          const stringValue = String(item);
          url.searchParams.append(parameter.name, stringValue);
        }
      }
    } else {
      const stringValue = String(value);
      url.searchParams.append(parameter.name, stringValue);
    }
  }
  return url;
}

export async function executeOperation(
  operation: Operation,
  args: unknown,
  options: ClientOptions = {},
): Promise<CallToolResult> {
  let validate = validators.get(operation);
  if (validate === undefined) {
    validate = ajv.compile<OperationArguments>(operation.inputSchema);
    validators.set(operation, validate);
  }
  const input = args ?? {};
  const valid = validate(input);
  if (valid === false) {
    const details = validate.errors;
    return toolResult({ error: { code: 'invalid_arguments', message: 'Arguments do not match the Hetzner API schema.', details } }, true);
  }
  const token = options.token?.trim();
  if (token === undefined || token.length === 0) {
    return toolResult({ error: { code: 'missing_token', message: 'Set HETZNER_API_TOKEN to a project API token from https://console.hetzner.com/ (Security → API Tokens), then restart Codex.' } }, true);
  }

  const url = requestUrl(operation, input);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'User-Agent': 'hetzner-cloud-plugin/0.1.0',
  };
  let body: string | undefined;
  if (input.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(input.body);
  }
  const timeout = AbortSignal.timeout(30_000);
  let signal = timeout;
  if (options.signal !== undefined) {
    signal = AbortSignal.any([timeout, options.signal]);
  }
  const fetchRequest = options.fetch ?? globalThis.fetch;
  try {
    const response = await fetchRequest(url, {
      method: operation.method,
      headers,
      body,
      signal,
      redirect: 'error',
    });
    const rateLimit = {
      limit: response.headers.get('ratelimit-limit'),
      remaining: response.headers.get('ratelimit-remaining'),
      reset: response.headers.get('ratelimit-reset'),
    };
    const payload: Record<string, unknown> = { status: response.status, rateLimit };
    const retryAfter = response.headers.get('retry-after');
    if (retryAfter !== null) {
      payload.retryAfter = retryAfter;
    }
    const text = await response.text();
    if (text.length === 0) {
      payload.data = null;
    } else {
      try {
        payload.data = JSON.parse(text);
      } catch {
        payload.error = { code: 'invalid_response', message: 'Hetzner returned a response that is not JSON.' };
        return toolResult(payload, true);
      }
    }
    const failed = response.ok === false;
    return toolResult(payload, failed);
  } catch {
    const aborted = signal.aborted;
    const code = aborted ? 'request_aborted' : 'request_failed';
    return toolResult({ error: { code, message: 'The Hetzner request did not complete. Its outcome may be unknown; check the resource before repeating a write.' } }, true);
  }
}
