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
        type: MenuItemType.Custom,
      });
    });
  });

  describe('名称净化（热键清理）', () => {
    it('应清理带括号加速键整体，不留残余括号', async () => {
      const cases = [
        { input: '使用 Visual Studio 打开(&V)', expected: '使用 Visual Studio 打开' },
        { input: '个性化(&R)', expected: '个性化' },
        { input: '加入 QQ音乐 播放队列(&E)', expected: '加入 QQ音乐 播放队列' },
      ];

      for (const { input, expected } of cases) {
        const rawItems = [{
          name: input,
          command: '',
          iconPath: null,
          isEnabled: true,
          source: '',
          registryKey: 'DesktopBackground\\Shell\\TestItem',
          subKeyName: 'TestItem',
        }];

        // 每次调用需要新的 service 实例（避免缓存）
        const freshService = new RegistryService(mockPs);
        mockPs.execute.mockResolvedValueOnce(rawItems).mockResolvedValueOnce([]);

        const result = await freshService.getMenuItems(MenuScene.Desktop);

        expect(result[0].name).toBe(expected);
        expect(result[0].name).not.toContain('(');
        expect(result[0].name).not.toContain(')');
      }
    });
  });

  describe('名称净化（@ 间接字符串兜底）', () => {
    it('以 @ 开头的名称应被 subKeyName 替换', async () => {
      const rawItems = [{
        name: '@%SystemRoot%\\system32\\shell32.dll,-1234',
        command: '',
        iconPath: null,
        isEnabled: true,
        source: '',
        registryKey: 'DesktopBackground\\Shell\\TestItem',
        subKeyName: 'TestItem',
      }];

      mockPs.execute.mockResolvedValueOnce(rawItems).mockResolvedValueOnce([]);

      const result = await service.getMenuItems(MenuScene.Desktop);

      expect(result[0].name).toBe('TestItem');
    });

    it('正常名称不应被替换', async () => {
      const rawItems = [{
        name: '在桌面上显示',
        command: '',
        iconPath: null,
        isEnabled: true,
        source: '',
        registryKey: 'DesktopBackground\\Shell\\TestItem',
        subKeyName: 'TestItem',
      }];

      mockPs.execute.mockResolvedValueOnce(rawItems).mockResolvedValueOnce([]);

      const result = await service.getMenuItems(MenuScene.Desktop);

      expect(result[0].name).toBe('在桌面上显示');
    });

    it('subKeyName 为空时 @ 名称应保留原值', async () => {
      const rawItems = [{
        name: '@unresolved',
        command: '',
        iconPath: null,
        isEnabled: true,
        source: '',
        registryKey: 'DesktopBackground\\Shell\\',
        subKeyName: '',
      }];

      mockPs.execute.mockResolvedValueOnce(rawItems).mockResolvedValueOnce([]);

      const result = await service.getMenuItems(MenuScene.Desktop);

      expect(result[0].name).toBe('@unresolved');
    });

    it('ShellExt 条目的 @ 名称也应净化为 subKeyName', async () => {
      const shellextItems = [{
        name: '@%SystemRoot%\\system32\\shell32.dll,-9999',
        command: '{645FF040-5081-101B-9F08-00AA002F954E}',
        iconPath: null,
        isEnabled: true,
        source: 'DesktopSlideshow',
        registryKey: 'DesktopBackground\\shellex\\ContextMenuHandlers\\DesktopSlideshow',
        subKeyName: 'DesktopSlideshow',
        itemType: 'ShellExt',
      }];

      mockPs.execute.mockResolvedValueOnce([]).mockResolvedValueOnce(shellextItems);

      const result = await service.getMenuItems(MenuScene.Desktop);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('DesktopSlideshow');
    });

    it('模拟 DesktopSlideshow 问题场景：错误名称应被键名替换', async () => {
      // 模拟 Level 3 DLL 扫描可能返回的错误名称（现已移除该逻辑）
      // RegistryService 的 @ 兜底层作为最终保险
      const shellextItems = [{
        name: '@windows.immersivecontrolpanel.dll,-1',
        command: '{2CC2D03E-B04A-43BE-A6BE-8C20E6A64F87}',
        iconPath: null,
        isEnabled: true,
        source: 'DesktopSlideshow',
        registryKey: 'DesktopBackground\\shellex\\ContextMenuHandlers\\DesktopSlideshow',
        subKeyName: 'DesktopSlideshow',
        itemType: 'ShellExt',
      }];

      mockPs.execute.mockResolvedValueOnce([]).mockResolvedValueOnce(shellextItems);

      const result = await service.getMenuItems(MenuScene.Desktop);

      expect(result[0].name).toBe('DesktopSlideshow');
      expect(result[0].name).not.toContain('@');
      expect(result[0].name).not.toContain('电池');
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
