import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ShellExtNameResolver,
  CommandStoreIndex,
  PsRawClassicItem,
  PsRawShellExtItem,
} from '@/main/services/ShellExtNameResolver';
import { IWin32Shell } from '@/main/services/Win32Shell';

function createMockWin32(lang: 'zh' | 'en' = 'zh'): IWin32Shell {
  return {
    resolveIndirect: vi.fn().mockReturnValue(null),
    uiLanguage: lang,
  };
}

function createClassicItem(overrides: Partial<PsRawClassicItem> = {}): PsRawClassicItem {
  return {
    subKeyName: 'TestItem',
    rawMUIVerb: null,
    rawDefault: null,
    rawLocalizedDisplayName: null,
    rawIcon: null,
    isEnabled: true,
    command: 'test.exe',
    registryKey: 'DesktopBackground\\Shell\\TestItem',
    ...overrides,
  };
}

function createShellExtItem(overrides: Partial<PsRawShellExtItem> = {}): PsRawShellExtItem {
  return {
    handlerKeyName: 'TestExt',
    cleanName: 'TestExt',
    defaultVal: '',
    isEnabled: true,
    actualClsid: '{12345678-1234-1234-1234-123456789ABC}',
    clsidLocalizedString: null,
    clsidMUIVerb: null,
    clsidDefault: null,
    dllPath: null,
    dllFileDescription: null,
    siblingMUIVerb: null,
    registryKey: 'DesktopBackground\\shellex\\ContextMenuHandlers\\TestExt',
    ...overrides,
  };
}

