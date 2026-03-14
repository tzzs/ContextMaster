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

    it('仅使用 FileDescription/ProductName，不扫描 InternalName/OriginalFilename', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).not.toContain('InternalName');
      expect(script).not.toContain('OriginalFilename');
    });

    it('Level 2.5 使用 FileVersionInfo::GetVersionInfo，不遍历所有字段', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).toContain('FileVersionInfo');
      expect(script).toContain('ProductName');
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

      // Level 1.5 MUIVerb 应调用 Test-IsGenericName 过滤
      expect(script).toMatch(/Level 1\.5[\s\S]{0,600}Test-IsGenericName/);
    });

    it('Level 1.5 MUIVerb 和 Level 2 CLSID Default 应过滤泛型描述', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      // Level 1.5 MUIVerb 非间接分支调用 Test-IsGenericName
      const level15Start = script.indexOf('Level 1.5:');
      const level17Start = script.indexOf('Level 1.7:');
      const muiVerbBlock = script.slice(level15Start, level17Start);
      expect(muiVerbBlock).toContain('Test-IsGenericName');

      // Level 2 Default 调用 Test-IsGenericName
      const level2Start = script.indexOf('Level 2:');
      const level25Start = script.indexOf('Level 2.5:');
      const level2Block = script.slice(level2Start, level25Start);
      expect(level2Block).toContain('Test-IsGenericName');
    });

    it('应读取 InprocServer32 DLL 路径并输出 dllPath 字段', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).toContain('InprocServer32');
      expect(script).toContain('ExpandEnvironmentVariables');
      expect(script).toContain('dllPath');
    });

    it('不应包含硬编码 friendlyNames 映射表（已移除，让 SHLoadIndirectString 自动本地化）', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).not.toContain('$friendlyNames');
      expect(script).not.toContain('friendlyNames.ContainsKey');
    });

    it('Resolve-ExtName 应支持可选 $directName 参数作为 Level 0', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).toContain('$directName = $null');
      expect(script).toContain('Level 0: directName');
      // Level 0（间接格式）的位置应在 Level 1 LocalizedString 之前
      const level0Idx = script.indexOf('Level 0: directName');
      const level1Idx = script.indexOf('Level 1: LocalizedString');
      expect(level0Idx).toBeGreaterThan(0);
      expect(level1Idx).toBeGreaterThan(level0Idx);
    });

    it('plain string directName 应降级到 CLSID 查询链之后（Level 3）', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).toContain('Level 3: directName');
      // Level 3 注释必须在 Level 2 之后
      const level2Idx = script.indexOf('Level 2: CLSID 默认值');
      const level3Idx = script.indexOf('Level 3: directName');
      expect(level2Idx).toBeGreaterThan(0);
      expect(level3Idx).toBeGreaterThan(level2Idx);
    });

    it('应预建 CommandStore 反向索引并在 Level 1.7 查找', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      // 预建索引存在
      expect(script).toContain('cmdStoreVerbs');
      expect(script).toContain('CommandStore');
      expect(script).toContain('ExplorerCommandHandler');
      // Level 1.7 存在且位于 Level 1.5 与 Level 2 之间
      const level15Idx = script.indexOf('Level 1.5:');
      const level17Idx = script.indexOf('Level 1.7:');
      const level2Idx  = script.indexOf('Level 2: CLSID 默认值');
      expect(level17Idx).toBeGreaterThan(level15Idx);
      expect(level2Idx).toBeGreaterThan(level17Idx);
    });

    it('CmHelper.ResolveIndirect 应支持 ms-resource: 前缀', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).toContain('ms-resource:');
      expect(script).toContain('!s.StartsWith("ms-resource:")');
    });

    it('LocalizedString 和 MUIVerb 应同时检查 @ 和 ms-resource: 前缀', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).toMatch(/StartsWith\('@'\)\s*-or\s*\$\w+\.StartsWith\('ms-resource:'\)/);
    });

    it('ForEach 循环应使用 $actualClsid 分离 CLSID 与 Default 值', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).toContain('$actualClsid');
      expect(script).toContain('$defaultVal');
      // command 字段应使用 $actualClsid，而非旧的 $clsid
      expect(script).toContain('command     = [string]$actualClsid');
    });

    it('应包含 Test-IsGenericName 函数定义，位于 Resolve-ExtName 之前', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      const testFnIdx    = script.indexOf('function Test-IsGenericName');
      const resolveFnIdx = script.indexOf('function Resolve-ExtName');
      expect(testFnIdx).toBeGreaterThan(0);
      expect(resolveFnIdx).toBeGreaterThan(testFnIdx);
    });

    it('Test-IsGenericName 应包含 context\\s*menu、class 后缀和占位符过滤模式', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      const fnStart = script.indexOf('function Test-IsGenericName');
      const fnEnd   = script.indexOf('function Resolve-ExtName');
      const fnBody  = script.slice(fnStart, fnEnd);
      expect(fnBody).toContain("context\\s*menu");   // Case 1: Quark AI Context Menu
      expect(fnBody).toContain("\\s+class$");         // Case 2: PcyybContextnMenu Class
      expect(fnBody).toContain("^todo:");              // Case 3: TODO: <File description>
      expect(fnBody).toContain("<[^>]+>");             // Case 3: <placeholder>
    });

    it('Level 2.5 应调用 Test-IsGenericName 且保留长度上限 -le 64', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      const level25Start = script.indexOf('Level 2.5:');
      const level3Start  = script.indexOf('Level 3: directName');
      const block = script.slice(level25Start, level3Start);
      expect(block).toContain('Test-IsGenericName');
      expect(block).toContain('-le 64');
    });

    it('InprocServer32 DLL FileDescription/ProductName 应作为 Level 2.5', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      // Level 2.5 注释存在
      expect(script).toContain('Level 2.5:');
      // 使用 FileVersionInfo::GetVersionInfo
      expect(script).toContain('FileVersionInfo]::GetVersionInfo');
      // 包含过滤关键词
      expect(script).toMatch(/shell.*extension/i);
      expect(script).toMatch(/context.*menu/i);
      // Level 2.5 位于 Level 2 之后、Level 3 之前
      const level2Idx  = script.indexOf('Level 2: CLSID 默认值');
      const level25Idx = script.indexOf('Level 2.5:');
      const level3Idx  = script.indexOf('Level 3: directName');
      expect(level25Idx).toBeGreaterThan(level2Idx);
      expect(level3Idx).toBeGreaterThan(level25Idx);
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
