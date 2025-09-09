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

const candidates = [
  path.join(outRoot, '__next-on-pages-dist__'),
  path.join(outRoot, 'functions', '__next-on-pages-dist__'),
  path.join(outRoot, 'static', '__next-on-pages-dist__'),
];

const desiredTargets = [
  path.join(outRoot, 'functions', '__next-on-pages-dist__'),
  path.join(outRoot, 'static', '__next-on-pages-dist__'),
];

let src = null;
for (const c of candidates) {
  if (fs.existsSync(c)) { src = c; break; }
}

if (!src) {
  console.warn('[fix-cf-dist] No __next-on-pages-dist__ folder found in .vercel/output');
  process.exit(0);
}

for (const dest of desiredTargets) {
  if (path.resolve(src) === path.resolve(dest)) {
    console.log(`[fix-cf-dist] Helper already present at ${dest}`);
    continue;
  }
  console.log(`[fix-cf-dist] Ensuring helper at ${dest} (from ${src})`);
  copyRecursive(src, dest);
}
console.log('[fix-cf-dist] Completed helper placement for functions and static.');
