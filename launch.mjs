#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { chromium } from 'playwright';
import { selectBrowser } from './browser.mjs';

const args = process.argv.slice(2);
try {
  if (args.length > 1 || (args.length === 1 && !['--check', '--help'].includes(args[0]))) {
    throw new Error('Usage: browser-tools-mcp [--check | --help]');
  }
  if (args[0] === '--help') {
    console.log('Usage: browser-tools-mcp [--check | --help]\n'
      + 'Starts headless, isolated Playwright MCP in the current project.\n'
      + 'BROWSER_TOOLS_BROWSER: auto (default), system, or managed.\n'
      + 'BROWSER_TOOLS_EXECUTABLE_PATH: optional absolute browser path.');
  } else {
    const browser = selectBrowser({ managedPath: chromium.executablePath() });
    if (args[0] === '--check') {
      console.log(JSON.stringify({ ...browser, workspace: process.cwd() }, null, 2));
    } else {
      const require = createRequire(import.meta.url);
      const cli = path.join(path.dirname(require.resolve('@playwright/mcp/package.json')), 'cli.js');
      const child = spawn(process.execPath, [
        cli, '--headless', '--isolated', '--sandbox', '--executable-path', browser.executablePath,
      ], { stdio: 'inherit' });
      for (const signal of ['SIGINT', 'SIGTERM']) {
        process.on(signal, () => child.kill(signal));
      }
      child.on('error', error => {
        console.error(`browser-tools: ${error.message}`);
        process.exitCode = 1;
      });
      child.on('exit', (code, signal) => {
        if (code !== 0 || signal) {
          console.error(`browser-tools: MCP exited (${signal || code}). `
            + 'If system Chromium is incompatible, install and select the managed browser.');
        }
        process.exitCode = code ?? 1;
      });
    }
  }
} catch (error) {
  console.error(`browser-tools: ${error.message}`);
  process.exitCode = 1;
}
