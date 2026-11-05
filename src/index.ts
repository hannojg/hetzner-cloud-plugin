import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer } from './server.js';

function serverFactory() {
  return createServer();
}

serveStdio(serverFactory);
