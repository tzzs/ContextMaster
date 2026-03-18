// renderer 进程中挂载到 window 的页面 API 全局类型声明

interface MainPageApi {
  selectItem(id: number): void;
  toggleItem(id: number): Promise<void>;
  setFilter(mode: 'all' | 'enabled' | 'disabled', btn: HTMLElement): void;
  flashCopyBtn(btn: HTMLButtonElement): void;
  toggleFromDetail(): Promise<void>;
  deleteSelected(): void;
}

interface HistoryPageApi {
  undoRecord(id: number): Promise<void>;
  filterHistory(mode: string, btn: HTMLElement): void;
  clearAllHistory(): Promise<void>;
}

interface BackupPageApi {
  createBackup(): Promise<void>;
  restoreBackup(id: number): Promise<void>;
  exportBackup(id: number): Promise<void>;
  importBackup(): Promise<void>;
  deleteBackup(id: number): Promise<void>;
}

interface SettingsPageApi {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface Window {
  _mainPage: MainPageApi;
  _historyPage: HistoryPageApi;
  _backupPage: BackupPageApi;
  _settingsPage: SettingsPageApi;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _selectedId: any;
  showUndo: (msg: string, itemId?: number) => void;
  hideUndo: () => void;
  doUndo: () => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  switchPage: (page: string, navEl?: HTMLElement, scene?: string) => Promise<void>;
  updateMaximizeBtn: () => Promise<void>;
  filterHistory: (mode: string, btn: HTMLElement) => void;
  clearHistory: () => Promise<void>;
  createBackup: () => Promise<void>;
  importBackup: () => Promise<void>;
  requestAdminRestart: () => Promise<void>;
  toggleSwitch: (btn: HTMLElement) => void;
  invalidateAllScenesCache?: () => void;
}
