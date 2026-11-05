---
name: hetzner-cloud
description: Manage Hetzner Cloud infrastructure and Storage Boxes with the plugin's MCP tools. Use for project resources, resource actions, and API-backed infrastructure changes.
---

# Hetzner Cloud

Use the plugin's generated MCP tools to work with Hetzner Cloud and Storage Boxes. Each tool mirrors one documented API operation; follow its input schema and preserve the API's response fields.

## Authentication

The MCP retrieves the project API token from the operating system credential store and sends it directly to Hetzner. Tokens belong to a project and have read-only or read/write permissions.

If the connection is missing, call `hetzner_configure` with `{}` to open the private local setup page in the user's default browser. Let the user enter their token privately on that page. The page also supports replacing the token and disconnecting. Keep the token out of chat and MCP arguments, and do not inspect the setup page after the user starts entering a token. Use `hetzner_connection_status` to check whether a credential is stored; it does not validate the token with Hetzner. The packaged `hetzner-cloud-setup` skill contains the setup workflow.

## API workflow

- Cloud tool names start with `cloud_`; Storage Boxes API tool names start with `hetzner_`. Inputs use `path`, `query`, and `body` groups where declared. Inspect the tool's schema rather than guessing payload fields.
- Resolve resource IDs from list/get results and confirm the target project when context is ambiguous. The configured token determines the project.
- List tools return one API page. Follow the response's pagination metadata when the user needs a complete inventory.
- Many mutations return an action. Read the relevant action until it reaches a terminal status before reporting the operation complete; report an API error if it fails.
- Carry out infrastructure changes within the user's request. Clarify an ambiguous target or an unspecified destructive change before issuing that mutation.
- A timed-out or interrupted mutation may have succeeded. Inspect the resource or action before retrying, especially when creating resources. The MCP does not retry requests automatically.

This plugin covers the APIs documented at [docs.hetzner.cloud](https://docs.hetzner.cloud/), including Cloud and Storage Boxes. Robot dedicated-server management, Object Storage's S3 API, and account billing are separate services.
