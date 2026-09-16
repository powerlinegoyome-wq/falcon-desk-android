import { app, BrowserWindow, protocol, nativeImage, Menu } from 'electron';
import path from 'path';
import fs from 'fs';
import { dbManager } from './db/database';
import { mediaManager } from './media/mediaManager';
import { botManager } from './telegram/botManager';
import { registerIpcHandlers } from './ipc/registerIpc';

// Set App Name & Windows App ID
app.setName('Falcon Desk');
if (process.platform === 'win32') {
  app.setAppUserModelId('com.falcondesk.desktop.v1');
}

// Remove default Electron menu bar
Menu.setApplicationMenu(null);

// Register standard scheme for media protocol before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      corsEnabled: true,
    },
  },
]);

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  let appIcon: any = undefined;
  const possibleIconPaths = [
    path.join(process.cwd(), 'build/icon.ico'),
    path.join(process.cwd(), 'build/icon.png'),
    path.join(process.cwd(), 'logo.ico'),
    path.join(process.cwd(), 'logo.png'),
    path.join(app.getAppPath(), 'build/icon.ico'),
    path.join(app.getAppPath(), 'build/icon.png'),
    path.join(__dirname, '../../build/icon.ico'),
    path.join(__dirname, '../../logo.ico'),
  ];

  for (const p of possibleIconPaths) {
    if (fs.existsSync(p)) {
      const img = nativeImage.createFromPath(p);
      if (!img.isEmpty()) {
        appIcon = img;
        break;
      }
    }
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Falcon Desk',
    icon: appIcon,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (appIcon && !appIcon.isEmpty()) {
    mainWindow.setIcon(appIcon);
  }

  registerIpcHandlers(mainWindow);

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Initialize Database and Media Manager
  await dbManager.init();
  mediaManager.init();
  mediaManager.registerCustomProtocol();

  createWindow();

  // Auto-connect Telegram bot if token is already configured
  const token = dbManager.getSetting('botToken');
  if (token && token.trim()) {
    botManager.start().catch((err) => {
      console.log('Auto-start bot failed:', err.message);
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  await botManager.stop();
  dbManager.saveToDiskSync();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
