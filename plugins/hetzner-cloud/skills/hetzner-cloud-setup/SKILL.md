---
name: hetzner-cloud-setup
description: Connect, replace, or disconnect the Hetzner Cloud Plugin's project API token through its private local setup page. Use for plugin setup and authentication changes.
---

# Set up Hetzner Cloud

Resolve Node in the task's default local execution environment before changing directories: use `command -v node` in POSIX shells, or `(Get-Command node).Source` in PowerShell. Use the returned absolute executable path and confirm Node.js 22 or newer. If Node is unavailable or too old, ask the user to install or update it; do not search machine-specific runtime locations or add a launcher.

The bundled client is `../../dist/client.mjs` relative to this skill's directory. Resolve its actual installed absolute path. Invoke it from the default working directory using the quoted absolute Node and client paths, followed by `setup`. In PowerShell, put `&` before the quoted executable path.

`setup` opens the user's default browser and starts a detached local session that expires after ten minutes. It returns `{url,expiresAt}` and exits, so the user can complete the page privately. If the session expires, run `setup` again. Explain a browser-launch or credential-store error before retrying.

Tell the user to paste their project API token into the opened page and select **Connect**. They can create a token in [Hetzner Console](https://console.hetzner.com/) under **Project → Security → API Tokens**. The page validates it with a read-only request and stores it in the operating system credential store. It also supports replacing the saved token and disconnecting.

Do not request the API token in chat, pass it to shell commands or client arguments, read the credential store, or inspect the setup page's DOM, screenshots, network requests, or console after token entry starts. Return control to the user while they complete the page.

After the user reports completion, invoke the same client with `status` to check `{connected:boolean}`. This checks credential presence, not current Hetzner validity. If the user asks to verify API access, use `describe cloud_list_servers` and a read-only `call cloud_list_servers` with JSON on stdin.

Credentials stay in macOS Keychain, Windows Credential Manager, or Linux Secret Service. If that store is unavailable or locked, explain the reported error so the user can enable or unlock it. The client does not accept API tokens through environment variables or plaintext files.
