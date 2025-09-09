const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    ensureDir(dest);
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }
}

const root = process.cwd();
const outRoot = path.join(root, '.vercel', 'output');
const workerDir = path.join(outRoot, 'static', '_worker.js');

const candidates = [
  path.join(outRoot, '__next-on-pages-dist__'),
  path.join(outRoot, 'functions', '__next-on-pages-dist__'),
  path.join(outRoot, 'static', '__next-on-pages-dist__'),
  path.join(workerDir, '__next-on-pages-dist__'),
];

const desiredTargets = [
  path.join(outRoot, 'functions', '__next-on-pages-dist__'),
  path.join(outRoot, 'static', '__next-on-pages-dist__'),
  path.join(workerDir, '__next-on-pages-dist__'),
];

let src = null;
for (const c of candidates) {
  if (fs.existsSync(c)) { src = c; break; }
}

if (!src) {
  console.warn('[fix-cf-dist] No __next-on-pages-dist__ folder found in .vercel/output. Creating minimal helper tree...');
  try {
    const minimalRoot = path.join(workerDir, '__next-on-pages-dist__');
    const minimalFunctions = path.join(minimalRoot, 'functions');
    ensureDir(minimalFunctions);
    const targetJS = path.join(minimalFunctions, 'async_hooks.js');
    const targetMJS = path.join(minimalFunctions, 'async_hooks.mjs');
    const shim = `// Generated shim: async_hooks polyfill for Cloudflare Pages\n` +
`export class AsyncLocalStorage {\n` +
`  constructor() { this._store = undefined }\n` +
`  disable() { this._store = undefined }\n` +
`  getStore() { return this._store }\n` +
`  run(store, callback, ...args) { const prev = this._store; this._store = store; try { return callback(...args) } finally { this._store = prev } }\n` +
`  exit(callback, ...args) { return callback(...args) }\n` +
`  enterWith(store) { this._store = store }\n` +
`}\n`;
    fs.writeFileSync(targetJS, shim, 'utf8');
    fs.writeFileSync(targetMJS, shim, 'utf8');
    console.log('[fix-cf-dist] Wrote minimal async_hooks shim under _worker.js helpers');
  } catch (e) {
    console.warn('[fix-cf-dist] Failed to create minimal helper tree:', e?.message || e);
  }
  // Do not exit; continue to post-check/verification below
}

for (const dest of desiredTargets) {
  if (path.resolve(src) === path.resolve(dest)) {
    console.log(`[fix-cf-dist] Helper already present at ${dest}`);
    continue;
  }
  console.log(`[fix-cf-dist] Ensuring helper at ${dest} (from ${src})`);
  copyRecursive(src, dest);
}
// Ensure async_hooks helper exists with a complete stub API
try {
  const functionsDir = path.join(workerDir, '__next-on-pages-dist__', 'functions');
  ensureDir(functionsDir);
  const targetJS = path.join(functionsDir, 'async_hooks.js');
  const targetMJS = path.join(functionsDir, 'async_hooks.mjs');
  const shim = `// Generated shim: async_hooks polyfill for Cloudflare Pages\n` +
`export class AsyncLocalStorage {\n` +
`  constructor() { this._store = undefined }\n` +
`  disable() { this._store = undefined }\n` +
`  getStore() { return this._store }\n` +
`  run(store, callback, ...args) { const prev = this._store; this._store = store; try { return callback(...args) } finally { this._store = prev } }\n` +
`  exit(callback, ...args) { return callback(...args) }\n` +
`  enterWith(store) { this._store = store }\n` +
`}\n` +
`export function executionAsyncId() { return 0 }\n` +
`export function triggerAsyncId() { return 0 }\n` +
`export function createHook() { return { enable() {}, disable() {} } }\n` +
`export default { AsyncLocalStorage, executionAsyncId, triggerAsyncId, createHook }\n`;
  fs.writeFileSync(targetJS, shim, 'utf8');
  fs.writeFileSync(targetMJS, shim, 'utf8');
  console.log('[fix-cf-dist] Wrote async_hooks shim under _worker.js helpers');
} catch (e) {
  console.warn('[fix-cf-dist] Failed to ensure async_hooks shim:', e?.message || e);
}

console.log('[fix-cf-dist] Completed helper placement and verification.');
