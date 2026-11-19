const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { webFiles, desktopFiles, includePath } = require('../scripts/distribution-files.cjs');
const root = path.resolve(__dirname, '..');

test('public bundle includes all HTML assets and desktop local modules', () => {
  for (const file of desktopFiles) assert.ok(fs.statSync(path.join(root, file)).isFile(), file);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const [, reference] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (reference.startsWith('#')) continue;
    assert.ok(webFiles.includes(reference), 'Missing web asset: ' + reference);
  }
  for (const file of desktopFiles.filter(file => file.endsWith('.js'))) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    for (const [, moduleName] of source.matchAll(/require\(['"](\.\/[^'"]+)['"]\)/g)) {
      assert.ok(desktopFiles.includes(moduleName.slice(2).replace(/\.js$/, '') + '.js'), file + ': ' + moduleName);
    }
  }
});

test('packaging includes asset directories but excludes development tools, secrets and data', () => {
  for (const file of ['', '/assets', '/assets/chatbot-avatar.svg', '\\main.js']) assert.ok(includePath(file), file);
  for (const file of ['/dist', '/backups', '/node_modules', '/.git', '/.env', '/chatbot-config.json', '/profile-todolist', '/tests', '/scripts', '/unexpected-data.json', '/assets/private.png']) assert.equal(includePath(file), false, file);
});
