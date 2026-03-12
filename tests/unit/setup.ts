import { vi } from 'vitest';

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      const paths: Record<string, string> = {
        userData: '/mock/user/data',
        temp: '/mock/temp',
        home: '/mock/home',
      };
      return paths[name] || `/mock/${name}`;
    }),
    getVersion: vi.fn(() => '1.0.0'),
    on: vi.fn(),
    quit: vi.fn(),
    isReady: vi.fn(() => true),
    whenReady: vi.fn(() => Promise.resolve()),
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn(),
    removeAllListeners: vi.fn(),
  },
  BrowserWindow: vi.fn().mockImplementation(() => ({
    loadURL: vi.fn(),
    loadFile: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    close: vi.fn(),
    isDestroyed: vi.fn(() => false),
    webContents: {
      send: vi.fn(),
      on: vi.fn(),
      executeJavaScript: vi.fn(),
    },
  })),
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
    showMessageBox: vi.fn(),
    showErrorBox: vi.fn(),
  },
  shell: {
    openPath: vi.fn(),
    openExternal: vi.fn(),
    showItemInFolder: vi.fn(),
  },
}));

// Mock electron-log
vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
    silly: vi.fn(),
  },
}));

// Mock better-sqlite3
vi.mock('better-sqlite3', () => ({
  default: vi.fn().mockImplementation((dbPath: string) => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        run: vi.fn().mockReturnValue({ lastInsertRowid: 1, changes: 1 }),
        get: vi.fn().mockReturnValue(null),
        all: vi.fn().mockReturnValue([]),
      }),
      exec: vi.fn(),
      pragma: vi.fn().mockReturnValue([]),
      close: vi.fn(),
      transaction: vi.fn().mockImplementation((fn) => fn),
    };
    return mockDb;
  }),
}));

// Global test utilities
export const createMockIpcResult = <T>(data: T, success = true) => ({
  success,
  data: success ? data : undefined,
  error: success ? undefined : String(data),
});

// Extend vitest matchers
declare module 'vitest' {
  interface Assertion<T = any> {
    toBeWithinRange(min: number, max: number): void;
  }
}
