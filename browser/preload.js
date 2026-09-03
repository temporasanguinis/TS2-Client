const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld('ipcRenderer', {
  setZoom: (event, dir) => ipcRenderer.invoke('setZoom', event, dir),
  onSetText: (callback) => ipcRenderer.on('set-text', (event, selector, text) => callback(selector, text))
});

