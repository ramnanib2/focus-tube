const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..');
for (const file of fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js'))) execFileSync(process.execPath, ['--check', path.join(root, 'src', file)]);
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
const files = [manifest.background.service_worker, manifest.action.default_popup, manifest.options_ui.page, ...manifest.content_scripts.flatMap(c => [...c.js, ...c.css]), ...Object.values(manifest.icons || {}), ...Object.values(manifest.action.default_icon || {})];
for (const file of files) if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing ${file}`);
for (const [size, file] of Object.entries({ ...manifest.icons, ...manifest.action.default_icon })) {
  const png = fs.readFileSync(path.join(root, file));
  if (png.toString('hex', 0, 8) !== '89504e470d0a1a0a' || png.readUInt32BE(16) !== Number(size) || png.readUInt32BE(20) !== Number(size)) throw new Error(`Invalid icon dimensions: ${file}`);
}
for (const file of ['app.html', 'popup.html', 'unlock.html', 'privacy.html']) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  if (ids.length !== new Set(ids).size) throw new Error(`Duplicate IDs in ${file}`);
  if (/<script(?![^>]*src=)[^>]*>/i.test(html)) throw new Error(`Inline script violates extension CSP in ${file}`);
  for (const match of html.matchAll(/(?:src|href)="((?:src|assets)\/[^"#]+)"/g)) if (!fs.existsSync(path.join(root, match[1]))) throw new Error(`Missing ${match[1]}`);
}
console.log('All scripts parse; manifest assets and extension pages checked.');
