import assert from 'node:assert/strict';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { selectBrowser } from '../browser.mjs';

function select(env, available) {
  return selectBrowser({
    env: { PATH: '/usr/bin:/bin', ...env },
    platform: 'linux',
    managedPath: '/cache/chromium',
    executable: file => available.includes(file),
  });
}

test('prefers system Chromium and falls back to installed managed Chromium', () => {
  assert.deepEqual(select({}, ['/usr/bin/chromium', '/cache/chromium']), {
    source: 'system', executablePath: '/usr/bin/chromium',
  });
  assert.deepEqual(select({}, ['/cache/chromium']), {
    source: 'managed', executablePath: '/cache/chromium',
  });
  assert.throws(() => select({}, []), /npm run browser:install/);
});

test('explicit modes do not silently select a different browser source', () => {
  assert.equal(select({ BROWSER_TOOLS_BROWSER: 'managed' }, [
    '/usr/bin/chromium', '/cache/chromium',
  ]).source, 'managed');
  assert.throws(() => select({ BROWSER_TOOLS_BROWSER: 'managed' }, [
    '/usr/bin/chromium',
  ]), /npm run browser:install/);
  assert.throws(() => select({ BROWSER_TOOLS_BROWSER: 'system' }, [
    '/cache/chromium',
  ]), /No system Chromium/);
  assert.throws(() => select({ BROWSER_TOOLS_BROWSER: 'typo' }, []), /must be/);
});

test('validates explicit executable paths and conflicting settings', () => {
  assert.equal(select({ BROWSER_TOOLS_EXECUTABLE_PATH: '/custom/browser' }, [
    '/custom/browser',
  ]).source, 'override');
  for (const file of ['relative/browser', '/missing/browser']) {
    assert.throws(() => select({ BROWSER_TOOLS_EXECUTABLE_PATH: file }, []), /absolute executable/);
  }
  assert.throws(() => select({
    BROWSER_TOOLS_EXECUTABLE_PATH: '/custom/browser',
    BROWSER_TOOLS_BROWSER: 'managed',
  }, ['/custom/browser']), /Do not combine/);
});

test('ignores relative PATH entries and detects macOS application browsers', () => {
  assert.equal(select({ PATH: '.:relative:/usr/bin' }, [
    'chromium', 'relative/chromium', '/cache/chromium',
  ]).source, 'managed');
  const executablePath = '/Applications/Chromium.app/Contents/MacOS/Chromium';
  assert.deepEqual(selectBrowser({
    env: {}, platform: 'darwin', executable: file => file === executablePath,
  }), { source: 'system', executablePath });
});

test('real executable checks reject directories and non-executable files', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'browser-tools-select-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'chromium');
  const env = { BROWSER_TOOLS_EXECUTABLE_PATH: file };
  await writeFile(file, '#!/bin/sh\nexit 0\n');
  assert.throws(() => selectBrowser({ env }), /absolute executable/);
  assert.throws(() => selectBrowser({
    env: { BROWSER_TOOLS_EXECUTABLE_PATH: directory },
  }), /absolute executable/);
  await chmod(file, 0o755);
  assert.equal(selectBrowser({ env }).executablePath, file);
});
