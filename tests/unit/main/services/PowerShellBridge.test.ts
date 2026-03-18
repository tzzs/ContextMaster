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

    it('应通过 CmHelper 调用 SHLoadIndirectString（复用缓存 DLL，不再内联编译）', () => {
      const script = bridge.buildGetItemsScript('DesktopBackground\\Shell');

      expect(script).toContain('CmHelper');
      expect(script).toContain('SHLoadIndirectString');
      expect(script).not.toContain('CmShell');
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

    it('"Quark AI Context Menu" 不应被泛型名过滤器误判', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      // 新规则采用首锚 ^，确认 fnBody 中 context 规则已添加锚点
      const fnStart = script.indexOf('function Test-IsGenericName');
      const fnEnd   = script.indexOf('function Resolve-ExtName');
      const fnBody  = script.slice(fnStart, fnEnd);
      expect(fnBody).toMatch(/\^.*context.*menu/i);

      // 用 JS 模拟新正则：带前缀的产品名不应被匹配
      const ctxRegex = /^(context|ctx)\s*menu(\s*(handler|ext(ension)?|provider|manager))?$/i;
      expect(ctxRegex.test('quark ai context menu')).toBe(false);
      expect(ctxRegex.test('context menu')).toBe(true);
      expect(ctxRegex.test('context menu handler')).toBe(true);
    });

    it('"* Shell Extension" 后缀应被识别为 COM 类描述并过滤', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      // 确认新增的 shell\s+extension$ 规则存在于 Test-IsGenericName 中
      const fnStart = script.indexOf('function Test-IsGenericName');
      const fnEnd   = script.indexOf('function Test-IsUselessPlain');
      const fnBody  = script.slice(fnStart, fnEnd);
      expect(fnBody).toMatch(/shell\\s\+extension\$/);

      // 用 JS 模拟：以 "shell extension" 结尾的值应被过滤（COM 类描述，非用户可见名）
      const shellExtSuffixRegex = /shell\s+extension$/i;
      expect(shellExtSuffixRegex.test('vim shell extension')).toBe(true);    // 过滤 → 回退到 "gvim"
      expect(shellExtSuffixRegex.test('winrar shell extension')).toBe(true); // 过滤 → 回退到 "WinRAR"
      expect(shellExtSuffixRegex.test('shell extension')).toBe(true);        // 过滤

      // 不误杀不以 "shell extension" 结尾的产品名
      expect(shellExtSuffixRegex.test('winrar')).toBe(false);
      expect(shellExtSuffixRegex.test('quark ai context menu')).toBe(false);
      expect(shellExtSuffixRegex.test('百度网盘')).toBe(false);
    });

    it('CmHelper 源码应包含 GetLocalizedVerStrings 方法', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).toContain('GetLocalizedVerStrings');
      expect(script).toContain('GetFileVersionInfoSize');
      expect(script).toContain('VarFileInfo');
    });

    it('Level 2.5 应优先使用 GetLocalizedVerStrings，并以 FileVersionInfo 作为 fallback', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      const level25Start = script.indexOf('Level 2.5:');
      const level3Start  = script.indexOf('Level 3: directName');
      const block = script.slice(level25Start, level3Start);

      expect(block).toContain('GetLocalizedVerStrings');
      expect(block).toContain('FileVersionInfo]::GetVersionInfo');
      // GetLocalizedVerStrings 应在 FileVersionInfo 之前（作为主路径）
      expect(block.indexOf('GetLocalizedVerStrings')).toBeLessThan(
        block.indexOf('FileVersionInfo]::GetVersionInfo')
      );
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

      // Level 1.5 MUIVerb 应调用 Test-IsUselessPlain 过滤（统一替换内联条件）
      expect(script).toMatch(/Level 1\.5[\s\S]{0,600}Test-IsUselessPlain/);
    });

    it('Level 1.5 MUIVerb 和 Level 2 CLSID Default 应过滤泛型描述', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      // Level 1.5 MUIVerb 非间接分支调用 Test-IsUselessPlain（统一替换内联条件）
      const level15Start = script.indexOf('Level 1.5:');
      const level17Start = script.indexOf('Level 1.7:');
      const muiVerbBlock = script.slice(level15Start, level17Start);
      expect(muiVerbBlock).toContain('Test-IsUselessPlain');

      // Level 2 Default 调用 Test-IsUselessPlain
      const level2Start = script.indexOf('Level 2:');
      const level25Start = script.indexOf('Level 2.5:');
      const level2Block = script.slice(level2Start, level25Start);
      expect(level2Block).toContain('Test-IsUselessPlain');
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

    it('应包含 Test-IsUselessPlain 函数，位于 Test-IsGenericName 之后、Resolve-ExtName 之前', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      const genericFnIdx  = script.indexOf('function Test-IsGenericName');
      const uselessFnIdx  = script.indexOf('function Test-IsUselessPlain');
      const resolveFnIdx  = script.indexOf('function Resolve-ExtName');
      expect(uselessFnIdx).toBeGreaterThan(genericFnIdx);
      expect(resolveFnIdx).toBeGreaterThan(uselessFnIdx);
    });

    it('Test-IsUselessPlain 应使用 -ieq 判断值等于键名（而非 -ine）', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      const fnStart = script.indexOf('function Test-IsUselessPlain');
      const fnEnd   = script.indexOf('function Resolve-ExtName');
      const fnBody  = script.slice(fnStart, fnEnd);
      expect(fnBody).toContain('-ieq $fallback');
      expect(fnBody).toContain('Test-IsGenericName');
    });

    it('Test-IsGenericName 应包含首锚 context/ctx 规则、class 后缀和占位符过滤模式', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      const fnStart = script.indexOf('function Test-IsGenericName');
      const fnEnd   = script.indexOf('function Resolve-ExtName');
      const fnBody  = script.slice(fnStart, fnEnd);
      // 新规则采用首锚 ^，context/ctx 规则中含首锚和 context|ctx 分组
      expect(fnBody).toMatch(/\^.*context.*ctx.*menu/);   // Case 1: 首锚 context/ctx 规则
      expect(fnBody).toContain("\\s+class$");              // Case 2: PcyybContextnMenu Class
      expect(fnBody).toContain("^todo:");                  // Case 3: TODO: <File description>
      expect(fnBody).toContain("<[^>]+>");                 // Case 3: <placeholder>
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

    it('Level 1 plain string 等于 fallback（键名）时应跳过，让 Level 2.5 执行', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      // Level 1 plain string 分支应调用 Test-IsUselessPlain（已统一替换内联条件）
      const level1Start  = script.indexOf('Level 1: LocalizedString');
      const level15Start = script.indexOf('Level 1.5: MUIVerb');
      const level1Block  = script.slice(level1Start, level15Start);
      expect(level1Block).toContain('Test-IsUselessPlain');
    });

    it('Level 1.5 MUIVerb plain string 等于 fallback 时应跳过', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      // Level 1.5 plain string 分支应调用 Test-IsUselessPlain
      const level15Start = script.indexOf('Level 1.5: MUIVerb');
      const level17Start = script.indexOf('Level 1.7:');
      const level15Block = script.slice(level15Start, level17Start);
      expect(level15Block).toContain('Test-IsUselessPlain');
    });

    it('Level 2 CLSID Default 等于 fallback 时应跳过', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      // Level 2 Default 检查分支应调用 Test-IsUselessPlain
      const level2Start  = script.indexOf('Level 2: CLSID 默认值');
      const level25Start = script.indexOf('Level 2.5:');
      const level2Block  = script.slice(level2Start, level25Start);
      expect(level2Block).toContain('Test-IsUselessPlain');
    });

    it('Level 3 directName 等于 fallback 时应跳过（修复漏洞）', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      // Level 3 plain string 分支应调用 Test-IsUselessPlain（修复前只有 Test-IsGenericName）
      const level3Start   = script.indexOf('Level 3: directName');
      const returnFallback = script.indexOf('return $fallback', level3Start);
      const level3Block   = script.slice(level3Start, returnFallback);
      expect(level3Block).toContain('Test-IsUselessPlain');
    });

    it('CmHelper 源码应包含 Ver 版本常量 "2026.3"', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      // C# $src 中应包含 Ver 字段
      expect(script).toContain('public static readonly string Ver = "2026.3"');
    });

    it('应包含 Level 1.3 Sibling Shell Key MUIVerb，位于 Level 1 与 Level 1.5 之间', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).toContain('Level 1.3:');
      expect(script).toContain('$shellPath');
      expect(script).toContain('$siblingVerbPath');
      expect(script).toContain('$siblingMUI');

      const level1Idx  = script.indexOf('Level 1: LocalizedString');
      const level13Idx = script.indexOf('Level 1.3:');
      const level15Idx = script.indexOf('Level 1.5: MUIVerb');
      expect(level13Idx).toBeGreaterThan(level1Idx);
      expect(level15Idx).toBeGreaterThan(level13Idx);
    });

    it('$shellPath 应在 ForEach 循环前由 $shellexPath 推导', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      // $shellPath 赋值语句应在 $handlers = Get-ChildItem 之前
      const shellPathIdx  = script.indexOf('$shellPath = $null');
      const handlersIdx   = script.indexOf('$handlers = Get-ChildItem');
      expect(shellPathIdx).toBeGreaterThan(0);
      expect(handlersIdx).toBeGreaterThan(shellPathIdx);

      // 包含 ContextMenuHandlers 结尾检测
      expect(script).toContain('ContextMenuHandlers$');
    });

    it('Test-IsGenericName 应包含 Group D 冠词开头和括号包裹规则', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      const fnStart = script.indexOf('function Test-IsGenericName');
      const fnEnd   = script.indexOf('function Test-IsUselessPlain');
      const fnBody  = script.slice(fnStart, fnEnd);

      // Group D 注释和规则应存在
      expect(fnBody).toContain('Group D');
      expect(fnBody).toContain('a|an|the');   // 冠词规则
      expect(fnBody).toContain("'^\\(.+\\)$'"); // 括号规则（PS 单引号内 \( 匹配字面量 (）
    });

    it('Test-IsGenericName Group D JS 模拟：冠词开头句子应被过滤', () => {
      // 模拟 PS 正则 '^(a|an|the)\s+'
      const articleRegex = /^(a|an|the)\s+/i;
      expect(articleRegex.test('a small project for the context menu of gvim!')).toBe(true);
      expect(articleRegex.test('an extension handler')).toBe(true);
      expect(articleRegex.test('the shell service')).toBe(true);
      // 不误杀普通产品名
      expect(articleRegex.test('Adobe Acrobat')).toBe(false);
      expect(articleRegex.test('百度网盘')).toBe(false);
      expect(articleRegex.test('7-Zip (64-bit)')).toBe(false);
    });

    it('Test-IsGenericName Group D JS 模拟：括号完全包裹的字符串应被过滤', () => {
      // 模拟 PS 正则 '^\(.+\)$'
      const parenRegex = /^\(.+\)$/;
      expect(parenRegex.test('(调试)')).toBe(true);
      expect(parenRegex.test('(Debug)')).toBe(true);
      expect(parenRegex.test('(unknown)')).toBe(true);
      // 不误杀括号在中间或两端不完整的情况
      expect(parenRegex.test('7-Zip (64-bit)')).toBe(false);
      expect(parenRegex.test('Adobe Acrobat')).toBe(false);
      expect(parenRegex.test('百度网盘')).toBe(false);
    });

    it('加载 DLL 后应立即校验 CmHelper.Ver，版本不匹配时重置 $helperLoaded', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      // 版本校验块：读取 [CmHelper]::Ver 并与 '2026.3' 比较
      expect(script).toContain("[CmHelper]::Ver -ne '2026.3'");
      // 版本校验块位于 DLL 加载块之后、$src 编译块之前
      const dllLoadIdx    = script.indexOf('Add-Type -Path $cmDll');
      const verCheckIdx   = script.indexOf("[CmHelper]::Ver -ne '2026.3'");
      const compileSrcIdx = script.indexOf('Add-Type -TypeDefinition $src');
      expect(verCheckIdx).toBeGreaterThan(dllLoadIdx);
      expect(compileSrcIdx).toBeGreaterThan(verCheckIdx);
    });
  });

  describe('并发信号量', () => {
    it('同时发起 5 个 execute，最大并发数不超过 3', async () => {
      const childProcess = await import('child_process');
      const execFileMock = vi.mocked(childProcess.execFile);

      let activeCalls = 0;
      let maxActive = 0;
      const pendingCallbacks: Array<() => void> = [];

      // promisify 标准行为：单对象参数会直接作为解析值，
      // 使 execFileAsync 解析为 { stdout, stderr } 对象
      execFileMock.mockImplementation(((_cmd: any, _args: any, _opts: any, cb: any) => {
        activeCalls++;
        maxActive = Math.max(maxActive, activeCalls);
        pendingCallbacks.push(() => {
          activeCalls--;
          cb(null, { stdout: '[]', stderr: '' });
        });
      }) as any);

      try {
        const promises = Array.from({ length: 5 }, () =>
          bridge.execute<unknown[]>('echo test')
        );

        // 等待微任务队列清空，让信号量处理排队
        await new Promise((r) => setImmediate(r));

        // 此时应只有 maxConcurrent=3 个 execFile 在运行
        expect(activeCalls).toBeLessThanOrEqual(3);

        // 逐个完成，验证排队的请求能正确被释放
        while (pendingCallbacks.length > 0) {
          pendingCallbacks.shift()!();
          await new Promise((r) => setImmediate(r));
        }

        await Promise.all(promises);

        // 整个过程中最大并发数恰好为 3
        expect(maxActive).toBe(3);
      } finally {
        // 恢复原始同步 mock 实现
        execFileMock.mockImplementation(((_cmd: any, _args: any, _opts: any, cb: any) => {
          cb(null, { stdout: '[]', stderr: '' });
        }) as any);
      }
    });

    it('high 优先级请求应插队到 normal 请求之前完成', async () => {
      const childProcess = await import('child_process');
      const execFileMock = vi.mocked(childProcess.execFile);

      const completionOrder: string[] = [];
      const pendingCallbacks: Array<() => void> = [];

      execFileMock.mockImplementation(((_cmd: any, _args: any, _opts: any, cb: any) => {
        pendingCallbacks.push(() => cb(null, { stdout: '[]', stderr: '' }));
      }) as any);

      try {
        // 饱和全部 3 个槽（normal 优先级）
        const s1 = bridge.execute<unknown[]>('s1');
        const s2 = bridge.execute<unknown[]>('s2');
        const s3 = bridge.execute<unknown[]>('s3');
        await new Promise((r) => setImmediate(r));

        // 入队：2 个 normal，然后 1 个 high（high 用 unshift 插到队首）
        bridge.execute<unknown[]>('n1').then(() => completionOrder.push('normal1'));
        bridge.execute<unknown[]>('n2').then(() => completionOrder.push('normal2'));
        const highP = bridge.execute<unknown[]>('h', 'high').then(() => completionOrder.push('high'));
        await new Promise((r) => setImmediate(r));

        // 依次释放全部 callbacks，每次等微任务链完成
        // 释放 s1 后，high 插队获得槽（unshift）；后续释放 s2/s3 让 normal 获得槽
        while (pendingCallbacks.length > 0) {
          pendingCallbacks.shift()!();
          await new Promise((r) => setImmediate(r));
        }

        await Promise.all([s1, s2, s3, highP]);

        // high 应是第一个完成的
        expect(completionOrder[0]).toBe('high');
      } finally {
        execFileMock.mockImplementation(((_cmd: any, _args: any, _opts: any, cb: any) => {
          cb(null, { stdout: '[]', stderr: '' });
        }) as any);
      }
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
