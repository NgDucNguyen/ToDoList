const fs = require('node:fs');
const path = require('node:path');
const { webFiles } = require('./distribution-files.cjs');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });
const output = fs.mkdtempSync(path.join(dist, 'web-'));
for (const file of [...webFiles, 'LICENSE']) {
  const destination = path.join(output, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(root, file), destination);
}
fs.writeFileSync(path.join(output, '.nojekyll'), '');
console.log('Web output: ' + output);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `path=${output}\n`);
