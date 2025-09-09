// Minimal CommonJS shim for Node's async_hooks used by Next/request-context.
// Provides AsyncLocalStorage and a few no-op helpers to satisfy imports
// when bundling for Cloudflare Workers (non-Node environment).

class AsyncLocalStorage {
  constructor() {
    this._store = undefined;
  }
  disable() {
    this._store = undefined;
  }
  getStore() {
    return this._store;
  }
  run(store, callback, ...args) {
    const prev = this._store;
    this._store = store;
    try {
      return callback(...args);
    } finally {
      this._store = prev;
    }
  }
  exit(callback, ...args) {
    return callback(...args);
  }
  enterWith(store) {
    this._store = store;
  }
}

function executionAsyncId() {
  return 0;
}
function triggerAsyncId() {
  return 0;
}
function createHook() {
  return { enable() {}, disable() {} };
}

module.exports = { AsyncLocalStorage, executionAsyncId, triggerAsyncId, createHook };

