/* Build into a fresh directory so an open old release cannot block an update. */
const fs = require('node:fs');
const path = require('node:path');
const packager = require('electron-packager');

async function build() {
  const root = path.resolve(__dirname, '..');
  const dist = path.join(root, 'dist');
  fs.mkdirSync(dist, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = fs.mkdtempSync(path.join(dist, `build-${stamp}-`));
  console.log(`Building a new release in: ${out}`);
  const releases = await packager({
    dir: root,
    name: 'MyDailyPlanner',
    platform: 'win32',
    arch: 'x64',
    out,
    icon: path.join(root, 'Calendar.ico'),
    overwrite: false,
    // Exclude every previous release, including the new output directory.
    ignore: [/^\/dist(?:\/|$)/],
  });
  for (const release of releases) {
    console.log(`EXE: ${path.join(release, 'MyDailyPlanner.exe')}`);
    console.log('Keep the entire release folder together when moving the app.');
  }
}

build().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
