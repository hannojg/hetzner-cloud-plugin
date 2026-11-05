import type { Tool } from '@modelcontextprotocol/server';

export type ApiName = 'cloud' | 'hetzner';

export type JsonSchema = Record<string, unknown>;

export interface OperationParameter {
  name: string;
  in: 'path' | 'query';
  style?: string;
  explode?: boolean;
}

export interface Operation {
  name: string;
  api: ApiName;
  operationId: string;
  method: string;
  path: string;
  summary: string;
  description: string;
  deprecated: boolean;
  inputSchema: Tool['inputSchema'];
  parameters: OperationParameter[];
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
  };
}
