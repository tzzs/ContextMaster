import { MenuScene, MenuItemType, OperationType, BackupType } from './enums';

// IPC 统一返回包装
export type IpcResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// 菜单条目
export interface MenuItemEntry {
  id: number;
  name: string;
  command: string;
  iconPath: string | null;
  isEnabled: boolean;
  source: string;
  menuScene: MenuScene;
  registryKey: string;
  type: MenuItemType;
}

// 操作记录
export interface OperationRecord {
  id: number;
  timestamp: string;       // ISO 8601 string
  operationType: OperationType;
  targetEntryName: string;
  registryPath: string;
  oldValue: string | null;
  newValue: string | null;
}

// 备份快照
export interface BackupSnapshot {
  id: number;
  name: string;
  creationTime: string;    // ISO 8601 string
  type: BackupType;
  menuItemsJson: string;
  sha256Checksum: string;
}

// 差异预览项
export interface RestoreDiffItem {
  current: MenuItemEntry;
  backup: MenuItemEntry;
}

// Toggle 参数
export interface ToggleItemParams {
  registryKey: string;
  isEnabled: boolean;       // 当前状态（将被取反）
  name: string;
  menuScene: MenuScene;
  type?: MenuItemType;      // ShellExt 需要特殊处理（键名重命名）
}

// 批量操作参数
export interface BatchToggleParams {
  items: MenuItemEntry[];
  enable: boolean;
}

// 备份导出参数
export interface ExportBackupParams {
  snapshotId: number;
}

// 窗口尺寸信息
export interface WindowInfo {
  isMaximized: boolean;
}
