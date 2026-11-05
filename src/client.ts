import { apiResult, executeOperation } from './api-client.js';
import type { ApiResult } from './api-client.js';
import { normalizeProjectName } from './project-store.js';
import type { ProjectStore } from './project-store.js';
import { operations } from './generated/operations.js';

export interface ClientOptions {
  projects: ProjectStore;
  fetch?: typeof globalThis.fetch;
  input?: string;
  setup?: () => Promise<{ url: string; expiresAt: string }>;
}

function invalidArguments(): ApiResult {
  return apiResult({ error: { code: 'invalid_arguments', message: 'Use list [search], describe <operation>, call <operation> [--project <name>], projects, status [--project <name>], or setup. API call arguments are JSON on stdin.' } }, true);
}

function projectArgument(args: string[], offset: number): string | null | undefined {
  if (args.length === offset) return undefined;
  if (args.length !== offset + 2 || args[offset] !== '--project') return null;
  return normalizeProjectName(args[offset + 1]);
}

function credentialError(): ApiResult {
  return apiResult({ error: { code: 'credential_store_unavailable', message: 'The system credential store could not be read. Unlock it and try again.' } }, true);
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
    const project = projectArgument(args, 2);
    if (args.length < 2 || project === null || (command === 'describe' && args.length !== 2)) return invalidArguments();
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
    let projects: string[];
    try {
      projects = await options.projects.list();
    } catch {
      return credentialError();
    }
    let selected = project;
    if (selected === undefined) {
      if (projects.length > 1) {
        return apiResult({ error: { code: 'project_required', message: 'Ask the user which project to use, then pass --project with that name.' }, projects }, true);
      }
      selected = projects[0];
      if (selected === undefined) {
        return apiResult({ error: { code: 'not_connected', message: 'Run Hetzner Cloud plugin setup to connect a project.' } }, true);
      }
    } else if (projects.includes(selected) === false) {
      return apiResult({ error: { code: 'project_not_found', message: 'This project is not connected. Choose a saved project or run setup.' }, projects }, true);
    }
    const store = options.projects.forProject(selected);
    const result = await executeOperation(operation, input, { store, fetch: options.fetch });
    result.payload.project = selected;
    return result;
  }
  if (command === 'status' || command === 'projects') {
    const project = projectArgument(args, 1);
    if (project === null || (command === 'projects' && args.length !== 1)) return invalidArguments();
    try {
      const projects = await options.projects.list();
      if (command === 'projects') return apiResult({ projects });
      if (project === undefined) {
        return apiResult({ projects, connected: projects.length > 0 });
      }
      const connected = projects.includes(project);
      return apiResult({ projects, project, connected });
    } catch {
      return credentialError();
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
