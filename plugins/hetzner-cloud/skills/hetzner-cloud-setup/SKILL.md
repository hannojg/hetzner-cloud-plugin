---
name: hetzner-cloud-setup
description: Connect, replace, or disconnect the Hetzner Cloud Plugin's project API token through its private local setup page. Use for plugin setup and authentication changes.
---

# Set up Hetzner Cloud

Call `hetzner_configure` with `{}` to create a temporary local setup session and open it in the user's default browser. The tool returns the local URL and expiry. If the session has expired, call the tool again. If browser launch fails, explain the reported error so the user can fix it before retrying.

Tell the user to paste their project API token into the opened setup page and select **Connect**. They can create a token in [Hetzner Console](https://console.hetzner.com/) under **Project → Security → API Tokens**. The page validates the token with a read-only request and stores it in the operating system credential store. It also lets the user replace the saved token or disconnect. The local session expires after ten minutes.

The user completes token entry privately. Do not request the token in chat, collect it with an MCP elicitation form or tool argument, or inspect the page's DOM, screenshots, network requests, or console after the user starts entering it. Return control to the user while they complete the page.

After the user reports completion, call `hetzner_connection_status` with `{}` to check the stored connection. Report only its connection status. This tool checks credential presence, not current Hetzner validity. If the user asks to verify API access, make a read-only inventory call.

Credentials stay in macOS Keychain, Windows Credential Manager, or Linux Secret Service. If that store is unavailable or locked, explain the reported error so the user can enable or unlock it. The plugin does not accept environment-variable or plaintext-file credentials.
