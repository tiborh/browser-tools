import { accessSync, constants, statSync } from 'node:fs';
import path from 'node:path';

function isExecutable(file) {
  try {
    accessSync(file, constants.X_OK);
    return statSync(file).isFile();
  } catch (error) {
    if (['ENOENT', 'ENOTDIR', 'EACCES'].includes(error.code)) return false;
    throw error;
  }
}

export function selectBrowser({
  env = process.env,
  platform = process.platform,
  managedPath,
  executable = isExecutable,
} = {}) {
  const mode = env.BROWSER_TOOLS_BROWSER || 'auto';
  if (!['auto', 'system', 'managed'].includes(mode)) {
    throw new Error('BROWSER_TOOLS_BROWSER must be auto, system, or managed.');
  }
  const override = env.BROWSER_TOOLS_EXECUTABLE_PATH;
  if (override) {
    if (mode === 'managed') {
      throw new Error('Do not combine a browser executable override with managed mode.');
    }
    if (!path.isAbsolute(override) || !executable(override)) {
      throw new Error(`Browser override must be an absolute executable path: ${override}`);
    }
    return { source: 'override', executablePath: override };
  }
  if (!['linux', 'darwin'].includes(platform)) {
    throw new Error('This launcher currently supports Linux and macOS.');
  }
  if (mode !== 'managed') {
    const names = ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'];
    const candidates = (env.PATH || '').split(path.delimiter)
      .filter(directory => path.isAbsolute(directory))
      .flatMap(directory => names.map(name => path.join(directory, name)));
    if (platform === 'darwin') {
      candidates.push(
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      );
    }
    const systemPath = candidates.find(executable);
    if (systemPath) return { source: 'system', executablePath: systemPath };
  }
  if (mode !== 'system' && managedPath && executable(managedPath)) {
    return { source: 'managed', executablePath: managedPath };
  }
  throw new Error(
    mode === 'system'
      ? 'No system Chromium found. Set BROWSER_TOOLS_EXECUTABLE_PATH to an installed browser.'
      : 'No usable Chromium found. Run npm run browser:install in the browser-tools checkout.',
  );
}
