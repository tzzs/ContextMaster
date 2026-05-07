// window.api 的 TypeScript 类型声明
// 与 preload/index.ts 中 contextBridge.exposeInMainWorld('api', ...) 保持一致

import type {
  IpcResult,
  MenuItemEntry,
  OperationRecord,
  BackupSnapshot,
  RestoreDiffItem,
  ToggleItemParams,
  BatchToggleParams,
} from '../../shared/types';
import type { MenuScene } from '../../shared/enums';

export interface WindowApi {
  getMenuItems(scene: MenuScene): Promise<IpcResult<MenuItemEntry[]>>;
  toggleItem(params: ToggleItemParams): Promise<IpcResult<{ newState: boolean; newRegistryKey?: string }>>;
  batchToggle(params: BatchToggleParams): Promise<IpcResult<boolean>>;

  getHistory(): Promise<IpcResult<OperationRecord[]>>;
  undoOperation(recordId: number): Promise<IpcResult<void>>;
  clearHistory(): Promise<IpcResult<boolean>>;

  getBackups(): Promise<IpcResult<BackupSnapshot[]>>;
  createBackup(name: string): Promise<IpcResult<BackupSnapshot>>;
  restoreBackup(snapshotId: number): Promise<IpcResult<void>>;
  deleteBackup(id: number): Promise<IpcResult<boolean>>;
  exportBackup(snapshotId: number): Promise<IpcResult<boolean>>;
  importBackup(): Promise<IpcResult<BackupSnapshot>>;
  previewRestoreDiff(snapshotId: number): Promise<IpcResult<RestoreDiffItem[]>>;

  diagnose(): Promise<IpcResult<Record<string, unknown>>>;
  isAdmin(): Promise<IpcResult<boolean>>;
  restartAsAdmin(): Promise<IpcResult<boolean>>;
  openRegedit(fullRegPath: string): Promise<IpcResult<boolean>>;
  copyToClipboard(text: string): Promise<IpcResult<boolean>>;
  openLogDir(): Promise<IpcResult<boolean>>;
  logToFile(level: 'info' | 'warn' | 'error', message: string): Promise<void>;

  minimizeWindow(): Promise<void>;
  maximizeWindow(): Promise<void>;
  closeWindow(): Promise<void>;
  isMaximized(): Promise<boolean>;
}

declare global {
  interface Window {
    api: WindowApi;
  }
}
