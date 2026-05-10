import { app, BrowserWindow } from 'electron';
import path from 'path';
import { initLogger } from './utils/logger';
import { isRunningAsAdmin, showAdminPermissionDialog } from './utils/adminCheck';
import { getDatabase, closeDatabase } from './data/Database';
import { PowerShellBridge } from './services/PowerShellBridge';
import { RegistryService } from './services/RegistryService';
import { OperationRecordRepo } from './data/repositories/OperationRecordRepo';
import { BackupSnapshotRepo } from './data/repositories/BackupSnapshotRepo';
import { OperationHistoryService } from './services/OperationHistoryService';
import { MenuManagerService } from './services/MenuManagerService';
import { BackupService } from './services/BackupService';
import { registerRegistryHandlers } from './ipc/registry';
import { registerHistoryHandlers } from './ipc/history';
import { registerBackupHandlers } from './ipc/backup';
import { registerSystemHandlers } from './ipc/system';

// Electron Forge / Vite 注入的全局变量
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    frame: false,          // 无边框：自定义标题栏
    titleBarStyle: 'hidden',
    backgroundColor: '#F3F3F3',
    webPreferences: {
      // 开发/生产：preload 输出为 .vite/build/preload.js（与 main index.js 同目录）
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  // 避免白屏闪烁
  mainWindow.once('ready-to-show', () => {
    mainWindow!.show();
  });

  if (typeof MAIN_WINDOW_VITE_DEV_SERVER_URL !== 'undefined') {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }
}

function initServices(): void {
  const db = getDatabase();
  const ps = new PowerShellBridge();
  const registry = new RegistryService(ps);
  const opRepo = new OperationRecordRepo(db);
  const bkRepo = new BackupSnapshotRepo(db);
  const history = new OperationHistoryService(opRepo);
  const menuManager = new MenuManagerService(registry, history);
  const backup = new BackupService(bkRepo, menuManager, history);

  registerRegistryHandlers(menuManager);
  registerHistoryHandlers(history, menuManager);
  registerBackupHandlers(backup);
  registerSystemHandlers();
}

app.whenReady().then(() => {
  initLogger();

  if (!isRunningAsAdmin()) {
    showAdminPermissionDialog();
    return;
  }

  initServices();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  closeDatabase();
  if (process.platform !== 'darwin') app.quit();
});
