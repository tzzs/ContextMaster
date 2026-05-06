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

    it('应输出 rawMUIVerb / rawDefault / rawLocalizedDisplayName 原始字段', () => {
      const script = bridge.buildGetItemsScript('DesktopBackground\\Shell');

      expect(script).toContain('rawMUIVerb');
      expect(script).toContain('rawDefault');
      expect(script).toContain('rawLocalizedDisplayName');
    });

    it('不应包含 CmHelper 或 Resolve-MenuName（名称解析已移至 TS 层）', () => {
      const script = bridge.buildGetItemsScript('DesktopBackground\\Shell');

      expect(script).not.toContain('CmHelper');
      expect(script).not.toContain('Resolve-MenuName');
      expect(script).not.toContain('SHLoadIndirectString');
    });

    it('应将正确的注册表路径嵌入脚本', () => {
      const script = bridge.buildGetItemsScript('*\\shell');
      expect(script).toContain('HKCR:\\*\\shell');
    });

    it('不应包含热键清理逻辑（热键清理已移至 TS 层 cleanDisplayName）', () => {
      const script = bridge.buildGetItemsScript('DesktopBackground\\Shell');
      // -replace 只用于键名前缀剥离（$handlerKeyName -replace '^-+'），不含加速键正则
      expect(script).not.toMatch(/\(&\\w\)|\(\\w\)|&\\w/);
    });
  });

  describe('buildGetShellExtItemsScript', () => {
    it('不应包含 CmHelper / Resolve-ExtName / Test-IsGenericName（解析已移至 TS）', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).not.toContain('CmHelper');
      expect(script).not.toContain('Resolve-ExtName');
      expect(script).not.toContain('Test-IsGenericName');
      expect(script).not.toContain('Test-IsUselessPlain');
      expect(script).not.toContain('Format-DisplayName');
      expect(script).not.toContain('SHLoadIndirectString');
      expect(script).not.toContain('GetLocalizedVerStrings');
    });

    it('不应包含 CommandStore 索引构建（已移至独立脚本）', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).not.toContain('cmdStoreVerbs');
      expect(script).not.toContain('CommandStore');
    });

    it('应输出 handlerKeyName / cleanName / defaultVal 原始字段', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).toContain('handlerKeyName');
      expect(script).toContain('cleanName');
      expect(script).toContain('defaultVal');
    });

    it('应输出 CLSID 子键原始字段 (clsidLocalizedString / clsidMUIVerb / clsidDefault)', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).toContain('clsidLocalizedString');
      expect(script).toContain('clsidMUIVerb');
      expect(script).toContain('clsidDefault');
    });

    it('应读取 InprocServer32 DLL 路径并输出 dllPath 字段', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).toContain('InprocServer32');
      expect(script).toContain('ExpandEnvironmentVariables');
      expect(script).toContain('dllPath');
    });

    it('应输出 siblingMUIVerb 字段', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).toContain('siblingMUIVerb');
    });

    it('应包含 sibling shell 路径推导逻辑', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).toContain('$shellPath');
      expect(script).toContain('$siblingVerbPath');
      expect(script).toContain('ContextMenuHandlers$');
    });

    it('ForEach 循环应使用 $actualClsid 和 $defaultVal 分离 CLSID', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).toContain('$actualClsid');
    });

    it('不应包含硬编码 friendlyNames 映射表', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).not.toContain('$friendlyNames');
      expect(script).not.toContain('friendlyNames.ContainsKey');
    });

    it('不应包含热键清理逻辑（已移至 TS 层）', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      // -replace 只用于键名前缀剥离，不含加速键正则
      expect(script).not.toMatch(/\(&\\w\)|\(\\w\)|&\\w/);
    });

    it('不应包含 ReadDllStrings（已移除）', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).not.toContain('ReadDllStrings');
      expect(script).not.toContain('LoadLibraryEx');
    });

    it('不应包含 CmHelper.Ver 版本校验', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).not.toContain("[CmHelper]::Ver");
    });

    it('不应包含 Level 级别注释（Level 逻辑已移至 TS）', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).not.toContain('Level 0:');
      expect(script).not.toContain('Level 1:');
      expect(script).not.toContain('Level 2');
      expect(script).not.toContain('Level 3:');
    });

    it('不应包含 C# 源码 Add-Type 编译', () => {
      const script = bridge.buildGetShellExtItemsScript(
        'DesktopBackground\\shellex\\ContextMenuHandlers'
      );

      expect(script).not.toContain('using System;');
      expect(script).not.toContain('Add-Type -TypeDefinition');
    });
  });

  describe('buildCommandStoreScript', () => {
    it('应包含 CommandStore\\shell 路径', () => {
      const script = bridge.buildCommandStoreScript();

      expect(script).toContain('CommandStore\\shell');
    });

    it('应读取 ExplorerCommandHandler 和 MUIVerb', () => {
      const script = bridge.buildCommandStoreScript();

      expect(script).toContain('ExplorerCommandHandler');
      expect(script).toContain("GetValue('MUIVerb')");
    });

    it('应输出 clsid 和 muiverb 字段', () => {
      const script = bridge.buildCommandStoreScript();

      expect(script).toContain('clsid');
      expect(script).toContain('muiverb');
    });

    it('不应包含 CmHelper 或 SHLoadIndirectString', () => {
      const script = bridge.buildCommandStoreScript();

      expect(script).not.toContain('CmHelper');
      expect(script).not.toContain('SHLoadIndirectString');
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
