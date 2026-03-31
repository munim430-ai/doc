'use strict';

/**
 * preload.js — runs in the renderer context with Node access disabled.
 * Exposes a minimal `folioWindow` API to the renderer via contextBridge.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('folioWindow', {
  close:    () => ipcRenderer.send('window:close'),
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  getPort:  () => ipcRenderer.invoke('get:port'),
});
