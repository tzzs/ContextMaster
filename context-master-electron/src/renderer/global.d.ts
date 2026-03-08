// renderer 进程中挂载到 window 的页面 API 全局类型声明

interface Window {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _mainPage: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _historyPage: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _backupPage: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _settingsPage: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _selectedId: any;
  showUndo: (msg: string, itemId?: number) => void;
  hideUndo: () => void;
  doUndo: () => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  switchPage: (page: string, navEl?: HTMLElement, scene?: string) => Promise<void>;
  updateMaximizeBtn: () => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filterHistory: (mode: string, btn: HTMLElement) => void;
  clearHistory: () => Promise<void>;
  createBackup: () => Promise<void>;
  importBackup: () => Promise<void>;
  requestAdminRestart: () => Promise<void>;
  toggleSwitch: (btn: HTMLElement) => void;
}
