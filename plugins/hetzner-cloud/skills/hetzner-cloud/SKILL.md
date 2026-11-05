---
name: hetzner-cloud
description: Manage Hetzner Cloud infrastructure and Storage Boxes with the plugin's MCP tools. Use for project resources, resource actions, and API-backed infrastructure changes.
---

# Hetzner Cloud

Use the plugin's generated MCP tools to work with Hetzner Cloud and Storage Boxes. Each tool mirrors one documented API operation; follow its input schema and preserve the API's response fields.

## Authentication

The MCP reads `HETZNER_API_TOKEN` from its process environment and sends the token directly to Hetzner. Tokens belong to a project and have read-only or read/write permissions. Hetzner Cloud does not provide an account-wide OAuth sign-in for these APIs.

If authentication is missing, direct the user to create a token under the project's **Security → API Tokens** in [Hetzner Console](https://console.hetzner.com/) and configure `HETZNER_API_TOKEN` in the environment that launches Codex. For the macOS desktop app, set it with `launchctl setenv` in Terminal, then fully quit and reopen Codex. Keep the token out of chat, tool arguments, and committed files. Changing the environment requires restarting the MCP connection.

## API workflow

- Cloud tool names start with `cloud_`; Storage Boxes API tool names start with `hetzner_`. Inputs use `path`, `query`, and `body` groups where declared. Inspect the tool's schema rather than guessing payload fields.
- Resolve resource IDs from list/get results and confirm the target project when context is ambiguous. The configured token determines the project.
- List tools return one API page. Follow the response's pagination metadata when the user needs a complete inventory.
- Many mutations return an action. Read the relevant action until it reaches a terminal status before reporting the operation complete; report an API error if it fails.
- Carry out infrastructure changes within the user's request. Clarify an ambiguous target or an unspecified destructive change before issuing that mutation.
- A timed-out or interrupted mutation may have succeeded. Inspect the resource or action before retrying, especially when creating resources. The MCP does not retry requests automatically.

This plugin covers the APIs documented at [docs.hetzner.cloud](https://docs.hetzner.cloud/), including Cloud and Storage Boxes. Robot dedicated-server management, Object Storage's S3 API, and account billing are separate services.
