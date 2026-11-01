# Browser tools

Shared Playwright MCP launcher for projects that opt in. Supports Linux and
macOS with Node.js 22 or newer and npm. No Python dependencies are changed.

## Set up each machine

```sh
git clone https://github.com/tiborh/browser-tools.git
cd browser-tools
npm ci
npm install --global --prefix "$HOME/.local" "$PWD"
```

Add `$HOME/.local/bin` to your shell's `PATH` if necessary, then check:

```sh
browser-tools-mcp --check
npm test
npm run smoke
```

The launcher prefers Chromium or Google Chrome found on the machine. If neither
is available, explicitly download the pinned Playwright Chromium:

```sh
npm run browser:install
```

This downloads a browser to Playwright's local user cache, not this repository.
It does not install system packages. Linux may still need browser system
libraries provisioned separately. No dependency or browser downloads happen
when the launcher starts. Use `npm ci` after updating this checkout, and rerun
the browser install command if the pinned Playwright browser revision changes.

## Opt in a project

Commit this as `.github/mcp.json` in each project that needs browser tools:

```json
{
  "mcpServers": {
    "playwright": {
      "type": "local",
      "command": "browser-tools-mcp",
      "args": [],
      "tools": ["*"]
    }
  }
}
```

Restart Copilot CLI in the trusted project and inspect `/mcp`. The launcher must
be on the `PATH` inherited by Copilot. Do not register it in user-wide MCP
configuration unless you want it available in every project.

The launcher preserves the consuming working directory. Every invocation uses
a separate headless, isolated browser session; login state is not persisted.
Projects without an MCP entry do not use this tooling. This provides agent
browser tools, not a replacement for project-specific automated test dependencies.

## Machine-specific browser selection

The default is `auto`: system browser first, then already-installed managed
Chromium. To choose explicitly:

```sh
BROWSER_TOOLS_BROWSER=managed browser-tools-mcp --check
BROWSER_TOOLS_BROWSER=system browser-tools-mcp --check
BROWSER_TOOLS_EXECUTABLE_PATH=/absolute/path/to/chromium browser-tools-mcp --check
```

An invalid override or unavailable explicit mode fails rather than falling back.
System browsers can be incompatible with the pinned Playwright version; install
and select managed Chromium if real browser checks fail. Selection checks only
executable availability; `npm run smoke` verifies an actual MCP browser session.

Copilot CLI automatically inherits `PATH`, but other environment variables need
to be set in the MCP entry's `env`. For a machine-specific override, put a
`playwright` entry in project-root `.mcp.json`, copy the shared entry, and add,
for example, `"env": {"BROWSER_TOOLS_BROWSER": "managed"}`. Exclude `.mcp.json`
locally using `.git/info/exclude`; it is not automatically untracked. This local
entry overrides the shared server definition. Never commit private paths or
browser profiles.

## Optional submodule arrangement

Instead of a machine-wide launcher link, projects can pin this repository:

```sh
git submodule add https://github.com/tiborh/browser-tools.git tools/browser-tools
npm ci --prefix tools/browser-tools
```

In the parent's MCP entry, use `"command": "node"` and
`"args": ["tools/browser-tools/launch.mjs"]`. Start Copilot from the project root
for this relative path. New clones need `git submodule update --init` and the
dependency installation above. Copilot does not discover nested submodule MCP
configuration automatically.

## Checks and boundaries

`npm test` covers browser selection without launching a browser.
`npm run smoke` starts MCP from a temporary consumer directory, runs a real
browser, and verifies that a screenshot lands in that workspace before cleanup.
Run it with `BROWSER_TOOLS_BROWSER=managed` to exercise downloaded Chromium.

This is a local process, not a hosted browser service. The launcher explicitly
enables Chromium's sandbox and does not expose a network listener. MCP tools can access
pages and workspace files; use trusted projects and normal Copilot permissions.
Dependencies are pinned in `package-lock.json`; review updates before adopting
them. Public availability alone does not grant a software license; no license
has been selected for this repository yet.
