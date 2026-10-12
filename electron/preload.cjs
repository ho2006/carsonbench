const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('carsonBench', {
  version: '1.1.0',
  request: (requestId, route, apiKey, input) => ipcRenderer.invoke('deepseek:request',requestId,route,apiKey,input),
  cancel: requestId => ipcRenderer.send('deepseek:cancel',requestId),
  saveRecord: (filename,content) => ipcRenderer.invoke('record:save',filename,content),
});
