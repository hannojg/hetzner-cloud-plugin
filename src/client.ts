import { apiResult, executeOperation } from './api-client.js';
import type { ApiResult } from './api-client.js';
import type { CredentialStore } from './credential-store.js';
import { operations } from './generated/operations.js';

export interface ClientOptions {
  store: CredentialStore;
  fetch?: typeof globalThis.fetch;
  input?: string;
  setup?: () => Promise<{ url: string; expiresAt: string }>;
}

function invalidArguments(): ApiResult {
  return apiResult({ error: { code: 'invalid_arguments', message: 'Use list [search], describe <operation>, call <operation>, status, or setup. API call arguments are JSON on stdin.' } }, true);
}

export async function runClient(args: string[], options: ClientOptions): Promise<ApiResult> {
  const command = args[0];
  if (command === 'list') {
    if (args.length > 2) return invalidArguments();
    const search = args[1]?.toLowerCase() ?? '';
    const matches = operations.filter((operation) => {
      const text = `${operation.name} ${operation.summary}`;
      const normalized = text.toLowerCase();
      return normalized.includes(search);
    });
    const catalog = matches.map((operation) => ({
      name: operation.name,
      summary: operation.summary,
      method: operation.method,
      path: operation.path,
      api: operation.api,
      deprecated: operation.deprecated,
    }));
    return apiResult({ operations: catalog, count: catalog.length });
  }
  if (command === 'describe' || command === 'call') {
    if (args.length !== 2) return invalidArguments();
    const operation = operations.find((item) => item.name === args[1]);
    if (operation === undefined) {
      return apiResult({ error: { code: 'unknown_operation', message: 'Unknown Hetzner API operation. Use list to find an operation.' } }, true);
    }
    if (command === 'describe') return apiResult({ operation });
    const inputText = options.input?.trim() ?? '';
    let input: unknown = {};
    if (inputText.length > 0) {
      try {
        input = JSON.parse(inputText);
      } catch {
        return apiResult({ error: { code: 'invalid_json', message: 'API call arguments must be valid JSON on stdin.' } }, true);
      }
    }
    return executeOperation(operation, input, options);
  }
  if (command === 'status') {
    if (args.length !== 1) return invalidArguments();
    try {
      const token = await options.store.read();
      const connected = token !== null;
      return apiResult({ connected });
    } catch {
      return apiResult({ error: { code: 'credential_store_unavailable', message: 'The system credential store could not be read. Unlock it and try again.' } }, true);
    }
  }
  if (command === 'setup') {
    if (args.length !== 1) return invalidArguments();
    if (options.setup === undefined) {
      return apiResult({ error: { code: 'setup_unavailable', message: 'The private setup page could not be opened.' } }, true);
    }
    try {
      const session = await options.setup();
      return apiResult(session);
    } catch {
      return apiResult({ error: { code: 'setup_unavailable', message: 'The private setup page could not be opened. Check that a default browser is available on this computer, then try again.' } }, true);
    }
  }
  return invalidArguments();
}
