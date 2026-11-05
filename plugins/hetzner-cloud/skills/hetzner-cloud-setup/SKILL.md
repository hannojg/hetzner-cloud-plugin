---
name: hetzner-cloud-setup
description: Add, replace, or disconnect named Hetzner project API tokens through the plugin's private local setup page. Use for plugin setup and project authentication changes.
---

# Set up Hetzner Cloud

Resolve Node in the task's default local execution environment before changing directories: use `command -v node` in POSIX shells, or `(Get-Command node).Source` in PowerShell. Use the returned absolute executable path and confirm Node.js 22 or newer. If Node is unavailable or too old, ask the user to install or update it; do not search machine-specific runtime locations or add a launcher.

The bundled client is `../../dist/client.mjs` relative to this skill's directory. Resolve its actual installed absolute path. Invoke it from the default working directory using the quoted absolute Node and client paths, followed by `setup`. In PowerShell, put `&` before the quoted executable path.

`setup` opens the user's default browser and starts a detached local session that expires after ten minutes. It returns `{url,expiresAt}` and exits, so the user can complete the page privately. If the session expires, run `setup` again. Explain a browser-launch or credential-store error before retrying.

Tell the user to enter a local project name, paste that project's API token into the opened page, and select **Connect**. New setup starts with `Default`; an existing saved project may be preselected. Names such as `Production` or `Staging` are local aliases, not automatic Hetzner project discovery. They can create a token in [Hetzner Console](https://console.hetzner.com/) under **Project → Security → API Tokens**. The page validates the token with a read-only request and stores it independently for that alias in the operating system credential store. Selecting a saved project lets the user replace its token or disconnect that project. An existing token from earlier plugin versions appears as `Default`.

Do not request the API token in chat, pass it to shell commands or client arguments, read the credential store, or inspect the setup page's DOM, screenshots, network requests, or console after token entry starts. Return control to the user while they complete the page.

After the user reports completion, invoke the same client with `projects` or `status` to check the saved project names and connection state. `status --project "<name>"` checks a specific alias. These commands inspect local configuration, not current Hetzner validity.

If the user asks to verify API access, use the sole saved project automatically. If multiple projects are saved, ask which one to use before making an API request unless the user has already selected one unambiguously for the current task. Run `describe cloud_list_servers`, then a read-only `call cloud_list_servers --project "<exact saved name>"` with JSON on stdin. Include `--project` on every API call when multiple projects are saved; the choice applies to the current task only.

Credentials stay in macOS Keychain, Windows Credential Manager, or Linux Secret Service. If that store is unavailable or locked, explain the reported error so the user can enable or unlock it. The client does not accept API tokens through environment variables or plaintext files.
