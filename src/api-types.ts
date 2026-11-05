export type ApiName = 'cloud' | 'hetzner';

export type JsonSchema = Record<string, unknown>;

export interface JsonObjectSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties: boolean;
  [key: string]: unknown;
}

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
  inputSchema: JsonObjectSchema;
  parameters: OperationParameter[];
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
  };
}
