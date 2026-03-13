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

    it('Resolve-MenuName 不应包含热键清理 -replace（热键清理已移至 TS 层）', () => {
      const script = bridge.buildGetItemsScript('DesktopBackground\\Shell');

      // 提取 Resolve-MenuName 函数体，确认不含 -replace 热键正则
      const fnMatch = script.match(/function Resolve-MenuName[\s\S]*?\n\}/);
      expect(fnMatch).not.toBeNull();
      const fnBody = fnMatch![0];
      expect(fnBody).not.toContain('-replace');
    });

    it('名称检测链应包含 LocalizedDisplayName 作为第三优先级', () => {
      const script = bridge.buildGetItemsScript('DesktopBackground\\Shell');

      expect(script).toContain("GetValue('LocalizedDisplayName')");
      // 顺序：MUIVerb → Default → LocalizedDisplayName → 键名
      const muiIdx = script.indexOf("GetValue('MUIVerb')");
      const defIdx = script.indexOf("GetValue('')");
      const localIdx = script.indexOf("GetValue('LocalizedDisplayName')");
      const fallbackIdx = script.indexOf('$name = $keyName');

      expect(localIdx).toBeGreaterThan(defIdx);
      expect(fallbackIdx).toBeGreaterThan(localIdx);
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

    it('不应包含 DLL VersionInfo 字段（已移除 FileVersionInfo 级别）', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).not.toContain('InternalName');
      expect(script).not.toContain('OriginalFilename');
      expect(script).not.toContain('FileDescription');
      expect(script).not.toContain('FileVersionInfo');
    });

    it('不应以 foreach 遍历 VersionInfo 字段（DLL VersionInfo 已移除）', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).not.toContain('FileVersionInfo');
      expect(script).not.toContain('ProductName');
    });

    it('应将 CLSID Default 值作为 Level 2 兜底', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).toContain('Level 2: CLSID 默认值');
      expect(script).not.toContain('Level 3: CLSID');
    });

    it('Format-DisplayName 不应包含热键清理正则（热键清理已移至 TS 层）', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      // Format-DisplayName 函数体不应包含 -replace 热键正则
      const fnMatch = script.match(/function Format-DisplayName[\s\S]*?\n\}/);
      expect(fnMatch).not.toBeNull();
      const fnBody = fnMatch![0];
      expect(fnBody).not.toContain('-replace');
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

    it('应包含 Level 1.5 MUIVerb 解析，位于 LocalizedString 与 CLSID Default 之间', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).toContain('MUIVerb');
      expect(script).toContain('Level 1.5: MUIVerb');

      const localizedIdx = script.indexOf('LocalizedString');
      const muiVerbIdx   = script.indexOf('Level 1.5: MUIVerb');
      const level2Idx    = script.indexOf('Level 2: CLSID 默认值');

      expect(muiVerbIdx).toBeGreaterThan(localizedIdx);
      expect(level2Idx).toBeGreaterThan(muiVerbIdx);
    });

    it('应读取 InprocServer32 DLL 路径并输出 dllPath 字段', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).toContain('InprocServer32');
      expect(script).toContain('ExpandEnvironmentVariables');
      expect(script).toContain('dllPath');
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
