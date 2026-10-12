import path from 'node:path';

export const APP_URL = 'carsonbench://app/index.html';
const externalHosts = new Set(['github.com','api-docs.deepseek.com','platform.deepseek.com','commons.wikimedia.org','www.acs.org']);

export function trustedPage(url) {
  try { const value = new URL(url); return value.protocol === 'carsonbench:' && value.host === 'app' && value.pathname === '/index.html' && !value.username && !value.password; }
  catch { return false; }
}

export function externalUrl(url) {
  try { const value = new URL(url); return value.protocol === 'https:' && externalHosts.has(value.hostname) && !value.username && !value.password && (!value.port || value.port === '443'); }
  catch { return false; }
}

export function bundledFile(root, url) {
  const value = new URL(url);
  if (value.protocol !== 'carsonbench:' || value.host !== 'app' || value.username || value.password) throw new Error('Invalid app resource');
  const filename = decodeURIComponent(value.pathname === '/' ? '/index.html' : value.pathname);
  if (filename.includes('\\') || filename.includes('\0')) throw new Error('Invalid resource path');
  const result = path.resolve(root, `.${filename}`);
  const relative = path.relative(root,result);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Resource outside app');
  return result;
}
