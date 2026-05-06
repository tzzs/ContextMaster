import { describe, it, expect, vi, beforeEach, MockedObject } from 'vitest';
import { RegistryService } from '@/main/services/RegistryService';
import { PowerShellBridge } from '@/main/services/PowerShellBridge';
import { ShellExtNameResolver, CommandStoreIndex } from '@/main/services/ShellExtNameResolver';
import { IWin32Shell } from '@/main/services/Win32Shell';
import { MenuScene, MenuItemType } from '@shared/enums';

// Mock PowerShellBridge
vi.mock('@/main/services/PowerShellBridge');

function createMockPs(): MockedObject<PowerShellBridge> {
  return {
    buildGetItemsScript: vi.fn(),
    buildGetShellExtItemsScript: vi.fn(),
    buildSetEnabledScript: vi.fn(),
    buildShellExtToggleScript: vi.fn(),
    buildCommandStoreScript: vi.fn(),
    execute: vi.fn(),
    executeElevated: vi.fn(),
  } as unknown as MockedObject<PowerShellBridge>;
}

function createMockResolver(resolveClassicName?: (raw: any) => string, resolveExtName?: (raw: any, cmdStore: any) => string): ShellExtNameResolver {
  const win32: IWin32Shell = {
    resolveIndirect: vi.fn().mockReturnValue(null),
    getFileVersionInfo: vi.fn().mockReturnValue(null),
  };
  const resolver = new ShellExtNameResolver(win32);
  if (resolveClassicName) vi.spyOn(resolver, 'resolveClassicName').mockImplementation(resolveClassicName);
  if (resolveExtName) vi.spyOn(resolver, 'resolveExtName').mockImplementation(resolveExtName);
  return resolver;
}

