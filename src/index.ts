import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer } from './server.js';

function serverFactory() {
  const options = { token: process.env.HETZNER_API_TOKEN };
  return createServer(options);
}

serveStdio(serverFactory);
