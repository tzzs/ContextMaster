import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SystemInfoService } from '@/main/services/SystemInfoService';

vi.mock('@/main/utils/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('SystemInfoService', () => {
  const mockPs = {
    execute: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects Win11 with new-style menu', async () => {
    mockPs.execute.mockResolvedValue({ buildNumber: 22631, classicMenuForced: false });
    const service = new SystemInfoService(mockPs as never);
    const result = await service.getMenuStyle();
    expect(result).toEqual({
      osVersion: 'win11',
      menuStyle: 'win11-new',
      buildNumber: 22631,
    });
  });

  it('detects Win11 with classic menu forced', async () => {
    mockPs.execute.mockResolvedValue({ buildNumber: 22631, classicMenuForced: true });
    const service = new SystemInfoService(mockPs as never);
    const result = await service.getMenuStyle();
    expect(result).toEqual({
      osVersion: 'win11',
      menuStyle: 'classic',
      buildNumber: 22631,
    });
  });

  it('detects Win10', async () => {
    mockPs.execute.mockResolvedValue({ buildNumber: 19045, classicMenuForced: false });
    const service = new SystemInfoService(mockPs as never);
    const result = await service.getMenuStyle();
    expect(result).toEqual({
      osVersion: 'win10',
      menuStyle: 'classic',
      buildNumber: 19045,
    });
  });

  it('caches result after first call', async () => {
    mockPs.execute.mockResolvedValue({ buildNumber: 22631, classicMenuForced: false });
    const service = new SystemInfoService(mockPs as never);
    await service.getMenuStyle();
    await service.getMenuStyle();
    expect(mockPs.execute).toHaveBeenCalledTimes(1);
  });

  it('invalidateCache clears cached result', async () => {
    mockPs.execute.mockResolvedValue({ buildNumber: 22631, classicMenuForced: false });
    const service = new SystemInfoService(mockPs as never);
    await service.getMenuStyle();
    service.invalidateCache();
    await service.getMenuStyle();
    expect(mockPs.execute).toHaveBeenCalledTimes(2);
  });

  describe('buildDetectScript', () => {
    it('reads CurrentBuildNumber and classic menu override key', () => {
      const script = SystemInfoService.buildDetectScript();
      expect(script).toContain('CurrentBuildNumber');
      expect(script).toContain('{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}');
      expect(script).toContain('InprocServer32');
      expect(script).toContain('classicMenuForced');
    });
  });
});
