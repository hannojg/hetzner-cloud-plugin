---
name: hetzner-cloud
description: Manage Hetzner Cloud infrastructure and Storage Boxes across saved projects through the plugin's local direct API client. Use for project resources, resource actions, and infrastructure changes.
---

# Hetzner Cloud

Use the bundled local client for the 222 operations in the official Hetzner API snapshots. Each invocation sends requests directly from this computer to Hetzner.

## Resolve the client

Resolve Node in the task's default local execution environment before changing directories: use `command -v node` in POSIX shells, or `(Get-Command node).Source` in PowerShell. Use the returned absolute executable path for every client invocation and verify Node.js 22 or newer. If Node is unavailable or too old, tell the user to install or update Node.js; do not search machine-specific runtime locations or introduce another launcher.

The client is `../../dist/client.mjs` relative to this skill's directory. Resolve that to the actual installed plugin's absolute path. Keep commands in the default working directory and pass both the Node executable and client file as quoted absolute paths. PowerShell requires its `&` call operator before the quoted executable path.

## Choose the project before API requests

Run `projects` or `status` before starting an API task. The returned project names are local aliases for saved tokens, not projects discovered through a Hetzner account.

- With no saved project, run the private setup workflow and wait for the user to complete it.
- With one saved project, use it automatically.
- With multiple projects, ask the user which project to use before making any API request, unless they have already selected a saved project unambiguously for the current task. Do not infer a project from resource names or silently choose `Default`.

For work with multiple saved projects, pass `--project "<exact saved name>"` on **every** `call`, including pagination and action-status checks. Reuse the user's explicit choice for the current task, not as a global selection for later tasks. If the user explicitly requests several or all projects, run the corresponding calls separately with each selected name.

## Discover and call an operation

1. Run the client with `list <search>` to find operations by resource or action. Cloud names start with `cloud_`; Storage Boxes names start with `hetzner_`.
2. Run `describe <operation>` for its input schema. Inputs use `path`, `query`, and `body` groups where declared. Use the operation's schema rather than guessing fields.
3. Run `call <operation>` with the chosen `--project` argument and provide the JSON input on stdin. The flag is optional only when there is exactly one saved project. Use a quoted heredoc delimiter so shell expansion cannot change user data. For a saved project named `Production`:

```sh
"/absolute/path/to/node" "/actual/plugin/root/dist/client.mjs" call cloud_list_servers --project "Production" <<'JSON'
{"query":{"per_page":50}}
JSON
```

In PowerShell, pipe a literal single-quoted here-string (`@'` … `'@`) into the client invocation instead. Keep JSON values literal in either shell.

The client prints `{project,status,data,rateLimit}` or an error envelope and exits with status 1 for failures. Keep the returned project context visible when reporting results and preserve Hetzner's response fields.

## Connection

The client retrieves each project's API token from the operating system credential store. `projects` returns `{projects:string[]}`. `status` returns the saved names and whether any project is configured; `status --project "<name>"` reports that named project's connection. These commands inspect local configuration without contacting Hetzner or verifying current token validity.

If setup is needed, run `setup`. It opens a private local browser page in a detached process and returns its URL and expiry. The user enters a local project name and token there, or selects an existing project to replace its token or disconnect it. Let them complete the page privately, then return control to them. Do not read the credential store or inspect that page after token entry starts. Run `projects` or `status` after the user reports completion. The packaged `hetzner-cloud-setup` skill explains the complete connection workflow.

## Resource workflow

- Resolve resource IDs from list/get results within the selected project and clarify an ambiguous target. Its saved token determines the Hetzner project and read-only or read/write permissions.
- List operations return one API page. Follow `meta.pagination` for a complete inventory.
- Mutations may return asynchronous actions. Check the relevant action until it reaches `success` or `error` before reporting completion.
- Carry out changes within the user's request. Creating or resizing resources can incur charges, and deletion can destroy data. Clarify unspecified destructive changes before issuing them.
- The client makes one request per call and does not retry automatically. A timed-out mutation may have succeeded; inspect the resource or action before repeating it.

Cloud and Storage Boxes are covered. Robot dedicated servers, Object Storage's S3 API, and account billing are separate APIs.