describe('ShellExtNameResolver', () => {
  let resolver: ShellExtNameResolver;
  let win32: IWin32Shell;

  beforeEach(() => {
    win32 = createMockWin32();
    resolver = new ShellExtNameResolver(win32);
  });

  // ---- Classic Shell 名称解析 ----

  describe('resolveClassicName', () => {
    it('should return MUIVerb as plain string when available', () => {
      const item = createClassicItem({ rawMUIVerb: '用Vim编辑' });
      expect(resolver.resolveClassicName(item)).toBe('用Vim编辑');
    });

    it('should resolve MUIVerb via resolveIndirect when it starts with @', () => {
      vi.mocked(win32.resolveIndirect).mockReturnValue('打开方式');
      const item = createClassicItem({ rawMUIVerb: '@shell32.dll,-8510' });
      expect(resolver.resolveClassicName(item)).toBe('打开方式');
    });

    it('should resolve MUIVerb via resolveIndirect when it starts with ms-resource:', () => {
      vi.mocked(win32.resolveIndirect).mockReturnValue('个性化');
      const item = createClassicItem({ rawMUIVerb: 'ms-resource:Personalize' });
      expect(resolver.resolveClassicName(item)).toBe('个性化');
    });

    it('should fallback to Default (rawDefault) when MUIVerb is null', () => {
      const item = createClassicItem({ rawMUIVerb: null, rawDefault: 'Open' });
      expect(resolver.resolveClassicName(item)).toBe('Open');
    });

    it('should fallback to Default as @ format resolved', () => {
      vi.mocked(win32.resolveIndirect).mockReturnValue('自定义');
      const item = createClassicItem({ rawMUIVerb: null, rawDefault: '@mydll.dll,-100' });
      expect(resolver.resolveClassicName(item)).toBe('自定义');
    });

    it('should fallback to LocalizedDisplayName', () => {
      const item = createClassicItem({
        rawMUIVerb: null,
        rawDefault: null,
        rawLocalizedDisplayName: '显示设置',
      });
      expect(resolver.resolveClassicName(item)).toBe('显示设置');
    });

    it('should fallback to subKeyName when all candidates are null', () => {
      const item = createClassicItem({
        rawMUIVerb: null,
        rawDefault: null,
        rawLocalizedDisplayName: null,
        subKeyName: 'FallbackKey',
      });
      expect(resolver.resolveClassicName(item)).toBe('FallbackKey');
    });

    it('should skip empty candidates', () => {
      const item = createClassicItem({
        rawMUIVerb: '',
        rawDefault: '  ',  // length >= 2
      });
      // empty string skipped, '  ' has length >= 2 so used as-is
      expect(resolver.resolveClassicName(item)).toBe('  ');
    });
  });

  // ---- Shell 扩展名称解析（多级回退） ----

  describe('resolveExtName', () => {
    const cmdStore = new CommandStoreIndex();

    it('fallback 返回 cleanName', () => {
      const item = createShellExtItem({ cleanName: 'MyExt' });
      expect(resolver.resolveExtName(item, cmdStore)).toBe('MyExt');
    });

    // Level 0: directName indirect format
    it('Level 0: 应解析 @dll,-id 格式的 defaultVal', () => {
      vi.mocked(win32.resolveIndirect).mockReturnValue('打开方式');
      const item = createShellExtItem({
        defaultVal: '@shell32.dll,-8510',
        cleanName: 'OpenWith',
      });
      expect(resolver.resolveExtName(item, cmdStore)).toBe('打开方式');
    });

    it('Level 0: 应解析 ms-resource: 格式的 defaultVal', () => {
      vi.mocked(win32.resolveIndirect).mockReturnValue('共享');
      const item = createShellExtItem({
        defaultVal: 'ms-resource:Share',
        cleanName: 'ShareHandler',
      });
      expect(resolver.resolveExtName(item, cmdStore)).toBe('共享');
    });

    // Level 1: CLSID.LocalizedString
    it('Level 1: 应返回 plain LocalizedString', () => {
      const item = createShellExtItem({
        clsidLocalizedString: 'Windows 照片查看器',
      });
      expect(resolver.resolveExtName(item, cmdStore)).toBe('Windows 照片查看器');
    });

    it('Level 1: 应解析间接格式的 LocalizedString', () => {
      vi.mocked(win32.resolveIndirect).mockReturnValue('编辑');
      const item = createShellExtItem({
        clsidLocalizedString: '@notepad.dll,-100',
      });
      expect(resolver.resolveExtName(item, cmdStore)).toBe('编辑');
    });

    it('Level 1: 应过滤等于 fallback 的 LocalizedString', () => {
      const item = createShellExtItem({
        clsidLocalizedString: 'TestExt',  // same as cleanName
        cleanName: 'TestExt',
      });
      expect(resolver.resolveExtName(item, cmdStore)).toBe('TestExt'); // falls through to fallback
    });

    // Level 1.3: Sibling Shell Key MUIVerb
    it('Level 1.3: 应返回 plain sibling MUIVerb', () => {
      const item = createShellExtItem({
        siblingMUIVerb: '用Vim编辑',
      });
      expect(resolver.resolveExtName(item, cmdStore)).toBe('用Vim编辑');
    });

    it('Level 1.3: 应解析间接格式的 sibling MUIVerb', () => {
      vi.mocked(win32.resolveIndirect).mockReturnValue('压缩');
      const item = createShellExtItem({
        siblingMUIVerb: '@zip.dll,-200',
      });
      expect(resolver.resolveExtName(item, cmdStore)).toBe('压缩');
    });

    // Level 1.5: CLSID.MUIVerb
    it('Level 1.5: 应返回 plain CLSID MUIVerb', () => {
      const item = createShellExtItem({
        clsidMUIVerb: '固定到任务栏',
      });
      expect(resolver.resolveExtName(item, cmdStore)).toBe('固定到任务栏');
    });

    it('Level 1.5: 应解析间接格式的 MUIVerb', () => {
      vi.mocked(win32.resolveIndirect).mockReturnValue('扫描');
      const item = createShellExtItem({
        clsidMUIVerb: '@scanner.dll,-50',
      });
      expect(resolver.resolveExtName(item, cmdStore)).toBe('扫描');
    });

    // Level 1.7: CommandStore reverse
    it('Level 1.7: 应从 CommandStore 索引查找', () => {
      const store = new CommandStoreIndex();
      store.buildFromData([
        { clsid: '{12345678-1234-1234-1234-123456789ABC}', muiverb: '固定到快速访问' },
      ]);
      const item = createShellExtItem();
      expect(resolver.resolveExtName(item, store)).toBe('固定到快速访问');
    });

    it('Level 1.7: CommandStore 不区分大小写', () => {
      const store = new CommandStoreIndex();
      store.buildFromData([
        { clsid: '{12345678-1234-1234-1234-123456789abc}', muiverb: '大小写测试' },
      ]);
      const item = createShellExtItem({
        actualClsid: '{12345678-1234-1234-1234-123456789ABC}',
      });
      expect(resolver.resolveExtName(item, store)).toBe('大小写测试');
    });

    // Level 2: CLSID Default
    it('Level 2: 应返回非泛型的 CLSID Default', () => {
      const item = createShellExtItem({
        clsidLocalizedString: null,
        clsidMUIVerb: null,
        clsidDefault: '阿里云盘外壳扩展',
      });
      expect(resolver.resolveExtName(item, cmdStore)).toBe('阿里云盘外壳扩展');
    });

    it('Level 2: 应过滤等于 fallback 的 CLSID Default（如 gvim → Default = "gvim"）', () => {
      const item = createShellExtItem({
        clsidLocalizedString: null,
        clsidMUIVerb: null,
        clsidDefault: 'gvim',  // same as cleanName
        cleanName: 'gvim',
      });
      expect(resolver.resolveExtName(item, cmdStore)).toBe('gvim');
    });

    // Level 2.5: DLL FileDescription
    it('Level 2.5: 应返回 DLL FileDescription（PS 采集）', () => {
      const item = createShellExtItem({
        clsidLocalizedString: null,
        clsidMUIVerb: null,
        clsidDefault: null,
        dllFileDescription: '阿里云盘',
      });
      expect(resolver.resolveExtName(item, cmdStore)).toBe('阿里云盘');
    });

    it('Level 2.5: 应过滤泛型 DLL 描述（如 "Vim Shell Extension"）', () => {
      const item = createShellExtItem({
        clsidLocalizedString: null,
        clsidMUIVerb: null,
        clsidDefault: null,
        dllFileDescription: 'Vim Shell Extension',
      });
      expect(resolver.resolveExtName(item, cmdStore)).toBe('TestExt'); // fallback
    });

    // Level 3: directName plain string
    it('Level 3: 应返回非泛型的 plain directName', () => {
      const item = createShellExtItem({
        defaultVal: 'Edit with Notepad++',
        clsidLocalizedString: null,
        clsidMUIVerb: null,
        clsidDefault: null,
      });
      expect(resolver.resolveExtName(item, cmdStore)).toBe('Edit with Notepad++');
    });

    it('Level 3: 应过滤等于 fallback 的 directName', () => {
      const item = createShellExtItem({
        defaultVal: 'TestExt',  // same as cleanName
        cleanName: 'TestExt',
        clsidLocalizedString: null,
        clsidMUIVerb: null,
        clsidDefault: null,
      });
      expect(resolver.resolveExtName(item, cmdStore)).toBe('TestExt');
    });
  });

  // ---- 泛型名称过滤 ----

  describe('isGenericName (via resolveExtName)', () => {
    const cmdStore = new CommandStoreIndex();

    it('Group A: 应过滤 "Context Menu Handler"', () => {
      const item = createShellExtItem({
        clsidLocalizedString: 'Context Menu Handler',
      });
      expect(resolver.resolveExtName(item, cmdStore)).toBe('TestExt');
    });

    it('Group A: 应过滤 "Shell Extension"', () => {
      const item = createShellExtItem({
        clsidLocalizedString: 'Shell Extension',
      });
      expect(resolver.resolveExtName(item, cmdStore)).toBe('TestExt');
    });

    it('Group A: 应过滤 "shell extension" 后缀（WinRAR）', () => {
      const item = createShellExtItem({
        clsidLocalizedString: 'WinRAR shell extension',
      });
      expect(resolver.resolveExtName(item, cmdStore)).toBe('TestExt');
    });

    it('Group A: 应过滤 ".dll" 文件名', () => {
      const item = createShellExtItem({
        clsidLocalizedString: 'shellext.dll',
      });
      expect(resolver.resolveExtName(item, cmdStore)).toBe('TestExt');
    });

    it('Group A: 应过滤 "Microsoft Windows *" 系统描述', () => {
      const item = createShellExtItem({
        clsidLocalizedString: 'Microsoft Windows Operating System',
      });
      expect(resolver.resolveExtName(item, cmdStore)).toBe('TestExt');
    });

    it('Group B: 应过滤 "* Class" COM 类名', () => {
      const item = createShellExtItem({
        clsidLocalizedString: 'PcyybContextMenu Class',
      });
      expect(resolver.resolveExtName(item, cmdStore)).toBe('TestExt');
    });

    it('Group C: 应过滤 "TODO:" 占位符', () => {
      const item = createShellExtItem({
        clsidLocalizedString: 'TODO: Add description',
      });
      expect(resolver.resolveExtName(item, cmdStore)).toBe('TestExt');
    });

    it('Group C: 应过滤尖括号占位符', () => {
      const item = createShellExtItem({
        clsidLocalizedString: '<File description>',
      });
      expect(resolver.resolveExtName(item, cmdStore)).toBe('TestExt');
    });

    it('Group C: 应过滤 "n/a" / "none" / "unknown"', () => {
      for (const val of ['n/a', 'N/A', 'none', 'None', 'unknown', 'untitled']) {
        const item = createShellExtItem({ clsidLocalizedString: val });
        expect(resolver.resolveExtName(item, cmdStore)).toBe('TestExt');
      }
    });

    it('Group D: 应过滤冠词开头的句子', () => {
      const item = createShellExtItem({
        clsidLocalizedString: 'a small project for the context menu of gvim!',
      });
      expect(resolver.resolveExtName(item, cmdStore)).toBe('TestExt');
    });

    it('Group D: 应过滤括号完全包裹的调试标记', () => {
      for (const val of ['(调试)', '(Debug)', '(unknown)']) {
        const item = createShellExtItem({ clsidLocalizedString: val });
        expect(resolver.resolveExtName(item, cmdStore)).toBe('TestExt');
      }
    });

    it('不应误杀正常产品名', () => {
      const validNames = [
        'Quark AI Context Menu',
        '百度网盘',
        '阿里云盘',
        '用Vim编辑',
        'Edit with Notepad++',
        '7-Zip (64-bit)',
        'Adobe Acrobat',
      ];
      for (const name of validNames) {
        const item = createShellExtItem({ clsidLocalizedString: name });
        expect(resolver.resolveExtName(item, cmdStore)).toBe(name);
      }
    });

    it('应过滤 "外壳服务对象" COM 描述', () => {
      const item = createShellExtItem({
        clsidLocalizedString: '外壳服务对象',
      });
      expect(resolver.resolveExtName(item, cmdStore)).toBe('TestExt');
    });
  });

  // ---- 标准谓词翻译 ----

  describe('Standard Verb Translation', () => {
    const cmdStore = new CommandStoreIndex();

    it('应翻译标准动词 open → 打开', () => {
      const item = createClassicItem({ rawMUIVerb: null, rawDefault: null, subKeyName: 'open' });
      expect(resolver.resolveClassicName(item)).toBe('打开');
    });

    it('应翻译标准动词 edit → 编辑', () => {
      const item = createClassicItem({ rawMUIVerb: null, rawDefault: null, subKeyName: 'edit' });
      expect(resolver.resolveClassicName(item)).toBe('编辑');
    });

    it('应翻译标准动词 properties → 属性', () => {
      const item = createClassicItem({ rawMUIVerb: null, rawDefault: null, subKeyName: 'properties' });
      expect(resolver.resolveClassicName(item)).toBe('属性');
    });

    it('应翻译标准动词 runas → 以管理员身份运行', () => {
      const item = createClassicItem({ rawMUIVerb: null, rawDefault: null, subKeyName: 'runas' });
      expect(resolver.resolveClassicName(item)).toBe('以管理员身份运行');
    });

    it('英文模式下应返回英文翻译', () => {
      const enWin32 = createMockWin32('en');
      const enResolver = new ShellExtNameResolver(enWin32, 'en');
      const item = createClassicItem({ rawMUIVerb: null, rawDefault: null, subKeyName: 'open' });
      expect(enResolver.resolveClassicName(item)).toBe('Open');
    });

    it('大小写不敏感匹配', () => {
      const item = createClassicItem({ rawMUIVerb: null, rawDefault: null, subKeyName: 'Open' });
      expect(resolver.resolveClassicName(item)).toBe('打开');
    });

    it('ShellExt cleanName 为 sendto 时应翻译为 发送到', () => {
      const item = createShellExtItem({
        cleanName: 'sendto',
        clsidLocalizedString: null,
        clsidMUIVerb: null,
        clsidDefault: null,
      });
      expect(resolver.resolveExtName(item, cmdStore)).toBe('发送到');
    });

    it('ShellExt cleanName 为 print 时应翻译为 打印', () => {
      const item = createShellExtItem({
        cleanName: 'print',
        clsidLocalizedString: null,
        clsidMUIVerb: null,
      });
      expect(resolver.resolveExtName(item, cmdStore)).toBe('打印');
    });
  });

  // ---- CommandStoreIndex ----

  describe('CommandStoreIndex', () => {
    it('应正确构建索引并查找', () => {
      const store = new CommandStoreIndex();
      store.buildFromData([
        { clsid: '{AAA}', muiverb: 'Foo' },
        { clsid: '{BBB}', muiverb: 'Bar' },
      ]);
      expect(store.get('{AAA}')).toBe('Foo');
      expect(store.get('{BBB}')).toBe('Bar');
      expect(store.get('{CCC}')).toBeNull();
    });

    it('不区分大小写查找', () => {
      const store = new CommandStoreIndex();
      store.buildFromData([{ clsid: '{abc-DEF}', muiverb: 'Test' }]);
      expect(store.get('{ABC-def}')).toBe('Test');
    });

    it('invalidate 应清空索引', () => {
      const store = new CommandStoreIndex();
      store.buildFromData([{ clsid: '{AAA}', muiverb: 'Foo' }]);
      store.invalidate();
      expect(store.get('{AAA}')).toBeNull();
    });
  });
});
