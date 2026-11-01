import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('MCP runs a real browser in the consuming workspace', { timeout: 60000 }, async t => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'browser-tools-smoke-'));
  const child = spawn(process.execPath, [
    fileURLToPath(new URL('../launch.mjs', import.meta.url)),
  ], { cwd: workspace, stdio: ['pipe', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
  const pending = new Map();
  let nextId = 0;
  let exitError;
  const exited = new Promise(resolve => {
    child.on('exit', (code, signal) => {
      exitError = new Error(`MCP exited: ${signal || code}\n${stderr}`);
      for (const { reject } of pending.values()) reject(exitError);
      pending.clear();
      resolve();
    });
  });
  child.on('error', error => {
    exitError = error;
    for (const { reject } of pending.values()) reject(error);
    pending.clear();
  });
  const lines = createInterface({ input: child.stdout });
  lines.on('line', line => {
    let message;
    try {
      message = JSON.parse(line);
    } catch (error) {
      for (const { reject } of pending.values()) reject(error);
      pending.clear();
      return;
    }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  });
  t.after(async () => {
    lines.close();
    child.stdin.end();
    const timeout = setTimeout(() => child.kill('SIGTERM'), 2000);
    await exited;
    clearTimeout(timeout);
    await rm(workspace, { recursive: true, force: true });
  });
  function request(method, params = {}) {
    if (exitError) return Promise.reject(exitError);
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
  }
  const initialized = await request('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'browser-tools-smoke', version: '1.0.0' },
  });
  assert.ok(initialized.serverInfo);
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
  const tools = await request('tools/list');
  assert.ok(tools.tools.some(tool => tool.name === 'browser_evaluate'));
  const navigated = await request('tools/call', {
    name: 'browser_navigate',
    arguments: { url: 'about:blank' },
  });
  assert.ok(!navigated.isError, JSON.stringify(navigated));
  const result = await request('tools/call', {
    name: 'browser_evaluate',
    arguments: {
      function: '() => { document.title = "browser-tools smoke"; '
        + 'return { title: document.title }; }',
    },
  });
  assert.ok(!result.isError, JSON.stringify(result));
  assert.match(JSON.stringify(result), /browser-tools smoke/);
  const screenshot = await request('tools/call', {
    name: 'browser_take_screenshot',
    arguments: { filename: 'workspace-smoke.png', scale: 'css' },
  });
  assert.ok(!screenshot.isError, JSON.stringify(screenshot));
  assert.ok((await stat(path.join(workspace, 'workspace-smoke.png'))).size > 0);
  const closed = await request('tools/call', { name: 'browser_close', arguments: {} });
  assert.ok(!closed.isError, JSON.stringify(closed));
});
