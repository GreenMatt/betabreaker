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
  const targetNoExt = path.join(functionsDir, 'async_hooks');
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
  fs.writeFileSync(targetNoExt, shim, 'utf8');
  fs.writeFileSync(targetJS, shim, 'utf8');
  fs.writeFileSync(targetMJS, shim, 'utf8');
  console.log('[fix-cf-dist] Wrote async_hooks shim under _worker.js helpers');
} catch (e) {
  console.warn('[fix-cf-dist] Failed to ensure async_hooks shim:', e?.message || e);
}

console.log('[fix-cf-dist] Completed helper placement and verification.');

// Ensure per-route async_hooks shims next to each generated *.func.js
try {
  const functionsRoot = path.join(workerDir, '__next-on-pages-dist__', 'functions');
  const shimContent = `// Generated shim: async_hooks polyfill for Cloudflare Pages\n` +
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
  let created = 0;
  const createdPaths = [];
  function walkAndShim(p) {
    if (!fs.existsSync(p)) return;
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      const entries = fs.readdirSync(p);
      const hasFunc = entries.some((e) => e.endsWith('.func.js') || e.endsWith('.func.mjs'));
      if (hasFunc) {
        const targetNoExt = path.join(p, 'async_hooks');
        const targetJS = path.join(p, 'async_hooks.js');
        const targetMJS = path.join(p, 'async_hooks.mjs');
        const relFromFunctions = path.relative(functionsRoot, targetJS).replace(/\\/g, '/');
        if (!fs.existsSync(targetJS)) { fs.writeFileSync(targetJS, shimContent, 'utf8'); created++; createdPaths.push(relFromFunctions); }
        else { createdPaths.push(relFromFunctions); }
        if (!fs.existsSync(targetMJS)) { fs.writeFileSync(targetMJS, shimContent, 'utf8'); created++; }
        if (!fs.existsSync(targetNoExt)) { fs.writeFileSync(targetNoExt, shimContent, 'utf8'); created++; }
      }
      for (const e of entries) walkAndShim(path.join(p, e));
      return;
    }
  }
  walkAndShim(functionsRoot);
  console.log(`[fix-cf-dist] Route-level async_hooks shims created: ${created}`);
  // Force Wrangler to attach these modules by importing them from index.js
  try {
    const indexPath = path.join(workerDir, 'index.js');
    if (fs.existsSync(indexPath)) {
      let idx = fs.readFileSync(indexPath, 'utf8');
      let injected = 0;
      for (const rel of createdPaths) {
        const spec = `__next-on-pages-dist__/functions/${rel}`;
        if (!idx.includes(spec)) {
          idx += `\nimport '${spec}'; // ensure attached`;
          injected++;
        }
      }
      if (injected > 0) {
        fs.writeFileSync(indexPath, idx, 'utf8');
        console.log(`[fix-cf-dist] Injected ${injected} async_hooks imports into _worker.js/index.js`);
      } else {
        console.log('[fix-cf-dist] No new imports injected into _worker.js/index.js');
      }
    } else {
      console.warn('[fix-cf-dist] _worker.js/index.js not found for import injection');
    }
  } catch (e) {
    console.warn('[fix-cf-dist] Failed to inject imports into index.js:', e?.message || e);
  }
} catch (e) {
  console.warn('[fix-cf-dist] Failed to ensure per-route async_hooks shims:', e?.message || e);
}

// Patch ALL generated helper/function files to reference async_hooks.js explicitly if needed
try {
  const helperRoot = path.join(workerDir, '__next-on-pages-dist__');
  const exts = new Set(['.js', '.mjs']);
  let patched = 0;
  function walk(p) {
    if (!fs.existsSync(p)) return;
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      for (const e of fs.readdirSync(p)) walk(path.join(p, e));
      return;
    }
    const ext = path.extname(p);
    if (!exts.has(ext)) return;
    let content = fs.readFileSync(p, 'utf8');
    const before = content;
    // Add .js to imports that omit extension, covering nested route paths too
    content = content.replace(/(["'])(__next-on-pages-dist__\/functions\/(?:[\w/]+\/)?async_hooks)(\1)/g, '$1$2.js$3');
    if (content !== before) {
      fs.writeFileSync(p, content, 'utf8');
      patched++;
    }
  }
  walk(helperRoot);
  console.log(`[fix-cf-dist] Import patching complete. Files updated: ${patched}`);
} catch (e) {
  console.warn('[fix-cf-dist] Failed to patch imports:', e?.message || e);
}
