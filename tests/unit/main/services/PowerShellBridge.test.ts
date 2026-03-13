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

    it('应读取 MUIVerb 作为首选名称', () => {
      const script = bridge.buildGetItemsScript('DesktopBackground\\Shell');

      expect(script).toContain("GetValue('MUIVerb')");
    });

    it('应包含 Resolve-MenuName 函数用于解析间接字符串', () => {
      const script = bridge.buildGetItemsScript('DesktopBackground\\Shell');

      expect(script).toContain('Resolve-MenuName');
      expect(script).toContain("match '^@'");
    });

    it('应包含 CmShell Add-Type 以调用 SHLoadIndirectString', () => {
      const script = bridge.buildGetItemsScript('DesktopBackground\\Shell');

      expect(script).toContain('CmShell');
      expect(script).toContain('SHLoadIndirectString');
    });

    it('名称回退顺序：MUIVerb → Default → 键名', () => {
      const script = bridge.buildGetItemsScript('*\\shell');

      // MUIVerb 先被尝试
      const muiVerbIdx = script.indexOf("GetValue('MUIVerb')");
      // Default 次之
      const defaultIdx = script.indexOf("GetValue('')");
      // 键名最后
      const fallbackIdx = script.indexOf('$name = $keyName');

      expect(muiVerbIdx).toBeGreaterThan(0);
      expect(defaultIdx).toBeGreaterThan(muiVerbIdx);
      expect(fallbackIdx).toBeGreaterThan(defaultIdx);
    });

    it('应将正确的注册表路径嵌入脚本', () => {
      const script = bridge.buildGetItemsScript('*\\shell');
      // 模板字面量中 \\ 在 PS 脚本里生成单个 \，所以检查单反斜杠路径
      expect(script).toContain('HKCR:\\*\\shell');
    });
  });

  describe('buildGetShellExtItemsScript', () => {
    it('不应包含 ReadDllStrings（已移除 DLL 字符串扫描）', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).not.toContain('ReadDllStrings');
      expect(script).not.toContain('LoadLibraryEx');
      expect(script).not.toContain('LOAD_AS_DATA');
    });

    it('不应包含 1-500 范围的字符串表扫描', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).not.toContain('1, 500');
      expect(script).not.toContain('ReadDllStrings');
    });

    it('Level 2 应包含 InternalName 和 OriginalFilename', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).toContain('InternalName');
      expect(script).toContain('OriginalFilename');
    });

    it('Level 2 应以 foreach 遍历多个 VersionInfo 字段', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).toContain('foreach');
      expect(script).toContain('FileDescription');
      expect(script).toContain('ProductName');
    });

    it('应将 CLSID Default 值作为 Level 3 兜底（而非 Level 4）', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).toContain('Level 3: CLSID 默认值');
      expect(script).not.toContain('Level 4: CLSID');
    });

    it('CmHelper 源码中不应包含 ReadDllStrings 方法', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      // 源码里不再有 ReadDllStrings 定义
      expect(script).not.toMatch(/public static string\[\] ReadDllStrings/);
    });

    it('应包含 Level 1 LocalizedString/FriendlyTypeName 解析', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).toContain('LocalizedString');
      expect(script).toContain('FriendlyTypeName');
    });

    it('应包含友好名称映射表', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).toContain('friendlyNames');
      expect(script).toContain('Windows Defender');
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
