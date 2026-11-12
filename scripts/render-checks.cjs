/* Real-time Chromium checks: virtual time can starve asynchronous image encoders. */
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const [fixture, output, jobsFile] = process.argv.slice(2);
const profile = path.join(path.dirname(fixture), 'renderer-profile');
fs.mkdirSync(profile, { recursive: true });
app.setPath('userData', profile);
app.setPath('sessionData', profile);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  const createWindow = (width, height) => new BrowserWindow({ show: false, width, height, useContentSize: true, webPreferences: { nodeIntegration: false, contextIsolation: true, backgroundThrottling: false, offscreen: Boolean(jobsFile) } });
  let window = createWindow(1280, 800);
  async function waitFor(expression, timeout = 45000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const result = await window.webContents.executeJavaScript(expression);
      if (result) return result;
      await pause(80);
    }
    throw new Error('Timed out waiting for renderer: ' + expression);
  }
  if (jobsFile) {
    const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
    for (const job of jobs) {
      const previous = window;
      window = createWindow(job.width, job.height);
      previous.destroy();
      await window.loadFile(job.file);
      await waitFor('Boolean(window.__previewReady)', 15000);
      await window.webContents.executeJavaScript(`(() => {const doc=document.querySelector('iframe').contentDocument;const style=doc.createElement('style');style.textContent='*,*::before,*::after{animation:none!important;transition:none!important}';doc.head.append(style);})()`);
      await pause(300);
      fs.writeFileSync(job.screenshot, (await window.webContents.capturePage()).toPNG());
      console.log(job.screenshot);
    }
  } else {
    await window.loadFile(fixture);
    const result = await waitFor('document.getElementById("results")?.textContent');
    fs.writeFileSync(output, result);
  }
  app.quit();
}).catch(error => { console.error(error.stack || error); app.exit(1); });
