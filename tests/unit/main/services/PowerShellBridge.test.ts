import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PowerShellBridge } from '@/main/services/PowerShellBridge';

// Simple mock setup
vi.mock('child_process', () => ({
  execFile: vi.fn((cmd, args, opts, callback) => {
    callback(null, '[]', '');
  }),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
}));

vi.mock('@/main/utils/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('PowerShellBridge', () => {
  let bridge: PowerShellBridge;

  beforeEach(() => {
    vi.clearAllMocks();
    bridge = new PowerShellBridge();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('buildGetItemsScript', () => {
    it('should return script for getting menu items', () => {
      const script = bridge.buildGetItemsScript('DesktopBackground\\Shell');

      expect(script).toContain('DesktopBackground\\Shell');
      expect(script).toContain('Get-ChildItem');
      expect(script).toContain('ConvertTo-Json');
    });
  });

  describe('buildSetEnabledScript', () => {
    it('should return script for enabling item', () => {
      const script = bridge.buildSetEnabledScript('HKCR\\test', true);

      expect(script).toContain('HKCR\\test');
      expect(script).toContain('Remove-ItemProperty');
    });

    it('should return script for disabling item', () => {
      const script = bridge.buildSetEnabledScript('HKCR\\test', false);

      expect(script).toContain('HKCR\\test');
      expect(script).toContain('Set-ItemProperty');
    });
  });
});
