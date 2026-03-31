'use strict';

/**
 * electron/main.js — Folio v2 Desktop Shell
 *
 * Responsibilities:
 *  1. Ensure user data directories and university templates exist.
 *  2. Start the embedded Express server on a free port.
 *  3. Open a frameless BrowserWindow that loads the app.
 *  4. Handle native window controls (close / minimize / maximize).
 *  5. Serve as the single entry point — no browser, no address bar.
 */

const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path   = require('path');
const fs     = require('fs');
const os     = require('os');

// ── Data paths ────────────────────────────────────────────────────────────────
const DOCUMENTS_ROOT  = path.join(os.homedir(), 'Documents', 'Folio');
const BUNDLED_UNI_DIR = path.join(__dirname, '..', 'universities');

// When packaged, extraResources land here
function getBundledUniDir() {
  if (app.isPackaged) {
    const rp = path.join(process.resourcesPath, 'universities');
    if (fs.existsSync(rp)) return rp;
  }
  return path.join(__dirname, '..', 'universities');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyIfMissing(src, dst) {
  if (!fs.existsSync(src)) return;
  if (fs.existsSync(dst)) {
    const srcBuf = fs.readFileSync(src);
    const dstBuf = fs.readFileSync(dst);
    if (Buffer.compare(srcBuf, dstBuf) === 0) return; // identical — skip
  }
  fs.copyFileSync(src, dst);
}

function ensureUserData() {
  ensureDir(DOCUMENTS_ROOT);
  ensureDir(path.join(DOCUMENTS_ROOT, 'uploads'));
  ensureDir(path.join(DOCUMENTS_ROOT, 'outputs'));
  ensureDir(path.join(DOCUMENTS_ROOT, 'universities'));

  const bundledUniDir = getBundledUniDir();
  if (!fs.existsSync(bundledUniDir)) return;

  const entries = fs.readdirSync(bundledUniDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const srcUniDir = path.join(bundledUniDir, entry.name);
    const dstUniDir = path.join(DOCUMENTS_ROOT, 'universities', entry.name);
    ensureDir(dstUniDir);

    const files = fs.readdirSync(srcUniDir);
    for (const file of files) {
      copyIfMissing(
        path.join(srcUniDir, file),
        path.join(dstUniDir, file),
      );
    }
  }
}

// ── Server startup ─────────────────────────────────────────────────────────────
let serverPort = null;

function findFreePort(start = 3210, end = 3299) {
  return new Promise((resolve, reject) => {
    const net = require('net');
    let port = start;

    function tryPort() {
      if (port > end) {
        reject(new Error('No free port found'));
        return;
      }
      const server = net.createServer();
      server.once('error', () => { port++; tryPort(); });
      server.once('listening', () => { server.close(() => resolve(port)); });
      server.listen(port, '127.0.0.1');
    }
    tryPort();
  });
}

async function startExpressServer() {
  process.env.FOLIO_DATA_PATH = DOCUMENTS_ROOT;
  process.env.FOLIO_PASSWORD  = process.env.FOLIO_PASSWORD || 'Torechudi0';

  const port = await findFreePort();
  process.env.PORT = String(port);
  serverPort = port;

  // Require server after env vars are set
  const { startServer } = require('../server');
  startServer(port);

  return port;
}

// ── Window ─────────────────────────────────────────────────────────────────────
let mainWindow = null;

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width:  1280,
    height: 820,
    minWidth:  960,
    minHeight: 640,
    frame: false,           // custom title bar in renderer
    titleBarStyle: 'hidden',
    backgroundColor: '#080808',
    show: false,            // show after ready-to-show
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}/password`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in default browser, not Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Auto-update ────────────────────────────────────────────────────────────────
function setupAutoUpdater() {
  if (!app.isPackaged) return; // skip in dev

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'A new version of Folio has been downloaded.\nRestart now to apply the update?',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Error:', err?.message ?? err);
  });

  autoUpdater.checkForUpdates().catch(() => {});
}

// ── IPC handlers ───────────────────────────────────────────────────────────────
ipcMain.on('window:close',    () => mainWindow?.close());
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('get:port', () => serverPort);

// ── App lifecycle ──────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  try {
    ensureUserData();
    const port = await startExpressServer();
    createWindow(port);
    setupAutoUpdater();
  } catch (err) {
    console.error('Fatal startup error:', err);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && serverPort) {
      createWindow(serverPort);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
