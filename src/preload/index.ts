import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc-channels';
import type {
  IpcResult,
  MenuItemEntry,
  OperationRecord,
  BackupSnapshot,
  RestoreDiffItem,
  ToggleItemParams,
  BatchToggleParams,
} from '../shared/types';
import type { MenuScene } from '../shared/enums';

// 类型化 invoke 辅助
function invoke<T>(channel: string, ...args: unknown[]): Promise<IpcResult<T>> {
  return ipcRenderer.invoke(channel, ...args) as Promise<IpcResult<T>>;
}

const api = {
  // ── Registry ──
  getMenuItems: (scene: MenuScene) =>
    invoke<MenuItemEntry[]>(IPC.REGISTRY_GET_ITEMS, scene),

  toggleItem: (params: ToggleItemParams) =>
    invoke<{ newState: boolean }>(IPC.REGISTRY_TOGGLE, params),

  batchToggle: (params: BatchToggleParams) =>
    invoke<boolean>(IPC.REGISTRY_BATCH, params),

  // ── History ──
  getHistory: () =>
    invoke<OperationRecord[]>(IPC.HISTORY_GET_ALL),

  undoOperation: (recordId: number) =>
    invoke<void>(IPC.HISTORY_UNDO, recordId),

  clearHistory: () =>
    invoke<boolean>(IPC.HISTORY_CLEAR),

  // ── Backup ──
  getBackups: () =>
    invoke<BackupSnapshot[]>(IPC.BACKUP_GET_ALL),

  createBackup: (name: string) =>
    invoke<BackupSnapshot>(IPC.BACKUP_CREATE, name),

  restoreBackup: (snapshotId: number) =>
    invoke<void>(IPC.BACKUP_RESTORE, snapshotId),

  deleteBackup: (id: number) =>
    invoke<boolean>(IPC.BACKUP_DELETE, id),

  exportBackup: (snapshotId: number) =>
    invoke<boolean>(IPC.BACKUP_EXPORT, snapshotId),

  importBackup: () =>
    invoke<BackupSnapshot>(IPC.BACKUP_IMPORT),

  previewRestoreDiff: (snapshotId: number) =>
    invoke<RestoreDiffItem[]>(IPC.BACKUP_PREVIEW_DIFF, snapshotId),

  // ── System ──
  isAdmin: () =>
    invoke<boolean>(IPC.SYS_IS_ADMIN),

  restartAsAdmin: () =>
    invoke<boolean>(IPC.SYS_RESTART_AS_ADMIN),

  openRegedit: (fullRegPath: string) =>
    invoke<boolean>(IPC.SYS_OPEN_REGEDIT, fullRegPath),

  openLogDir: () =>
    invoke<boolean>(IPC.SYS_OPEN_LOG_DIR),

  copyToClipboard: (text: string) =>
    invoke<boolean>(IPC.SYS_COPY_CLIPBOARD, text),

  openExternal: (url: string) =>
    invoke<void>(IPC.SYS_OPEN_EXTERNAL, url),

  logToFile: (level: 'info' | 'warn' | 'error', message: string) =>
    ipcRenderer.invoke(IPC.SYS_LOG_TO_FILE, level, message),

  // ── Window ──
  minimizeWindow: () => ipcRenderer.invoke(IPC.WIN_MINIMIZE),
  maximizeWindow: () => ipcRenderer.invoke(IPC.WIN_MAXIMIZE),
  closeWindow:    () => ipcRenderer.invoke(IPC.WIN_CLOSE),
  isMaximized:    () => ipcRenderer.invoke(IPC.WIN_IS_MAXIMIZED) as Promise<boolean>,
};

contextBridge.exposeInMainWorld('api', api);

// 类型声明供 renderer TypeScript 使用
export type Api = typeof api;
