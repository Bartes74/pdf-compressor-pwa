const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  openPdf: () => ipcRenderer.invoke('dialog:openPdf'),
  chooseDirectory: () => ipcRenderer.invoke('dialog:chooseDirectory'),
  saveFiles: (directory, files) => ipcRenderer.invoke('fs:saveFiles', { directory, files }),
});

