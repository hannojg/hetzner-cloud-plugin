# Official API snapshots

These unmodified OpenAPI documents were downloaded from Hetzner on 2026-11-05.
They are the source of truth for generated MCP tools. No schema download occurs at server startup.

| File | Official source | Operations | SHA-256 |
| --- | --- | ---: | --- |
| cloud.spec.json | [Hetzner cloud API](https://docs.hetzner.cloud/cloud.spec.json) | 190 | `a01f19e86d04c57dfbae1c5eef739883b580d9031fd138690779349de426653b` |
| hetzner.spec.json | [Hetzner hetzner API](https://docs.hetzner.cloud/hetzner.spec.json) | 32 | `3afa18f135b62f4c6703a855fe0c5d5f5769f9bac8451a09819acc6a637cb688` |

To update the API surface, replace these files with fresh official downloads, then run `npm run generate` and `npm run check`.
Review API changes before committing; generated files are deterministic. `npm run generate -- --check` detects stale generated files.

The generator preserves JSON Schema request semantics, including unions and compositions. It removes the OpenAPI-only `example`, `xml`, `externalDocs`, and `discriminator` annotations from input schemas.
Deprecated operations remain in the mirror and are marked in tool descriptions and the coverage reference. The datacenter endpoints were removed by Hetzner on 2026-10-01 and should not be used.
