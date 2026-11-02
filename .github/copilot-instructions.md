# Repository instructions

## Commands

Use Node.js 22+ and npm on Linux or macOS. Run commands from this checkout:

```sh
npm ci
npm test
node --test --test-name-pattern='explicit modes' test/browser.test.mjs
npm run check
npm run smoke
```

- `npm test` runs only browser-selection unit tests; no installed browser is needed.
- The `--test-name-pattern` example runs one named unit test. Put Node test-runner options before the test file.
- `npm run check` reports the selected executable and current workspace without launching a browser.
- `npm run smoke` exercises a real MCP browser session, including a screenshot in a temporary consuming workspace. It requires a usable browser.
- To explicitly download the pinned managed Chromium, run `npm run browser:install`. To smoke-test it specifically, run `BROWSER_TOOLS_BROWSER=managed npm run smoke`. Browser installation uses the user's Playwright cache and does not provision Linux system libraries.

CI (`.github/workflows/test.yml`) runs unit tests and a separate managed-Chromium smoke job on Node.js 22. The smoke job explicitly installs Chromium and its Linux system dependencies, then allows user namespaces for that executable via a CI-only AppArmor profile so Chromium's sandbox stays enabled. There is no build or lint script.

## Architecture

This package provides the `browser-tools-mcp` executable for projects that opt in to a shared local Playwright MCP launcher. It is not a hosted service or a replacement for consumers' own browser-test dependencies.

- `browser.mjs` exports `selectBrowser`, separating browser discovery from process startup. Its environment, platform, managed executable path, and executable predicate can be injected for deterministic tests.
- `launch.mjs` handles the CLI, obtains the managed browser path from Playwright, and resolves the installed `@playwright/mcp` CLI relative to this package. It spawns that CLI with the selected executable, inherited stdio, and headless, isolated, sandboxed browser flags.
- The child inherits the caller's working directory; browser artifacts belong to the consuming workspace, not this checkout. The launcher forwards termination signals and propagates child failures.
- `test/browser.test.mjs` tests selection with injected availability and a small real-filesystem check. `test/smoke.test.mjs` launches from a temporary consumer directory and exchanges JSON-RPC messages over stdio to verify initialization, navigation, evaluation, screenshots, and browser cleanup.

## Repository-specific conventions

- Keep the code as native JavaScript ES modules (`.mjs`), using `node:` built-ins and the built-in `node:test` / `node:assert/strict` test stack.
- Default browser selection is `auto`: search system Chromium/Chrome first, then already-installed managed Chromium. Only absolute `PATH` entries participate; macOS application locations are also checked.
- `BROWSER_TOOLS_BROWSER=system` or `managed` must fail when that source is unavailable rather than silently falling back. `BROWSER_TOOLS_EXECUTABLE_PATH` must be an absolute executable file, takes precedence over discovery, and conflicts with managed mode.
- Selection checks executable availability, not browser compatibility. Keep `--check` lightweight; use the smoke test for actual browser compatibility.
- Startup must not install dependencies, download browsers, change Python dependencies, expose a network listener, or persist login state. Preserve explicit sandboxing and per-invocation isolated sessions.
- Dependencies are pinned in `package.json` and `package-lock.json`. When updating Playwright, account for the managed browser revision and the explicit browser-install step.
- Consumers opt in with a project-level `.github/mcp.json` entry invoking `browser-tools-mcp`; do not introduce user-wide registration by default. A submodule consumer can instead invoke `node tools/browser-tools/launch.mjs` from its project root.
- Machine-specific MCP overrides belong in the consumer's project-root `.mcp.json`, excluded locally via `.git/info/exclude`. Do not commit private executable paths or browser profiles. Non-`PATH` environment overrides must be set in the MCP entry's `env`.
- Keep launcher diagnostics on stderr with the `browser-tools:` prefix so normal MCP stdout remains available for protocol traffic.
