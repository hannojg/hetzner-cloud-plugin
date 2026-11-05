# Hetzner Cloud Plugin

A Codex plugin that manages [Hetzner Cloud and Storage Boxes](https://docs.hetzner.cloud/) through skills and a local API client. Requests go directly from your computer to Hetzner.

The client covers **all 222 operations** in the checked-in official API specifications: servers and their actions, volumes, networks, floating and primary IPs, firewalls, load balancers, DNS, certificates, images, SSH keys, placement groups, pricing, locations, and Storage Boxes.

This is an independent community project. Robot dedicated servers, Object Storage's S3 API, and account billing are separate APIs.

## Requirements

- Codex with local plugin support and a browser on the same computer.
- Node.js 22 or newer on the local shell's PATH. POSIX shells and Windows PowerShell are supported.
- An available operating system credential store: macOS Keychain, Windows Credential Manager, or Linux Secret Service.
- A Hetzner API token for each project you want to use. A read-only token can inspect resources; read/write permissions allow changes.

The plugin includes its built client and dependencies. Users can install the package directly without building it or running `npm install`.

## Install

Add this repository's marketplace and install its plugin:

```sh
codex plugin marketplace add hannojg/hetzner-cloud-plugin --ref main
codex plugin add hetzner-cloud@hetzner-cloud
```

You can also add the repository as a marketplace in Codex's plugin settings, then install **Hetzner Cloud Plugin**. Start a new chat after installation so its skills are available.

## Connect your projects

1. Select **Setup** on the installed plugin, or ask Codex: **“Set up my Hetzner Cloud Plugin connection.”**
2. The setup skill opens a private local page in your default browser.
3. Enter a local project name, such as `Production` or `Staging`, or choose a saved project. New setup starts with `Default`; a saved project is preselected when available.
4. Create an API token in [Hetzner Console](https://console.hetzner.com/) under **Project → Security → API Tokens**, paste it into that page, and select **Connect**.

The page validates the token with a read-only request, then stores it independently for that project name in your operating system credential store. Connections survive Codex and computer restarts. Run setup again to add another project. Select a saved project to replace its token or use **Disconnect** to delete that project's credential.

Project names are local aliases for your saved tokens. The local registry stores project-name metadata; API tokens remain in the operating system credential store. Names are not discovered automatically from your Hetzner account. An existing token from an earlier plugin version appears as `Default`.

The setup page runs on `127.0.0.1` on your own computer for up to ten minutes. Its process runs independently while you enter the token. Enter it only in that page: the token stays out of chat and command arguments. The local client retrieves it from the credential store when making API requests.

On macOS the credential is stored in Keychain, on Windows in Credential Manager, and on Linux in Secret Service. The store must be available and unlocked. Credential-store errors are reported to the user; environment-variable and plaintext-file credentials are unsupported.

If you used `launchctl` to set the token for version 0.1.0, remove that session-wide value, fully quit and reopen Codex, then complete **Setup**:

```sh
launchctl unsetenv HETZNER_API_TOKEN
```

## Use from Codex

Choose the **Hetzner Cloud Plugin** or invoke its `hetzner-cloud` skill, then describe the task:

> List my Hetzner servers and their status.

> Show the firewall rules in this project.

> List my Storage Boxes and their usage.

Codex first checks which projects are saved. With one project, it uses that project automatically. With several projects, it asks which one to use before making API requests unless you have already selected one for the task. You can name it directly:

> List my servers in Production.

Codex then discovers operations and their schemas through the bundled client and runs them locally with the selected project's token. The choice applies to the current task; there is no globally selected project when several are saved. Resource access and permissions are enforced by Hetzner.

This is a **skill-only plugin**. It does not register an MCP server or require a hosted service. A short-lived local server exists only while the setup page is open.

## Local client

The installed plugin's client is `plugins/hetzner-cloud/dist/client.mjs` in this repository. Run it with Node.js 22 or newer. Codex resolves Node in its default local command environment with `command -v node` in POSIX shells or `(Get-Command node).Source` in PowerShell, then uses the returned absolute executable path and the installed client's absolute path for subsequent commands. PowerShell uses its `&` call operator to invoke a quoted executable path.

| Command | Purpose |
| --- | --- |
| `list [search]` | List operation names and summaries, optionally filtered. |
| `describe <operation>` | Show the operation's path, query, and body schema. |
| `call <operation> [--project <name>]` | Read JSON arguments from stdin and make one API request using the named project's token. |
| `projects` | List saved local project names: `{projects:string[]}`. |
| `status` | Return `{projects:string[],connected:boolean}`; `connected` means at least one project is saved. |
| `status --project <name>` | Return the saved names plus `project` and that project's `connected` state. |
| `setup` | Open private token setup; return `{url,expiresAt}` and exit. |

Cloud operation names start with `cloud_`; Storage Boxes names start with `hetzner_`. Inputs use `path`, `query`, and `body` groups where declared in the API schema. For a saved project named `Production`, after resolving the actual absolute paths:

```sh
"/absolute/path/to/node" "/actual/plugin/root/dist/client.mjs" call cloud_list_servers --project "Production" <<'JSON'
{"query":{"per_page":50}}
JSON
```

The quoted heredoc keeps the shell from expanding JSON values. In PowerShell, pipe a literal single-quoted here-string (`@'` … `'@`) into the client invocation. API tokens are never supplied through this command. `call` prints the selected `project` alongside the upstream `status`, `data`, and rate-limit details, or an error; failures exit with status 1. `projects` and `status` inspect local configuration without contacting Hetzner or verifying token validity.

When exactly one project is saved, `call` can omit `--project`. With several projects, omitting it returns `project_required` and the saved names without making an API request. With no saved project, it returns `not_connected`; an explicit unknown name returns `project_not_found`. Pass the selected project on every API call, including later pages and asynchronous action checks.

## API behavior

- Each operation sends one request to the official API selected by that operation.
- List results preserve pagination metadata. Follow `meta.pagination` for a complete inventory.
- Resource changes may return asynchronous actions. Check their status before treating the change as finished.
- The client uses a 30-second request timeout and does not retry automatically. Inspect the resource or action before repeating an interrupted mutation.
- Creating or resizing resources can incur charges; deletions and other mutations have the same effects as the underlying API calls.
- Deprecated operations retain the official warnings. The [API coverage reference](docs/api-coverage.md) lists every operation and endpoint.

## Update

```sh
codex plugin marketplace upgrade hetzner-cloud
codex plugin add hetzner-cloud@hetzner-cloud
```

Restart Codex and start a new chat after updating. Version 0.4.0 adds independent named project connections while retaining the skill-only local client and private setup flow. Your existing saved token is available as `Default`.

## Development

```sh
git clone https://github.com/hannojg/hetzner-cloud-plugin.git
cd hetzner-cloud-plugin
npm ci
npm run check
```

The API snapshots in `spec/cloud.spec.json` and `spec/hetzner.spec.json` are the source of truth. [Snapshot provenance](spec/README.md) records the official URLs and checksums. After updating them, regenerate the catalog and bundle:

```sh
npm run generate
npm run build
npm run check
```

Commit the catalog and client bundle with the source changes. Checks cover TypeScript, generated-file consistency, the standalone client, and API/setup behavior with controlled responses and injected credential stores. They do not create or alter Hetzner resources. A real account check requires completing setup and choosing a read-only API operation.

To install the local checkout:

```sh
codex plugin marketplace add .
codex plugin add hetzner-cloud@hetzner-cloud
```

The marketplace points to `plugins/hetzner-cloud`. The installed package includes `dist/client.mjs`, its required assets, and both skills.

## License

[MIT](LICENSE). Hetzner's API schemas and documentation retain their respective upstream rights.
