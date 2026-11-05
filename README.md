# Hetzner Cloud Plugin

A Codex plugin with a local MCP server that mirrors the official [Hetzner Cloud and Storage Boxes APIs](https://docs.hetzner.cloud/).

The plugin exposes **222 generated API tools**. It covers servers and their actions, volumes, networks, floating and primary IPs, firewalls, load balancers, DNS, certificates, images, SSH keys, placement groups, pricing, locations, and Storage Boxes. Every operation in the checked-in API snapshots becomes a tool with its own input schema.

This is an independent community project, not an official Hetzner product. Robot, the Object Storage S3 API, and account billing are outside these APIs.

## Requirements

- Codex with local plugin support.
- Node.js 22 or newer on the PATH used by Codex.
- A Hetzner project API token. Use read/write permissions to manage resources; a read-only token can inspect resources.

The committed plugin includes its built MCP server and dependencies. Installing the plugin does not require building it or installing npm packages.

## Connect your Hetzner project

Create an API token in [Hetzner Console](https://console.hetzner.com/), under your project's **Security → API Tokens**. Hetzner uses project-scoped bearer tokens for these APIs; there is no account-wide OAuth login. The same configured token is sent directly to the official API selected by each operation.

Set `HETZNER_API_TOKEN` in the environment that launches Codex. The token is never part of a tool's input or the plugin manifest.

### macOS desktop app

In Terminal's default zsh, enter the token without displaying it:

```sh
read -rs 'HETZNER_API_TOKEN?Hetzner API token: '
echo
export HETZNER_API_TOKEN
launchctl setenv HETZNER_API_TOKEN "$HETZNER_API_TOKEN"
unset HETZNER_API_TOKEN
```

Fully quit and reopen Codex so its MCP server inherits the new environment. The launch environment lasts until logout or restart; repeat this setup afterward. To remove it, run `launchctl unsetenv HETZNER_API_TOKEN`, then restart Codex.

### Codex launched from a terminal

Set the token in the shell that starts Codex. For zsh:

```sh
read -rs 'HETZNER_API_TOKEN?Hetzner API token: '
echo
export HETZNER_API_TOKEN
codex
```

The plugin forwards `HETZNER_API_TOKEN` from Codex to the local MCP process. To use another project, change that token and restart Codex. Do not put the token in this repository, a prompt, or `.mcp.json`.

## Install

Register this repository's marketplace and install its plugin:

```sh
codex plugin marketplace add hannojg/hetzner-cloud-plugin --ref main
codex plugin add hetzner-cloud@hetzner-cloud
```

Open a new chat after installation. You can also add the GitHub repository as a marketplace in Codex's plugin settings, then install **Hetzner Cloud Plugin**.

Try an inventory request such as:

> List my Hetzner servers and their status.

Or:

> Show the firewall rules in this project.

To update the installed marketplace:

```sh
codex plugin marketplace upgrade hetzner-cloud
```

Restart Codex after updating.

## API behavior

- Cloud tools are named `cloud_<operationId>`; Storage Boxes API tools are named `hetzner_<operationId>`.
- Inputs use `path`, `query`, and `body` groups where declared by the API operation. The tool schema documents their fields.
- Each tool makes one API request. List results preserve Hetzner's pagination metadata; follow subsequent pages for a complete inventory.
- Requests use the official API endpoint for their operation and the configured project's bearer token.
- Resource changes may return asynchronous actions. Check their status before treating the change as finished.
- The server uses a 30-second request timeout and does not retry mutations automatically. Check the resource or action before retrying a request whose result is uncertain.
- Errors preserve upstream JSON and rate-limit details. Permissions and project boundaries are enforced by Hetzner.
- Creating or resizing resources can incur charges; deletions and other mutations have the same effects as the underlying API calls.

The MCP can start and list its tools without a token. An API call requires `HETZNER_API_TOKEN`. It runs locally and sends requests directly to Hetzner; this project has no hosted proxy, credential service, or telemetry endpoint.

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

Commit the updated catalog and plugin bundle with the source changes. `npm run check` checks TypeScript, generated-file consistency, the bundled server, and tests. Tests use controlled responses; they do not create or alter Hetzner resources. A real account check requires a project token and an explicitly chosen read-only API call.

With the Codex CLI on your PATH, verify installation and tool discovery in an isolated temporary Codex profile:

```sh
node scripts/check-host.mjs
```

This check installs the local package into that temporary profile and asks the real Codex host to load every generated MCP tool. It removes the profile afterward and does not use credentials or change your installed plugins. Set `CODEX_CLI_PATH` if the CLI is elsewhere.

To install the local checkout:

```sh
codex plugin marketplace add .
codex plugin add hetzner-cloud@hetzner-cloud
```

The marketplace points to `plugins/hetzner-cloud`. The plugin's `.mcp.json` runs the committed `dist/server.mjs` from that directory, so an installed copy works independently of the source checkout.

## License

[MIT](LICENSE). Hetzner's API schemas and documentation retain their respective upstream rights.
