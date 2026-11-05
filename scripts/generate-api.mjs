import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootUrl = new URL('../', import.meta.url);
const root = fileURLToPath(rootUrl);
const check = process.argv.includes('--check');
const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
const sources = [
  { api: 'cloud', url: 'https://docs.hetzner.cloud/cloud.spec.json' },
  { api: 'hetzner', url: 'https://docs.hetzner.cloud/hetzner.spec.json' },
];
const openApiAnnotations = new Set(['example', 'xml', 'externalDocs', 'discriminator']);

function resolveReference(reference, document) {
  if (reference.startsWith('#/') === false) {
    throw new Error(`Only local OpenAPI references are supported: ${reference}`);
  }
  const pointer = reference.slice(2);
  const segments = pointer.split('/');
  let value = document;
  for (const segment of segments) {
    const slashDecoded = segment.replaceAll('~1', '/');
    const key = slashDecoded.replaceAll('~0', '~');
    value = value[key];
    if (value === undefined) {
      throw new Error(`Unresolved OpenAPI reference: ${reference}`);
    }
  }
  return value;
}

function dereference(value, document, ancestors = new Set()) {
  const array = Array.isArray(value);
  if (array) {
    const result = [];
    for (const item of value) {
      const resolved = dereference(item, document, ancestors);
      result.push(resolved);
    }
    return result;
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  const { $ref: reference, ...siblings } = value;
  let resolved = {};
  if (reference !== undefined) {
    const cycle = ancestors.has(reference);
    if (cycle) {
      throw new Error(`Recursive OpenAPI reference cannot be inlined: ${reference}`);
    }
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(reference);
    const target = resolveReference(reference, document);
    resolved = dereference(target, document, nextAncestors);
  }
  const entries = Object.entries(siblings);
  for (const [key, item] of entries) {
    resolved[key] = dereference(item, document, ancestors);
  }
  return resolved;
}

function normalizeSchema(schema) {
  if (schema === true || schema === false) {
    return schema;
  }
  const result = {};
  const entries = Object.entries(schema);
  for (const [key, value] of entries) {
    const openApiOnly = openApiAnnotations.has(key);
    if (openApiOnly) {
      continue;
    }
    if (key === 'properties' || key === 'patternProperties' || key === '$defs' || key === 'dependentSchemas') {
      const children = {};
      const properties = Object.entries(value);
      for (const [name, child] of properties) {
        children[name] = normalizeSchema(child);
      }
      result[key] = children;
    } else if (key === 'allOf' || key === 'oneOf' || key === 'anyOf' || key === 'prefixItems') {
      const children = [];
      for (const child of value) {
        const normalized = normalizeSchema(child);
        children.push(normalized);
      }
      result[key] = children;
    } else if (key === 'items' || key === 'additionalProperties' || key === 'not' || key === 'contains' || key === 'if' || key === 'then' || key === 'else' || key === 'propertyNames' || key === 'unevaluatedProperties' || key === 'unevaluatedItems') {
      result[key] = normalizeSchema(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function buildInput(operation) {
  const properties = {};
  const required = [];
  const parameters = [];
  for (const location of ['path', 'query']) {
    const group = { type: 'object', properties: {}, additionalProperties: false };
    const requiredParameters = [];
    const operationParameters = operation.parameters ?? [];
    for (const parameter of operationParameters) {
      if (parameter.in !== location) {
        continue;
      }
      const schema = normalizeSchema(parameter.schema);
      if (parameter.description !== undefined) {
        schema.description = parameter.description;
      }
      group.properties[parameter.name] = schema;
      if (parameter.required === true || location === 'path') {
        requiredParameters.push(parameter.name);
      }
      const metadata = { name: parameter.name, in: location };
      if (parameter.style !== undefined) {
        metadata.style = parameter.style;
      }
      if (parameter.explode !== undefined) {
        metadata.explode = parameter.explode;
      }
      parameters.push(metadata);
    }
    const names = Object.keys(group.properties);
    if (names.length > 0) {
      if (requiredParameters.length > 0) {
        group.required = requiredParameters;
        required.push(location);
      }
      properties[location] = group;
    }
  }
  const requestBody = operation.requestBody;
  if (requestBody !== undefined) {
    const content = requestBody.content['application/json'];
    if (content === undefined) {
      throw new Error(`Unsupported request body on ${operation.operationId}`);
    }
    properties.body = normalizeSchema(content.schema);
    if (requestBody.required === true) {
      required.push('body');
    }
  }
  const inputSchema = {
    type: 'object',
    properties,
    additionalProperties: false,
  };
  if (required.length > 0) {
    inputSchema.required = required;
  }
  return { inputSchema, parameters };
}

function buildOperation(api, path, method, source) {
  const { inputSchema, parameters } = buildInput(source);
  const name = `${api}_${source.operationId}`;
  const validName = /^[a-zA-Z0-9_-]{1,64}$/.test(name);
  if (validName === false) {
    throw new Error(`Invalid MCP tool name: ${name}`);
  }
  const readOnly = method === 'get' || method === 'head' || method === 'options';
  const idempotent = readOnly || method === 'put' || method === 'delete';
  const uppercaseMethod = method.toUpperCase();
  const deprecated = source.deprecated === true;
  const summary = source.summary ?? source.operationId;
  let description = source.description ?? summary;
  if (deprecated) {
    description = `DEPRECATED in the official Hetzner specification. ${description}`;
  }
  return {
    name,
    api,
    operationId: source.operationId,
    method: uppercaseMethod,
    path,
    summary,
    description,
    deprecated,
    inputSchema,
    parameters,
    annotations: {
      readOnlyHint: readOnly,
      destructiveHint: readOnly === false,
      idempotentHint: idempotent,
      openWorldHint: true,
    },
  };
}

function compareNames(first, second) {
  if (first.name < second.name) {
    return -1;
  }
  if (first.name > second.name) {
    return 1;
  }
  return 0;
}

function escapeCell(value) {
  const pipes = value.replaceAll('|', '\\|');
  return pipes.replaceAll('\n', ' ');
}

const operations = [];
const metadata = [];
const toolNames = new Set();
for (const source of sources) {
  const file = join(root, 'spec', `${source.api}.spec.json`);
  const raw = await readFile(file, 'utf8');
  const document = JSON.parse(raw);
  const paths = Object.entries(document.paths);
  let operationCount = 0;
  for (const [path, pathItem] of paths) {
    for (const method of methods) {
      if (pathItem[method] === undefined) {
        continue;
      }
      const resolved = dereference(pathItem[method], document);
      const sharedParameters = pathItem.parameters ?? [];
      const ownParameters = resolved.parameters ?? [];
      if (sharedParameters.length > 0) {
        const parameters = new Map();
        const allParameters = [...sharedParameters, ...ownParameters];
        for (const parameter of allParameters) {
          const resolvedParameter = dereference(parameter, document);
          const key = `${resolvedParameter.in}:${resolvedParameter.name}`;
          parameters.set(key, resolvedParameter);
        }
        const combinedParameters = parameters.values();
        resolved.parameters = [...combinedParameters];
      }
      const operation = buildOperation(source.api, path, method, resolved);
      const duplicate = toolNames.has(operation.name);
      if (duplicate) {
        throw new Error(`Duplicate MCP tool name: ${operation.name}`);
      }
      toolNames.add(operation.name);
      operations.push(operation);
      operationCount += 1;
    }
  }
  const hash = createHash('sha256');
  hash.update(raw);
  const sha256 = hash.digest('hex');
  metadata.push({ ...source, sha256, operationCount });
}
operations.sort(compareNames);

const output = JSON.stringify(operations, null, 2);
const artifacts = new Map([
  ['src/generated/operations.json', `${output}\n`],
  ['src/generated/operations.ts', `import type { Operation } from '../api-types.js';\n\nexport const operations: Operation[] = ${output};\n`],
]);
const sourceLines = [
  '# Official API snapshots',
  '',
  'These unmodified OpenAPI documents were downloaded from Hetzner on 2026-11-05.',
  'They are the source of truth for generated MCP tools. No schema download occurs at server startup.',
  '',
  '| File | Official source | Operations | SHA-256 |',
  '| --- | --- | ---: | --- |',
];
for (const source of metadata) {
  sourceLines.push(`| ${source.api}.spec.json | [Hetzner ${source.api} API](${source.url}) | ${source.operationCount} | \`${source.sha256}\` |`);
}
sourceLines.push(
  '',
  'To update the API surface, replace these files with fresh official downloads, then run `npm run generate` and `npm run check`.',
  'Review API changes before committing; generated files are deterministic. `npm run generate -- --check` detects stale generated files.',
  '',
  'The generator preserves JSON Schema request semantics, including unions and compositions. It removes the OpenAPI-only `example`, `xml`, `externalDocs`, and `discriminator` annotations from input schemas.',
  'Deprecated operations remain in the mirror and are marked in tool descriptions and the coverage reference. The datacenter endpoints were removed by Hetzner on 2026-10-01 and should not be used.',
  '',
);
const sourceReadme = sourceLines.join('\n');
artifacts.set('spec/README.md', sourceReadme);

const coverage = [
  '# API coverage',
  '',
  `The MCP mirrors all ${operations.length} operations in the checked-in official Hetzner API snapshots: 190 Cloud operations and 32 Hetzner Storage Box operations.`,
  'Each row corresponds to one tool. Tool inputs use `path`, `query`, and `body` groups with the original API field names and request schemas.',
  '',
  'Cloud resources include servers, server types, volumes, primary and floating IPs, firewalls, networks, load balancers, load balancer types, images, ISOs, SSH keys, certificates, placement groups, DNS zones and RRSets, locations, pricing, and actions.',
  'The Hetzner API additionally covers Storage Boxes, types, folders, snapshots, subaccounts, and their actions.',
  '',
  'Robot dedicated-server management and S3 Object Storage are separate APIs and are outside these two official specifications.',
  '',
  'Deprecated endpoints are retained for a complete specification mirror. In particular, `GET /datacenters` and `GET /datacenters/{id}` were removed on 2026-10-01; use locations and location-specific resource data instead.',
  '',
  '| Tool | Method | Path | Summary | Status |',
  '| --- | --- | --- | --- | --- |',
];
for (const operation of operations) {
  const summary = escapeCell(operation.summary);
  const status = operation.deprecated ? 'Deprecated' : 'Current';
  coverage.push(`| \`${operation.name}\` | ${operation.method} | \`${operation.path}\` | ${summary} | ${status} |`);
}
coverage.push('');
const coverageText = coverage.join('\n');
artifacts.set('docs/api-coverage.md', coverageText);

let stale = false;
for (const [relativePath, content] of artifacts) {
  const target = join(root, relativePath);
  if (check) {
    let existing;
    try {
      existing = await readFile(target, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
    if (existing !== content) {
      process.stderr.write(`Generated file is stale: ${relativePath}\n`);
      stale = true;
    }
  } else {
    const directory = dirname(target);
    await mkdir(directory, { recursive: true });
    await writeFile(target, content);
  }
}
if (stale) {
  process.exitCode = 1;
} else {
  const action = check ? 'Verified' : 'Generated';
  process.stdout.write(`${action} ${operations.length} Hetzner API tools.\n`);
}
