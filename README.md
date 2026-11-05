# Hetzner Cloud Plugin

A Codex plugin with a local MCP server that mirrors the official [Hetzner Cloud and Storage Boxes APIs](https://docs.hetzner.cloud/).

The plugin exposes **222 generated API tools** plus **2 connection tools**. It covers servers and their actions, volumes, networks, floating and primary IPs, firewalls, load balancers, DNS, certificates, images, SSH keys, placement groups, pricing, locations, and Storage Boxes. Every operation in the checked-in API snapshots becomes a tool with its own input schema.

This is an independent community project, not an official Hetzner product. Robot, the Object Storage S3 API, and account billing are outside these APIs.

## Requirements

- Codex with local plugin support and a browser on the same computer.
- Node.js 22 or newer on the PATH used by Codex.
- An available operating system credential store: macOS Keychain, Windows Credential Manager, or Linux Secret Service.
- A Hetzner project API token. Use read/write permissions to manage resources; a read-only token can inspect resources.

The committed plugin includes its built MCP server and dependencies. Installing the plugin does not require building it or installing npm packages.

## Install

Register this repository's marketplace and install its plugin:

```sh
codex plugin marketplace add hannojg/hetzner-cloud-plugin --ref main
codex plugin add hetzner-cloud@hetzner-cloud
```

You can also add the GitHub repository as a marketplace in Codex's plugin settings, then install **Hetzner Cloud Plugin**. Open a new chat after installation.

## Connect your Hetzner project

1. Open the installed plugin and select **Setup**. Its packaged onboarding skill opens a private setup page in your browser.
2. Create an API token in [Hetzner Console](https://console.hetzner.com/), under your project's **Security → API Tokens**.
3. Paste the token into the setup page and select **Connect**.

The page checks the token with a read-only server-list request, then saves it in your operating system credential store. The connection survives Codex and computer restarts. To use another project, run setup again and replace the saved token. The page also has a **Disconnect** action to delete the saved credential.

You can start the same flow from chat:

> Set up my Hetzner Cloud Plugin connection.

The setup page runs on `127.0.0.1` on your own computer and opens in your default browser. Its temporary session expires after ten minutes. Enter the token only on that page. The token is submitted directly to the local setup server; it is never an MCP tool argument or tool response. Codex receives the setup URL and connection status. The local server sends your token to Hetzner to validate it and authenticate API requests.

On macOS the credential is stored in Keychain, on Windows in Credential Manager, and on Linux in Secret Service. The store must be available and unlocked. The plugin reports store errors instead of saving credentials in a plaintext file. Environment-variable credentials are no longer supported.

If you previously set the token through `launchctl` for version 0.1.0, remove that session-wide value:

```sh
launchctl unsetenv HETZNER_API_TOKEN
```

Fully quit and reopen Codex to remove that old value from its process environment, then complete **Setup**.

Try an inventory request such as:

> List my Hetzner servers and their status.

Or:

> Show the firewall rules in this project.

To update the marketplace and install its current plugin version:

```sh
codex plugin marketplace upgrade hetzner-cloud
codex plugin add hetzner-cloud@hetzner-cloud
```

Restart Codex after updating. Version 0.2.0 uses the setup page and operating system credential store; users upgrading from 0.1.0 must connect through **Setup** once.

## Connection tools

- `hetzner_configure` takes `{}` and opens a temporary local setup page in your default browser for connecting, replacing the token, or disconnecting. It returns the URL and its expiry. Its input never contains a token. If the browser cannot be opened, the tool reports the error and closes that setup session.
- `hetzner_connection_status` takes `{}` and reports whether a credential is stored. It does not make a Hetzner request or verify that the saved token is still valid.

Hetzner uses project-scoped bearer tokens for these APIs. The saved token determines the project and its read-only or read/write permissions. API calls go directly to the official API selected by each operation.

## API behavior

- Cloud tools are named `cloud_<operationId>`; Storage Boxes API tools are named `hetzner_<operationId>`.
- Inputs use `path`, `query`, and `body` groups where declared by the API operation. The tool schema documents their fields.
- Each tool makes one API request. List results preserve Hetzner's pagination metadata; follow subsequent pages for a complete inventory.
- Requests use the official API endpoint for their operation and the configured project's bearer token.
- Resource changes may return asynchronous actions. Check their status before treating the change as finished.
- The server uses a 30-second request timeout and does not retry mutations automatically. Check the resource or action before retrying a request whose result is uncertain.
- Errors preserve upstream JSON and rate-limit details. Permissions and project boundaries are enforced by Hetzner.
- Creating or resizing resources can incur charges; deletions and other mutations have the same effects as the underlying API calls.

The MCP can start and list its tools before a project is connected. API operations retrieve the token from the operating system credential store. The plugin runs locally and sends requests directly to Hetzner; this project has no hosted proxy, credential service, or telemetry endpoint.

## Development

```sh
git clone https://github.com/hannojg/hetzner-cloud-plugin.git
cd hetzner-cloud-plugin
npm ci
npm run check
```

API snapshots live in `spec/cloud.spec.json` and `spec/hetzner.spec.json`. [Snapshot provenance](spec/README.md) records their official URLs and checksums. The [API coverage reference](docs/api-coverage.md) lists every generated tool, endpoint, and deprecation. After updating the snapshots, regenerate the catalog and bundle:

```sh
npm run generate
npm run build
npm run check
```

Commit the updated catalog and plugin bundle with the source changes. `npm run check` checks TypeScript, generated-file consistency, the bundled server, and tests. Tests use controlled responses and injected credential stores; they do not create or alter Hetzner resources. A real account check requires completing setup and choosing a read-only API call.

With the Codex CLI on your PATH, verify installation and tool discovery in an isolated temporary Codex profile:

```sh
node scripts/check-host.mjs
```

This check installs the local package into that temporary profile and asks the real Codex host to load all 224 MCP tools. It checks the packaged onboarding skill and credential-free launch configuration, then removes the profile. It does not read the credential store or change your installed plugins. Set `CODEX_CLI_PATH` if the CLI is elsewhere.

To install the local checkout:

```sh
codex plugin marketplace add .
codex plugin add hetzner-cloud@hetzner-cloud
```

The marketplace points to `plugins/hetzner-cloud`. The plugin's `.mcp.json` runs the committed `dist/server.mjs` from that directory, so an installed copy works independently of the source checkout.

## License

[MIT](LICENSE). Hetzner's API schemas and documentation retain their respective upstream rights.
