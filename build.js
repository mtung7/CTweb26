/**
 * build.js — a no-op build step.
 *
 * This site is already static: index.html and the assets folder are the
 * finished product. There is nothing to compile.
 *
 * This file exists because Cloudflare Pages runs `npm run build` by
 * default. Without a package.json and a "build" script, that command
 * fails with ENOENT and the deployment stops before it ever publishes
 * anything. This script succeeds instantly and leaves the files in place.
 *
 * The build output directory is the repository root itself.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.DS_Store') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(ROOT);
const bytes = files.reduce((n, f) => n + fs.statSync(f).size, 0);

if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
  console.error('✗ index.html is missing — the site cannot be published.');
  process.exit(1);
}

console.log('✓ Static site — nothing to compile.');
console.log('  ' + files.length + ' files, ' + (bytes / 1024 / 1024).toFixed(1) + ' MB');
console.log('  Output directory: the repository root');
