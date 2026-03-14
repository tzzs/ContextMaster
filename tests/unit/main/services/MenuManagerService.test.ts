import { describe, it, expect, vi, beforeEach, MockedObject } from 'vitest';
import { MenuManagerService } from '@/main/services/MenuManagerService';
import { RegistryService } from '@/main/services/RegistryService';
import { OperationHistoryService } from '@/main/services/OperationHistoryService';
import { MenuScene, OperationType } from '@/shared/enums';
import { MenuItemEntry } from '@/shared/types';

// Mock dependencies
vi.mock('@/main/services/RegistryService');
vi.mock('@/main/services/OperationHistoryService');
vi.mock('@/main/utils/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('MenuManagerService', () => {
  let service: MenuManagerService;
  let mockRegistry: MockedObject<RegistryService>;
  let mockHistory: MockedObject<OperationHistoryService>;

  beforeEach(() => {
    mockRegistry = {
      getMenuItems: vi.fn(),
      setItemEnabled: vi.fn(),
      createRollbackPoint: vi.fn(),
      commitTransaction: vi.fn(),
      rollback: vi.fn(),
      invalidateCache: vi.fn(),
    } as MockedObject<RegistryService>;

    mockHistory = {
      recordOperation: vi.fn(),
    } as MockedObject<OperationHistoryService>;

    service = new MenuManagerService(mockRegistry, mockHistory);
  });

  describe('getMenuItems', () => {
    it('should return menu items from registry', async () => {
      const mockItems: MenuItemEntry[] = [
        {
          id: 1,
          name: 'Test Menu',
          command: 'test.exe',
          iconPath: null,
          isEnabled: true,
          source: 'TestApp',
          menuScene: MenuScene.Desktop,
          registryKey: 'HKCR\\test',
          type: 'System' as any,
        },
      ];
      vi.mocked(mockRegistry.getMenuItems).mockResolvedValue(mockItems);

      const result = await service.getMenuItems(MenuScene.Desktop);

      expect(mockRegistry.getMenuItems).toHaveBeenCalledWith(MenuScene.Desktop);
      expect(result).toEqual(mockItems);
    });
  });

  describe('enableItem', () => {
    it('should enable a disabled item', async () => {
      const item: MenuItemEntry = {
        id: 1,
        name: 'Test Menu',
        command: 'test.exe',
        iconPath: null,
        isEnabled: false,
        source: 'TestApp',
        menuScene: MenuScene.Desktop,
        registryKey: 'HKCR\\test',
        type: 'System' as any,
      };
      vi.mocked(mockRegistry.setItemEnabled).mockResolvedValue({});

      await service.enableItem(item);

      expect(mockRegistry.setItemEnabled).toHaveBeenCalledWith(item.registryKey, true);
      expect(item.isEnabled).toBe(true);
      expect(mockHistory.recordOperation).toHaveBeenCalledWith(
        OperationType.Enable,
        item.name,
        item.registryKey,
        'false',
        'true'
      );
    });

    it('should not enable already enabled item', async () => {
      const item: MenuItemEntry = {
        id: 1,
        name: 'Test Menu',
        command: 'test.exe',
        iconPath: null,
        isEnabled: true,
        source: 'TestApp',
        menuScene: MenuScene.Desktop,
        registryKey: 'HKCR\\test',
        type: 'System' as any,
      };

      await service.enableItem(item);

      expect(mockRegistry.setItemEnabled).not.toHaveBeenCalled();
    });
  });

  describe('disableItem', () => {
    it('should disable an enabled item', async () => {
      const item: MenuItemEntry = {
        id: 1,
        name: 'Test Menu',
        command: 'test.exe',
        iconPath: null,
        isEnabled: true,
        source: 'TestApp',
        menuScene: MenuScene.Desktop,
        registryKey: 'HKCR\\test',
        type: 'System' as any,
      };
      vi.mocked(mockRegistry.setItemEnabled).mockResolvedValue({});

      await service.disableItem(item);

      expect(mockRegistry.setItemEnabled).toHaveBeenCalledWith(item.registryKey, false);
      expect(item.isEnabled).toBe(false);
      expect(mockHistory.recordOperation).toHaveBeenCalledWith(
        OperationType.Disable,
        item.name,
        item.registryKey,
        'true',
        'false'
      );
    });

    it('should not disable already disabled item', async () => {
      const item: MenuItemEntry = {
        id: 1,
        name: 'Test Menu',
        command: 'test.exe',
        iconPath: null,
        isEnabled: false,
        source: 'TestApp',
        menuScene: MenuScene.Desktop,
        registryKey: 'HKCR\\test',
        type: 'System' as any,
      };

      await service.disableItem(item);

      expect(mockRegistry.setItemEnabled).not.toHaveBeenCalled();
    });
  });

  describe('toggleItem', () => {
    it('should disable enabled item', async () => {
      const item: MenuItemEntry = {
        id: 1,
        name: 'Test Menu',
        command: 'test.exe',
        iconPath: null,
        isEnabled: true,
        source: 'TestApp',
        menuScene: MenuScene.Desktop,
        registryKey: 'HKCR\\test',
        type: 'System' as any,
      };
      vi.mocked(mockRegistry.setItemEnabled).mockResolvedValue({});

      await service.toggleItem(item);

      expect(mockRegistry.setItemEnabled).toHaveBeenCalledWith(item.registryKey, false);
    });

    it('should enable disabled item', async () => {
      const item: MenuItemEntry = {
        id: 1,
        name: 'Test Menu',
        command: 'test.exe',
        iconPath: null,
        isEnabled: false,
        source: 'TestApp',
        menuScene: MenuScene.Desktop,
        registryKey: 'HKCR\\test',
        type: 'System' as any,
      };
      vi.mocked(mockRegistry.setItemEnabled).mockResolvedValue({});

      await service.toggleItem(item);

      expect(mockRegistry.setItemEnabled).toHaveBeenCalledWith(item.registryKey, true);
    });
  });

  describe('batchEnable', () => {
    it('should enable multiple items with transaction', async () => {
      const items: MenuItemEntry[] = [
        {
          id: 1,
          name: 'Menu 1',
          command: 'test1.exe',
          iconPath: null,
          isEnabled: false,
          source: 'TestApp',
          menuScene: MenuScene.Desktop,
          registryKey: 'HKCR\\test1',
          type: 'System' as any,
        },
        {
          id: 2,
          name: 'Menu 2',
          command: 'test2.exe',
          iconPath: null,
          isEnabled: false,
          source: 'TestApp',
          menuScene: MenuScene.Desktop,
          registryKey: 'HKCR\\test2',
          type: 'System' as any,
        },
      ];
      vi.mocked(mockRegistry.setItemEnabled).mockResolvedValue({});

      await service.batchEnable(items);

      expect(mockRegistry.createRollbackPoint).toHaveBeenCalled();
      expect(mockRegistry.setItemEnabled).toHaveBeenCalledTimes(2);
      expect(mockRegistry.commitTransaction).toHaveBeenCalled();
      expect(items[0].isEnabled).toBe(true);
      expect(items[1].isEnabled).toBe(true);
    });

    it('should rollback on error', async () => {
      const items: MenuItemEntry[] = [
        {
          id: 1,
          name: 'Menu 1',
          command: 'test1.exe',
          iconPath: null,
          isEnabled: false,
          source: 'TestApp',
          menuScene: MenuScene.Desktop,
          registryKey: 'HKCR\\test1',
          type: 'System' as any,
        },
      ];
      vi.mocked(mockRegistry.setItemEnabled).mockRejectedValue(new Error('Test error'));
      vi.mocked(mockRegistry.rollback).mockResolvedValue(undefined);

      await expect(service.batchEnable(items)).rejects.toThrow('批量启用失败，已回滚');
      expect(mockRegistry.rollback).toHaveBeenCalled();
    });

    it('should do nothing if all items already enabled', async () => {
      const items: MenuItemEntry[] = [
        {
          id: 1,
          name: 'Menu 1',
          command: 'test1.exe',
          iconPath: null,
          isEnabled: true,  // Already enabled
          source: 'TestApp',
          menuScene: MenuScene.Desktop,
          registryKey: 'HKCR\\test1',
          type: 'System' as any,
        },
      ];

      await service.batchEnable(items);

      expect(mockRegistry.setItemEnabled).not.toHaveBeenCalled();
    });
  });

  describe('batchDisable', () => {
    it('should disable multiple items with transaction', async () => {
      const items: MenuItemEntry[] = [
        {
          id: 1,
          name: 'Menu 1',
          command: 'test1.exe',
          iconPath: null,
          isEnabled: true,
          source: 'TestApp',
          menuScene: MenuScene.Desktop,
          registryKey: 'HKCR\\test1',
          type: 'System' as any,
        },
        {
          id: 2,
          name: 'Menu 2',
          command: 'test2.exe',
          iconPath: null,
          isEnabled: true,
          source: 'TestApp',
          menuScene: MenuScene.Desktop,
          registryKey: 'HKCR\\test2',
          type: 'System' as any,
        },
      ];
      vi.mocked(mockRegistry.setItemEnabled).mockResolvedValue({});

      await service.batchDisable(items);

      expect(mockRegistry.createRollbackPoint).toHaveBeenCalled();
      expect(mockRegistry.setItemEnabled).toHaveBeenCalledTimes(2);
      expect(mockRegistry.commitTransaction).toHaveBeenCalled();
      expect(items[0].isEnabled).toBe(false);
      expect(items[1].isEnabled).toBe(false);
    });

    it('should rollback on error', async () => {
      const items: MenuItemEntry[] = [
        {
          id: 1,
          name: 'Menu 1',
          command: 'test1.exe',
          iconPath: null,
          isEnabled: true,
          source: 'TestApp',
          menuScene: MenuScene.Desktop,
          registryKey: 'HKCR\\test1',
          type: 'System' as any,
        },
      ];
      vi.mocked(mockRegistry.setItemEnabled).mockRejectedValue(new Error('Test error'));
      vi.mocked(mockRegistry.rollback).mockResolvedValue(undefined);

      await expect(service.batchDisable(items)).rejects.toThrow('批量禁用失败，已回滚');
      expect(mockRegistry.rollback).toHaveBeenCalled();
    });

    it('should do nothing if all items already disabled', async () => {
      const items: MenuItemEntry[] = [
        {
          id: 1,
          name: 'Menu 1',
          command: 'test1.exe',
          iconPath: null,
          isEnabled: false,  // Already disabled
          source: 'TestApp',
          menuScene: MenuScene.Desktop,
          registryKey: 'HKCR\\test1',
          type: 'System' as any,
        },
      ];

      await service.batchDisable(items);

      expect(mockRegistry.setItemEnabled).not.toHaveBeenCalled();
    });
  });
});