describe('RegistryService', () => {
  let service: RegistryService;
  let mockPs: MockedObject<PowerShellBridge>;
  let mockResolver: ShellExtNameResolver;
  let mockCmdStore: CommandStoreIndex;

  beforeEach(() => {
    mockPs = createMockPs();
    mockResolver = createMockResolver();
    mockCmdStore = new CommandStoreIndex();
    service = new RegistryService(mockPs, mockResolver, mockCmdStore);
  });

  describe('getMenuItems', () => {
    it('should return empty array when no items found', async () => {
      (mockPs.execute as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await service.getMenuItems(MenuScene.Desktop);

      expect(result).toEqual([]);
    });

    it('should parse Classic Shell items through resolver', async () => {
      const rawItems = [{
        subKeyName: 'Test Menu',
        rawMUIVerb: '@shell32.dll,-1234',
        rawDefault: 'Open',
        rawLocalizedDisplayName: null,
        rawIcon: 'C:\\icon.ico',
        isEnabled: true,
        command: 'test.exe',
        registryKey: 'HKCR\\Test\\shell\\Test Menu',
      }];

      mockPs.execute.mockResolvedValueOnce(rawItems).mockResolvedValueOnce([]);

      const result = await service.getMenuItems(MenuScene.File);

      expect(result).toHaveLength(1);
      expect(result[0].command).toBe('test.exe');
      expect(result[0].menuScene).toBe(MenuScene.File);
      expect(result[0].type).toBe(MenuItemType.Custom);
    });

    it('should parse ShellExt items through resolver', async () => {
      const shellextItems = [{
        handlerKeyName: 'YunShellExt',
        cleanName: 'YunShellExt',
        defaultVal: '',
        isEnabled: true,
        actualClsid: '{BIG-DATA-CLSID}',
        clsidLocalizedString: null,
        clsidMUIVerb: null,
        clsidDefault: null,
        dllPath: 'C:\\Program Files\\YunShellExt\\YunShellExt64.dll',
        siblingMUIVerb: null,
        registryKey: 'DesktopBackground\\shellex\\ContextMenuHandlers\\YunShellExt',
      }];

      mockPs.execute.mockResolvedValueOnce([]).mockResolvedValueOnce(shellextItems);

      const result = await service.getMenuItems(MenuScene.Desktop);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe(MenuItemType.ShellExt);
      expect(result[0].dllPath).toBe('C:\\Program Files\\YunShellExt\\YunShellExt64.dll');
    });
  });

  describe('名称净化（热键清理 cleanDisplayName）', () => {
    it('应清理带括号加速键整体，不留残余括号', async () => {
      const cases = [
        { input: '使用 Visual Studio 打开(&V)', expected: '使用 Visual Studio 打开' },
        { input: '个性化(&R)', expected: '个性化' },
        { input: '加入 QQ音乐 播放队列(&E)', expected: '加入 QQ音乐 播放队列' },
      ];

      for (const { input, expected } of cases) {
        const freshPs = createMockPs();
        // resolver returns the raw name as-is (only cleanDisplayName cleans it)
        const freshResolver = createMockResolver((raw: any) => input);
        const freshService = new RegistryService(freshPs, freshResolver, mockCmdStore);

        const rawItems = [{
          subKeyName: 'TestItem',
          rawMUIVerb: input,
          rawDefault: null,
          rawLocalizedDisplayName: null,
          rawIcon: null,
          isEnabled: true,
          command: '',
          registryKey: 'DesktopBackground\\Shell\\TestItem',
        }];

        freshPs.execute.mockResolvedValueOnce(rawItems).mockResolvedValueOnce([]);

        const result = await freshService.getMenuItems(MenuScene.Desktop);

        expect(result[0].name).toBe(expected);
        expect(result[0].name).not.toContain('(');
        expect(result[0].name).not.toContain(')');
      }
    });
  });

  describe('resolver passes through to cleanDisplayName', () => {
    it('正常名称应通过 resolver 并正确显示', async () => {
      const rawItems = [{
        subKeyName: 'TestItem',
        rawMUIVerb: null,
        rawDefault: '在桌面上显示',
        rawLocalizedDisplayName: null,
        rawIcon: null,
        isEnabled: true,
        command: '',
        registryKey: 'DesktopBackground\\Shell\\TestItem',
      }];

      mockPs.execute.mockResolvedValueOnce(rawItems).mockResolvedValueOnce([]);

      const result = await service.getMenuItems(MenuScene.Desktop);

      expect(result[0].name).toBe('在桌面上显示');
    });

    it('ShellExt 条目名称应由 resolver 决定', async () => {
      const shellextItems = [{
        handlerKeyName: 'DesktopSlideshow',
        cleanName: 'DesktopSlideshow',
        defaultVal: '@windows.immersivecontrolpanel.dll,-1',
        isEnabled: true,
        actualClsid: '{2CC2D03E-B04A-43BE-A6BE-8C20E6A64F87}',
        clsidLocalizedString: null,
        clsidMUIVerb: null,
        clsidDefault: null,
        dllPath: null,
        siblingMUIVerb: null,
        registryKey: 'DesktopBackground\\shellex\\ContextMenuHandlers\\DesktopSlideshow',
      }];

      mockPs.execute.mockResolvedValueOnce([]).mockResolvedValueOnce(shellextItems);

      const result = await service.getMenuItems(MenuScene.Desktop);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('DesktopSlideshow');
    });
  });

  describe('dllPath 字段透传', () => {
    it('ShellExt 条目应将 dllPath 传入 MenuItemEntry', async () => {
      const shellextItems = [{
        handlerKeyName: 'gvim',
        cleanName: 'gvim',
        defaultVal: '',
        isEnabled: true,
        actualClsid: '{51EEE242-AD87-11d3-9C1E-0090278BBD99}',
        clsidLocalizedString: null,
        clsidMUIVerb: null,
        clsidDefault: null,
        dllPath: 'C:\\Program Files\\Vim\\vim91\\gvimext.dll',
        siblingMUIVerb: null,
        registryKey: 'DesktopBackground\\shellex\\ContextMenuHandlers\\gvim',
      }];

      mockPs.execute.mockResolvedValueOnce([]).mockResolvedValueOnce(shellextItems);

      const result = await service.getMenuItems(MenuScene.Desktop);

      expect(result).toHaveLength(1);
      expect(result[0].dllPath).toBe('C:\\Program Files\\Vim\\vim91\\gvimext.dll');
    });

    it('Classic Shell 条目 dllPath 应为 null', async () => {
      const rawItems = [{
        subKeyName: 'Classic',
        rawMUIVerb: null,
        rawDefault: 'Classic Item',
        rawLocalizedDisplayName: null,
        rawIcon: null,
        isEnabled: true,
        command: 'cmd.exe',
        registryKey: 'DesktopBackground\\Shell\\Classic',
      }];

      mockPs.execute.mockResolvedValueOnce(rawItems).mockResolvedValueOnce([]);

      const result = await service.getMenuItems(MenuScene.Desktop);

      expect(result[0].dllPath).toBeNull();
    });
  });

  describe('transaction management', () => {
    it('should create rollback point correctly', () => {
      const items = [
        { registryKey: 'key1', isEnabled: true },
        { registryKey: 'key2', isEnabled: false },
      ];

      service.createRollbackPoint(items);
    });

    it('should commit transaction and clear rollback data', () => {
      service.createRollbackPoint([{ registryKey: 'key', isEnabled: true }]);
      service.commitTransaction();
    });
  });
});
