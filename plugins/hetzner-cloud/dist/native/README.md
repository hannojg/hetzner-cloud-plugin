# Native credential storage

The plugin bundles the published native binaries from [@napi-rs/keyring](https://github.com/Brooooooklyn/keyring-node), version 2.1.2.
No native package is downloaded when the plugin starts.

Supported targets: darwin-arm64, darwin-x64, win32-arm64-msvc, win32-x64-msvc, linux-arm64-gnu, linux-arm64-musl, linux-x64-gnu, linux-x64-musl.
macOS uses Keychain, Windows uses Credential Manager, and Linux requires a running Secret Service such as GNOME Keyring or KWallet.
Linux entries are explicitly pinned to Secret Service; the kernel keyring is not used.
Other operating systems and architectures are unsupported and produce an explicit error when credential storage is used.

Native loading and credential access are lazy. Listing API operations never opens a credential store.
The loader selects exactly one binary from the current OS, architecture, and Node.js libc report.

manifest.json records the npm source URL, npm integrity, and SHA-256 of each committed binary and license.
The upstream MIT license is in LICENSE.keyring; complete platform-specific dependency notices are in licenses/.
Linux notices include the statically linked libdbus license.

Maintainers can regenerate these assets with node scripts/vendor-keyring.mjs.
node scripts/vendor-keyring.mjs --check verifies the committed assets without network access and runs as part of every build.
