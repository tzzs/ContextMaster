import { describe, it, expect, vi, beforeEach, MockedObject } from 'vitest';
import { ipcMain } from 'electron';
import { registerRegistryHandlers } from '@/main/ipc/registry';
import { MenuManagerService } from '@/main/services/MenuManagerService';
import { MenuScene, MenuItemType, OperationType } from '@/shared/enums';
import { MenuItemEntry } from '@/shared/types';
import { IPC } from '@/shared/ipc-channels';

// Mock dependencies
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock('@/main/utils/ipcWrapper', () => ({
  wrapHandler: vi.fn((fn) => fn),
}));

describe('IPC Registry Handlers', () => {
  let mockMenuManager: MockedObject<MenuManagerService>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockMenuManager = {
      getMenuItems: vi.fn(),
      toggleItem: vi.fn(),
      batchEnable: vi.fn(),
      batchDisable: vi.fn(),
      invalidateCache: vi.fn(),
    } as MockedObject<MenuManagerService>;

    registerRegistryHandlers(mockMenuManager);
  });

  describe('REGISTRY_GET_ITEMS', () => {
    it('should register handler for getting menu items', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith(
        IPC.REGISTRY_GET_ITEMS,
        expect.any(Function)
      );
    });

    it('should call menuManager.getMenuItems with scene', async () => {
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
          type: MenuItemType.System,
        },
      ];
      vi.mocked(mockMenuManager.getMenuItems).mockResolvedValue(mockItems);

      // Get the registered handler
      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === IPC.REGISTRY_GET_ITEMS
      )?.[1] as Function;

      const result = await handler({}, MenuScene.Desktop);

      expect(mockMenuManager.getMenuItems).toHaveBeenCalledWith(MenuScene.Desktop);
      expect(result).toEqual(mockItems);
    });
  });

  describe('REGISTRY_TOGGLE', () => {
    it('should register handler for toggling menu item', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith(
        IPC.REGISTRY_TOGGLE,
        expect.any(Function)
      );
    });

    it('should toggle item and return new state', async () => {
      vi.mocked(mockMenuManager.toggleItem).mockResolvedValue({});

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === IPC.REGISTRY_TOGGLE
      )?.[1] as Function;

      const params = {
        name: 'Test Menu',
        isEnabled: false,
        menuScene: MenuScene.Desktop,
        registryKey: 'HKCR\\test',
        type: MenuItemType.System,
      };

      const result = await handler({}, params);

      expect(mockMenuManager.toggleItem).toHaveBeenCalled();
      expect(result).toEqual({ newState: true, newRegistryKey: undefined });
    });
  });

  describe('REGISTRY_BATCH', () => {
    it('should register handler for batch operations', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith(
        IPC.REGISTRY_BATCH,
        expect.any(Function)
      );
    });

    it('should batch enable items', async () => {
      vi.mocked(mockMenuManager.batchEnable).mockResolvedValue(undefined);

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === IPC.REGISTRY_BATCH
      )?.[1] as Function;

      const params = {
        items: [],
        enable: true,
      };

      const result = await handler({}, params);

      expect(mockMenuManager.batchEnable).toHaveBeenCalledWith(params.items);
      expect(result).toBe(true);
    });

    it('should batch disable items', async () => {
      vi.mocked(mockMenuManager.batchDisable).mockResolvedValue(undefined);

      const handler = vi.mocked(ipcMain.handle).mock.calls.find(
        call => call[0] === IPC.REGISTRY_BATCH
      )?.[1] as Function;

      const params = {
        items: [],
        enable: false,
      };

      const result = await handler({}, params);

      expect(mockMenuManager.batchDisable).toHaveBeenCalledWith(params.items);
      expect(result).toBe(true);
    });
  });
});
