import { Server } from '@modelcontextprotocol/server';
import type { Tool } from '@modelcontextprotocol/server';
import { executeOperation, toolResult } from './api-client.js';
import type { ClientOptions } from './api-client.js';
import type { Operation } from './api-types.js';
import { operations } from './generated/operations.js';
import { KeyringCredentialStore } from './credential-store.js';
import type { CredentialStore } from './credential-store.js';
import { startSetup } from './setup-server.js';
import type { SetupSession } from './setup-server.js';
import { openBrowser } from './browser.js';
import { version } from './version.js';

export interface ServerOptions {
  store?: CredentialStore;
  fetch?: typeof globalThis.fetch;
  openBrowser?: (url: string) => Promise<void>;
}

const connectionTools: Tool[] = [
  {
    name: 'hetzner_configure',
    title: 'Set up Hetzner Cloud',
    description: 'Open a private local page in the default browser to connect a Hetzner project, replace its token, or remove the saved connection. The user enters the API token only in that page; never request it in chat or as a tool argument.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: 'hetzner_connection_status',
    title: 'Check Hetzner connection',
    description: 'Report whether a token is stored in the system credential store. Returns only connection status; does not reveal the token or make a Hetzner API request.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

export function createServer(options: ServerOptions = {}): Server {
  const store = options.store ?? new KeyringCredentialStore();
  const launchBrowser = options.openBrowser ?? openBrowser;
  let setupSession: SetupSession | undefined;
  let configuring = false;
  const server = new Server(
    { name: 'hetzner-cloud', version },
    {
      capabilities: { tools: {} },
      instructions: 'Manage Hetzner Cloud and Storage Boxes with one tool per official API operation. Use hetzner_configure for private browser setup and hetzner_connection_status for stored-credential status. Never ask for API tokens in chat or tool arguments. Tokens live in the system credential store. Use path, query and body groups. Follow pagination. Await asynchronous actions until success or error. Do not repeat writes automatically. Changes may incur costs or delete data; follow the user’s intent. Deprecated tools retain upstream warnings.',
    },
  );
  const operationByName = new Map<string, Operation>();
  const tools: Tool[] = [...connectionTools];
  for (const operation of operations) {
    operationByName.set(operation.name, operation);
    const description = `${operation.method} ${operation.path}\n${operation.description}`;
    tools.push({
      name: operation.name,
      title: operation.summary,
      description,
      inputSchema: operation.inputSchema,
      annotations: operation.annotations,
    });
  }
  server.setRequestHandler('tools/list', async () => ({ tools }));
  server.setRequestHandler('tools/call', async (request, context) => {
    const name = request.params.name;
    if (name === 'hetzner_configure' || name === 'hetzner_connection_status') {
      const args = request.params.arguments ?? {};
      const keys = Object.keys(args);
      if (keys.length > 0) {
        return toolResult({ error: { code: 'invalid_arguments', message: 'This connection tool takes no arguments. Enter tokens only in the private setup page.' } }, true);
      }
      if (name === 'hetzner_connection_status') {
        try {
          const token = await store.read();
          const connected = token !== null;
          return toolResult({ connected });
        } catch {
          return toolResult({ error: { code: 'credential_store_unavailable', message: 'The system credential store could not be read. Unlock it and try again.' } }, true);
        }
      }
      if (configuring) {
        return toolResult({ error: { code: 'setup_busy', message: 'The setup page is already being opened.' } }, true);
      }
      configuring = true;
      try {
        await setupSession?.close();
        setupSession = await startSetup({ store, fetch: options.fetch });
        await launchBrowser(setupSession.url);
        return toolResult({ url: setupSession.url, expiresAt: setupSession.expiresAt });
      } catch {
        await setupSession?.close();
        setupSession = undefined;
        return toolResult({ error: { code: 'setup_unavailable', message: 'The local setup page could not be opened. Make sure a default browser is available on this computer, then run setup again.' } }, true);
      } finally {
        configuring = false;
      }
    }
    const operation = operationByName.get(request.params.name);
    if (operation === undefined) {
      return toolResult({ error: { code: 'unknown_tool', message: `Unknown Hetzner tool: ${request.params.name}` } }, true);
    }
    const callOptions: ClientOptions = { store, fetch: options.fetch, signal: context.mcpReq.signal };
    return executeOperation(operation, request.params.arguments, callOptions);
  });
  server.onclose = () => {
    void setupSession?.close();
  };
  return server;
}
