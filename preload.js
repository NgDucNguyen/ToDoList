const { contextBridge, ipcRenderer } = require('electron');
// Expose named operations only; never expose Node, arbitrary IPC, or stored keys.
contextBridge.exposeInMainWorld('plannerDesktop', {
  reminder: message => ipcRenderer.send('planner:reminder', message),
  hust: {
    connect: () => ipcRenderer.invoke('hust:connect'),
    read: options => ipcRenderer.invoke('hust:read', options),
    backup: raw => ipcRenderer.invoke('hust:backup', raw),
    disconnect: () => ipcRenderer.invoke('hust:disconnect'),
    onStatus: callback => {
      const listener = (_event, message) => callback(String(message));
      ipcRenderer.on('hust:connection-status', listener);
      return () => ipcRenderer.removeListener('hust:connection-status', listener);
    },
  },
});
