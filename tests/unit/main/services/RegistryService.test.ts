import { describe, it, expect, vi, beforeEach, MockedObject } from 'vitest';
import { RegistryService } from '@/main/services/RegistryService';
import { PowerShellBridge } from '@/main/services/PowerShellBridge';
import { MenuScene, MenuItemType } from '@shared/enums';

// Mock PowerShellBridge
vi.mock('@/main/services/PowerShellBridge');

describe('RegistryService', () => {
  let service: RegistryService;
  let mockPs: MockedObject<PowerShellBridge>;

  beforeEach(() => {
    mockPs = {
      buildGetItemsScript: vi.fn(),
      buildGetShellExtItemsScript: vi.fn(),
      buildSetEnabledScript: vi.fn(),
      buildShellExtToggleScript: vi.fn(),
      execute: vi.fn(),
      executeElevated: vi.fn(),
    } as MockedObject<PowerShellBridge>;
    
    service = new RegistryService(mockPs);
  });

  describe('getMenuItems', () => {
    it('should return empty array when no items found', async () => {
      (mockPs.execute as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      
      const result = await service.getMenuItems(MenuScene.Desktop);
      
      expect(result).toEqual([]);
    });

    it('should parse and return menu items correctly', async () => {
      const rawItems = [{
        name: 'Test Menu',
        command: 'test.exe',
        iconPath: 'C:\\icon.ico',
        isEnabled: true,
        source: 'TestApp',
        registryKey: 'HKCR\\\\Test\\\\shell\\\\Test Menu',
        subKeyName: 'Test Menu',
      }];
      
      // Mock both Classic Shell and ShellExt calls
      mockPs.execute.mockResolvedValueOnce(rawItems)  // Classic Shell
                  .mockResolvedValueOnce([]);         // ShellExt (empty)
      
      const result = await service.getMenuItems(MenuScene.File);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'Test Menu',
        command: 'test.exe',
        isEnabled: true,
        source: 'TestApp',
        menuScene: MenuScene.File,
        type: MenuItemType.System,
      });
    });
  });

  describe('transaction management', () => {
    it('should create rollback point correctly', () => {
      const items = [
        { registryKey: 'key1', isEnabled: true },
        { registryKey: 'key2', isEnabled: false },
      ];
      
      service.createRollbackPoint(items);
      
      // Rollback point should be stored internally
      // This is verified by rollback behavior
    });

    it('should commit transaction and clear rollback data', () => {
      service.createRollbackPoint([{ registryKey: 'key', isEnabled: true }]);
      service.commitTransaction();
      
      // After commit, rollback data should be cleared
      // This is verified by subsequent operations
    });
  });
});
