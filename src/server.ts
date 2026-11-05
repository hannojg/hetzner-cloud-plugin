import { Server } from '@modelcontextprotocol/server';
import type { Tool } from '@modelcontextprotocol/server';
import { executeOperation, toolResult } from './api-client.js';
import type { ClientOptions } from './api-client.js';
import type { Operation } from './api-types.js';
import { operations } from './generated/operations.js';

export function createServer(options: ClientOptions = {}): Server {
  const server = new Server(
    { name: 'hetzner-cloud', version: '0.1.0' },
    {
      capabilities: { tools: {} },
      instructions: 'Manage Hetzner Cloud and Storage Boxes with one tool per official API operation. Credentials come from HETZNER_API_TOKEN, scoped to one project. Use path, query and body argument groups. Follow meta.pagination for further pages. Changes may return asynchronous actions: check action status until success or error. Do not repeat writes automatically. Mutations can incur costs or delete data; act on the user’s stated intent. Deprecated tools retain upstream warnings.',
    },
  );
  const operationByName = new Map<string, Operation>();
  const tools: Tool[] = [];
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
    const operation = operationByName.get(request.params.name);
    if (operation === undefined) {
      return toolResult({ error: { code: 'unknown_tool', message: `Unknown Hetzner tool: ${request.params.name}` } }, true);
    }
    const callOptions: ClientOptions = { ...options, signal: context.mcpReq.signal };
    return executeOperation(operation, request.params.arguments, callOptions);
  });
  return server;
}
