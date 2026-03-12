import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';

// Mock must be at the top of the file - these are hoisted by vitest
vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
  execFile: vi.fn(),
  execSync: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(),
    getVersion: vi.fn(() => '1.0.0'),
    on: vi.fn(),
    quit: vi.fn(),
    isReady: vi.fn(() => true),
    whenReady: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('@/main/utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks are defined
import { execFileSync, execFile } from 'child_process';
import { app } from 'electron';
import log from '@/main/utils/logger';

// Module-level cache needs to be cleared between tests
// We need to import the module after resetting to clear the cache
let isAdmin: () => boolean;
let restartAsAdmin: () => void;

describe('AdminHelper', () => {
  let originalPlatform: PropertyDescriptor | undefined;

  // Helper casts
  const getMockedExecFileSync = () => execFileSync as unknown as Mock<typeof execFileSync>;
  const getMockedExecFile = () => execFile as unknown as Mock<typeof execFile>;
  const getMockedAppGetPath = () => app.getPath as unknown as Mock<typeof app.getPath>;
  const getMockedAppQuit = () => app.quit as unknown as Mock<typeof app.quit>;

  async function importFreshModule() {
    // Reset module cache to clear _adminCache
    vi.resetModules();
    const module = await import('@/main/utils/AdminHelper');
    isAdmin = module.isAdmin;
    restartAsAdmin = module.restartAsAdmin;
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Store original platform before any modifications
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    
    // Re-import to clear the _adminCache
    await importFreshModule();
  });

  afterEach(() => {
    // Restore original platform
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
    vi.restoreAllMocks();
  });

  describe('isAdmin', () => {
    it('should return true on non-Windows platforms', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      
      expect(isAdmin()).toBe(true);
    });

    it('should return true when PowerShell returns True', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      
      getMockedExecFileSync().mockReturnValue(Buffer.from('True'));
      
      expect(isAdmin()).toBe(true);
      expect(getMockedExecFileSync()).toHaveBeenCalledWith(
        'powershell.exe',
        expect.arrayContaining([
          '-NonInteractive',
          '-NoProfile',
          '-Command',
          expect.stringContaining('IsInRole'),
        ]),
        { stdio: 'pipe' }
      );
    });

    it('should return false when PowerShell returns False', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      
      getMockedExecFileSync().mockReturnValue(Buffer.from('False'));
      
      expect(isAdmin()).toBe(false);
    });

    it('should return false and cache when PowerShell throws error', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      
      getMockedExecFileSync().mockImplementation(() => {
        throw new Error('PowerShell not found');
      });
      
      // First call
      expect(isAdmin()).toBe(false);
      
      // Second call should use cache
      expect(isAdmin()).toBe(false);
      // Should only be called once due to caching
      expect(getMockedExecFileSync()).toHaveBeenCalledTimes(1);
    });

    it('should cache positive result', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      
      getMockedExecFileSync().mockReturnValue(Buffer.from('True'));
      
      // Multiple calls
      expect(isAdmin()).toBe(true);
      expect(isAdmin()).toBe(true);
      expect(isAdmin()).toBe(true);
      
      // Should only call execFileSync once due to caching
      expect(getMockedExecFileSync()).toHaveBeenCalledTimes(1);
    });
  });

  describe('restartAsAdmin', () => {
    it('should execute PowerShell to restart with admin privileges', () => {
      const mockExePath = 'C:\\Program Files\\ContextMaster\\ContextMaster.exe';
      getMockedAppGetPath().mockReturnValue(mockExePath);
      getMockedExecFile().mockImplementation((cmd, args, callback) => {
        if (callback && typeof callback === 'function') {
          callback(null, '', '');
        }
        return {} as any;
      });
      vi.useFakeTimers();

      restartAsAdmin();

      // Verify PowerShell command was constructed correctly
      expect(getMockedExecFile()).toHaveBeenCalledWith(
        'powershell.exe',
        expect.arrayContaining([
          '-NonInteractive',
          '-NoProfile',
          '-Command',
          expect.stringContaining('Start-Process'),
          expect.stringContaining(mockExePath),
          expect.stringContaining('-Verb RunAs'),
        ]),
        expect.any(Function)
      );

      vi.useRealTimers();
    });

    it('should log error when restart fails', () => {
      const mockExePath = 'C:\\Program Files\\ContextMaster\\ContextMaster.exe';
      getMockedAppGetPath().mockReturnValue(mockExePath);
      const mockError = new Error('Access denied');
      getMockedExecFile().mockImplementation((cmd, args, callback) => {
        if (callback && typeof callback === 'function') {
          callback(mockError, '', '');
        }
        return {} as any;
      });

      restartAsAdmin();

      // Verify error was logged
      expect(log.error).toHaveBeenCalledWith(
        'Failed to restart as admin:',
        expect.any(Error)
      );
    });

    it('should call app.quit after timeout', () => {
      getMockedAppGetPath().mockReturnValue('C:\\test.exe');
      getMockedExecFile().mockImplementation(() => ({} as any));
      vi.useFakeTimers();

      restartAsAdmin();

      // Fast-forward time
      vi.advanceTimersByTime(500);

      expect(getMockedAppQuit()).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});
