# Security policy

## Supported versions

Security fixes are maintained on the default branch (`main`). Use the latest
checkout and run `npm ci` to install its pinned dependencies.

## Reporting a vulnerability

Report suspected vulnerabilities privately through
[GitHub's vulnerability reporting form](https://github.com/tiborh/browser-tools/security/advisories/new).
Do not disclose vulnerabilities in public issues or pull requests before
coordinating a fix.

Include the affected commit, operating system, Node.js version, browser version
and selection mode (`auto`, `system`, `managed`, or an executable override), and
minimal reproduction steps. Describe the impact and whether the issue affects
browser selection, MCP process startup, workspace access, or browser isolation.
Remove credentials, private paths, browser profiles, and other sensitive data
from reproductions and logs.
