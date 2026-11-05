---
name: hetzner-cloud
description: Manage Hetzner Cloud infrastructure and Storage Boxes through the plugin's local direct API client. Use for project resources, resource actions, and infrastructure changes.
---

# Hetzner Cloud

Use the bundled local client for the 222 operations in the official Hetzner API snapshots. Each invocation sends requests directly from this computer to Hetzner.

## Resolve the client

Resolve Node in the task's default local execution environment before changing directories: use `command -v node` in POSIX shells, or `(Get-Command node).Source` in PowerShell. Use the returned absolute executable path for every client invocation and verify Node.js 22 or newer. If Node is unavailable or too old, tell the user to install or update Node.js; do not search machine-specific runtime locations or introduce another launcher.

The client is `../../dist/client.mjs` relative to this skill's directory. Resolve that to the actual installed plugin's absolute path. Keep commands in the default working directory and pass both the Node executable and client file as quoted absolute paths. PowerShell requires its `&` call operator before the quoted executable path.

## Discover and call an operation

1. Run the client with `list <search>` to find operations by resource or action. Cloud names start with `cloud_`; Storage Boxes names start with `hetzner_`.
2. Run `describe <operation>` for its input schema. Inputs use `path`, `query`, and `body` groups where declared. Use the operation's schema rather than guessing fields.
3. Run `call <operation>` and provide the JSON input on stdin. Use a quoted heredoc delimiter so shell expansion cannot change user data:

```sh
"/absolute/path/to/node" "/actual/plugin/root/dist/client.mjs" call cloud_list_servers <<'JSON'
{"query":{"per_page":50}}
JSON
```

In PowerShell, pipe a literal single-quoted here-string (`@'` … `'@`) into the client invocation instead. Keep JSON values literal in either shell.

The client prints `{status,data,rateLimit}` or an error envelope and exits with status 1 for failures. Preserve Hetzner's response fields when interpreting results.

## Connection

The client retrieves the project API token from the operating system credential store. Run `status` to check whether one is stored; this does not contact Hetzner or verify current token validity.

If setup is needed, run `setup`. It opens a private local browser page in a detached process and returns its URL and expiry. Let the user enter the token privately, then return control to them. Do not read the credential store or inspect that page after token entry starts. Run `status` after the user reports completion. The packaged `hetzner-cloud-setup` skill explains the complete connection workflow.

## Resource workflow

- Resolve resource IDs from list/get results and clarify an ambiguous target. The saved token determines the project and its read-only or read/write permissions.
- List operations return one API page. Follow `meta.pagination` for a complete inventory.
- Mutations may return asynchronous actions. Check the relevant action until it reaches `success` or `error` before reporting completion.
- Carry out changes within the user's request. Creating or resizing resources can incur charges, and deletion can destroy data. Clarify unspecified destructive changes before issuing them.
- The client makes one request per call and does not retry automatically. A timed-out mutation may have succeeded; inspect the resource or action before repeating it.

Cloud and Storage Boxes are covered. Robot dedicated servers, Object Storage's S3 API, and account billing are separate APIs.
