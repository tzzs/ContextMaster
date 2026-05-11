import { MenuScene, MenuItemType, ItemProtectionLevel } from '../../shared/enums';
import { MenuItemEntry } from '../../shared/types';
import { PowerShellBridge } from './PowerShellBridge';
import { ShellExtNameResolver, CommandStoreIndex, PsRawClassicItem, PsRawShellExtItem } from './ShellExtNameResolver';
import log from '../utils/logger';

const SCENE_REGISTRY_PATHS: Record<MenuScene, string[]> = {
  [MenuScene.Desktop]:            ['DesktopBackground\\Shell'],
  [MenuScene.File]:               ['*\\shell', 'AllFilesystemObjects\\shell', 'SystemFileAssociations\\*\\shell'],
  [MenuScene.Folder]:             ['Directory\\shell', 'Folder\\shell', 'AllFilesystemObjects\\shell'],
  [MenuScene.Drive]:              ['Drive\\shell'],
  [MenuScene.DirectoryBackground]:['Directory\\Background\\shell'],
  [MenuScene.RecycleBin]:         ['CLSID\\{645FF040-5081-101B-9F08-00AA002F954E}\\shell'],
};

const SCENE_SHELLEX_PATHS: Record<MenuScene, string[]> = {
  [MenuScene.Desktop]:            ['DesktopBackground\\shellex\\ContextMenuHandlers'],
  [MenuScene.File]:               ['*\\shellex\\ContextMenuHandlers', 'AllFilesystemObjects\\shellex\\ContextMenuHandlers'],
  [MenuScene.Folder]:             ['Directory\\shellex\\ContextMenuHandlers', 'Folder\\shellex\\ContextMenuHandlers', 'AllFilesystemObjects\\shellex\\ContextMenuHandlers'],
  [MenuScene.Drive]:              ['Drive\\shellex\\ContextMenuHandlers'],
  [MenuScene.DirectoryBackground]:['Directory\\Background\\shellex\\ContextMenuHandlers'],
  [MenuScene.RecycleBin]:         ['CLSID\\{645FF040-5081-101B-9F08-00AA002F954E}\\shellex\\ContextMenuHandlers'],
};

// 完整 HKCR 前缀（用于显示）
const HKCR_PREFIX = 'HKEY_CLASSES_ROOT';

export class RegistryService {
  private readonly ps: PowerShellBridge;
  private readonly resolver: ShellExtNameResolver;
  private readonly cmdStoreIndex: CommandStoreIndex;
  private rollbackData = new Map<string, boolean>();
  private inTransaction = false;
  private nextId = 1;

  constructor(
    ps: PowerShellBridge,
    resolver: ShellExtNameResolver,
    cmdStoreIndex: CommandStoreIndex,
  ) {
    this.ps = ps;
    this.resolver = resolver;
    this.cmdStoreIndex = cmdStoreIndex;
  }

  /**
   * 获取指定场景下的所有菜单条目（Classic Shell + Shell 扩展）
   * 优先从缓存读取，缓存未命中时执行 PowerShell 查询
   */
  async getMenuItems(scene: MenuScene, priority: 'high' | 'normal' = 'normal'): Promise<MenuItemEntry[]> {
    const basePaths = SCENE_REGISTRY_PATHS[scene];
    const shellexPaths = SCENE_SHELLEX_PATHS[scene];

    try {
      // 每个场景只启动 2 个 PS 进程：一个扫描所有 classic 路径，一个扫描所有 shellex 路径
      const [classicRaw, shellexRaw] = await Promise.all([
        this.ps.execute<PsRawClassicItem[]>(this.ps.buildGetItemsScript(basePaths), priority)
          .then(r => Array.isArray(r) ? r : (r ? [r] : []))
          .catch((e) => { log.warn(`getMenuItems classic(${scene}) failed:`, e); return [] as PsRawClassicItem[]; }),
        this.ps.execute<PsRawShellExtItem[]>(this.ps.buildGetShellExtItemsScript(shellexPaths), priority)
          .then(r => Array.isArray(r) ? r : [])
          .catch((e) => { log.warn(`getMenuItems shellex(${scene}) failed:`, e); return [] as PsRawShellExtItem[]; }),
      ]);

      // 去重（按 subKeyName / actualClsid，保留首次出现的）
      const seenClassic = new Set<string>();
      const classicItems: PsRawClassicItem[] = [];
      for (const item of classicRaw) {
        const dedup = item.subKeyName.toLowerCase();
        if (!seenClassic.has(dedup)) { seenClassic.add(dedup); classicItems.push(item); }
      }
      const seenShellExt = new Set<string>();
      const shellexItems: PsRawShellExtItem[] = [];
      for (const item of shellexRaw) {
        const dedup = item.actualClsid.toLowerCase();
        if (!seenShellExt.has(dedup)) { seenShellExt.add(dedup); shellexItems.push(item); }
      }

      // Classic Shell 条目：通过 resolver 解析名称（保护：单条失败不影响整体）
      const classicEntries: MenuItemEntry[] = classicItems.map((r: PsRawClassicItem) => {
        let name: string;
        let nameFromFallback = false;
        try {
          name = this.cleanDisplayName(this.resolver.resolveClassicName(r));
        } catch (e) {
          log.warn(`[RegistryService] resolveClassicName failed for "${r.subKeyName}":`, String(e));
          name = this.cleanDisplayName(r.subKeyName);
        }
        // 当解析结果等于原始键名时，标记 fallback（无本地化数据可用）
        if (name === this.cleanDisplayName(r.subKeyName)) {
          nameFromFallback = true;
        }
        const protection = this.classifyProtection(r);
        const origin = this.classifyOriginClassic(r, protection.level);
        return {
          id: this.nextId++,
          name,
          command: r.command,
          iconPath: r.rawIcon,
          isEnabled: r.isEnabled,
          source: '',
          menuScene: scene,
          registryKey: r.registryKey,
          type: r.command && r.command.trim() ? MenuItemType.Custom : MenuItemType.System,
          dllPath: null,
          protectionLevel: protection.level,
          protectionReason: protection.reason,
          isExtended: r.hasExtended || undefined,
          hasSubCommands: r.hasSubCommands || undefined,
          nameFromFallback: nameFromFallback || undefined,
          origin,
        };
      });

      // Shell 扩展条目：通过 resolver 解析名称（保护：单条失败不影响整体）
      const shellexEntries: MenuItemEntry[] = shellexItems.map((r: PsRawShellExtItem) => {
        let name: string;
        let nameFromFallback = false;
        try {
          name = this.cleanDisplayName(this.resolver.resolveExtName(r, this.cmdStoreIndex));
        } catch (e) {
          log.warn(`[RegistryService] resolveExtName failed for "${r.cleanName}":`, String(e));
          name = this.cleanDisplayName(r.cleanName);
        }
        if (name === this.cleanDisplayName(r.cleanName)) {
          nameFromFallback = true;
        }
        const protection = this.classifyShellExtProtection(r.actualClsid);
        const origin = this.classifyOriginShellExt(r, protection.level);
        return {
          id: this.nextId++,
          name,
          command: r.actualClsid,
          iconPath: r.clsidIcon ?? null,
          isEnabled: r.isEnabled,
          source: r.handlerKeyName,
          menuScene: scene,
          registryKey: r.registryKey,
          type: MenuItemType.ShellExt,
          dllPath: r.dllPath ?? null,
          protectionLevel: protection.level,
          protectionReason: protection.reason,
          nameFromFallback: nameFromFallback || undefined,
          origin,
        };
      });

      const result = [...classicEntries, ...shellexEntries];
      return result;
    } catch (e) {
      log.error(`getMenuItems(${scene}) failed:`, e);
      throw new Error(`读取注册表场景 ${scene} 失败: ${(e as Error).message}`);
    }
  }

  /**
   * 启用或禁用单个菜单条目
   * ShellExt 通过重命名键（±前缀）实现；Classic Shell 通过 LegacyDisable 值实现
   * ShellExt 通过重命名键（±前缀）实现，registryKey 已归一化，身份不变
   */
  async setItemEnabled(registryKey: string, enabled: boolean): Promise<{ newRegistryKey?: string }> {
    try {
      if (this.isShellExtKey(registryKey)) {
        const script = this.ps.buildShellExtToggleScript(registryKey, enabled);
        await this.ps.executeElevated<{ ok: boolean }>(script);
        return {};
      } else {
        const script = this.ps.buildSetEnabledScript(registryKey, enabled);
        await this.ps.executeElevated<{ ok: boolean }>(script);
        return {};
      }
    } catch (e) {
      if (this.inTransaction) {
        await this.rollback();
      }
      throw new Error(
        `修改菜单项状态失败 [${registryKey}]: ${(e as Error).message}`
      );
    }
  }

  /**
   * 创建回滚点（事务开始前调用）
   */
  createRollbackPoint(items: Array<{ registryKey: string; isEnabled: boolean }>): void {
    this.rollbackData.clear();
    for (const item of items) {
      this.rollbackData.set(item.registryKey, item.isEnabled);
    }
    this.inTransaction = true;
  }

  /**
   * 回滚到之前保存的状态
   */
  async rollback(): Promise<void> {
    if (!this.inTransaction) return;
    log.warn('Rolling back registry changes...');
    const failedItems: string[] = [];
    try {
      for (const [key, wasEnabled] of this.rollbackData) {
        try {
          await this.setItemEnabledInternal(key, wasEnabled);
        } catch (e) {
          failedItems.push(`${key}: ${String(e)}`);
        }
      }
    } finally {
      this.inTransaction = false;
      this.rollbackData.clear();
    }
    if (failedItems.length > 0) {
      throw new Error(`部分项回滚失败:\n${failedItems.join('\n')}`);
    }
  }

  /**
   * 提交事务（清空回滚数据）
   */
  commitTransaction(): void {
    this.inTransaction = false;
    this.rollbackData.clear();
  }

  /**
   * 获取场景对应的完整注册表路径（用于 UI 显示）
   */
  getFullRegistryPath(scene: MenuScene): string {
    return `${HKCR_PREFIX}\\${SCENE_REGISTRY_PATHS[scene][0]}`;
  }

  private async setItemEnabledInternal(registryKey: string, enabled: boolean): Promise<void> {
    if (this.isShellExtKey(registryKey)) {
      const script = this.ps.buildShellExtToggleScript(registryKey, enabled);
      await this.ps.executeElevated<{ ok: boolean }>(script);
    } else {
      const script = this.ps.buildSetEnabledScript(registryKey, enabled);
      await this.ps.executeElevated<{ ok: boolean }>(script);
    }
  }

  /** Shell 扩展的 registryKey 包含 'shellex' 和 'ContextMenuHandlers' 路径段 */
  private isShellExtKey(registryKey: string): boolean {
    return registryKey.includes('shellex') && registryKey.includes('ContextMenuHandlers');
  }

  private cleanDisplayName(name: string): string {
    if (!name) return name;
    return name
      .replace(/\(&\w\)/g, '')   // ① 先处理带括号加速键整体：(&R)、(&E)、(&V)
      .replace(/\(\w\)/g, '')    // ② 单字母括号：(P)、(D)
      .replace(/&\w/g, '')       // ③ 裸加速键：&O、&L（兜底）
      .replace(/\(\s*\)/g, '')   // ④ 空括号兜底（防止顺序问题留下残留）
      .replace(/\s+/g, ' ')      // ⑤ 规范化多余空白
      .trim();
  }

  classifyProtection(
    raw: PsRawClassicItem,
  ): { level: ItemProtectionLevel; reason?: string } {
    if (raw.hasSuppression) {
      return { level: ItemProtectionLevel.Protected, reason: '系统策略禁止修改' };
    }
    if (raw.hasProgrammaticAccessOnly) {
      return { level: ItemProtectionLevel.Protected, reason: '编程专用条目' };
    }
    const verb = raw.subKeyName.toLowerCase();
    const coreVerbs = ['open', 'explore', 'find', 'properties'];
    if (coreVerbs.includes(verb) && !raw.command?.trim()) {
      return { level: ItemProtectionLevel.Protected, reason: '系统核心功能' };
    }
    if (raw.hasExtended) {
      return { level: ItemProtectionLevel.Warning, reason: '仅 Shift+右键可见' };
    }
    const warningVerbs = ['runas', 'runasuser'];
    if (warningVerbs.includes(verb)) {
      return { level: ItemProtectionLevel.Warning, reason: '系统管理功能' };
    }
    return { level: ItemProtectionLevel.Normal };
  }

  classifyShellExtProtection(clsid: string): { level: ItemProtectionLevel; reason?: string } {
    if (SYSTEM_SHELL_EXT_CLSIDS.has(clsid.toLowerCase())) {
      return { level: ItemProtectionLevel.Warning, reason: '系统内置扩展' };
    }
    return { level: ItemProtectionLevel.Normal };
  }

  /** Classic Shell 条目来源判定（系统 vs 第三方） */
  classifyOriginClassic(
    raw: PsRawClassicItem,
    protectionLevel: ItemProtectionLevel,
  ): 'system' | 'third-party' {
    if (protectionLevel === ItemProtectionLevel.Protected) return 'system';
    const verb = raw.subKeyName.toLowerCase();
    const systemVerbs = ['open', 'explore', 'find', 'properties', 'runas', 'runasuser', 'edit', 'print', 'printto', 'preview', 'play'];
    if (systemVerbs.includes(verb)) return 'system';
    return 'third-party';
  }

  /** Shell 扩展条目来源判定（系统 vs 第三方）—— CLSID 白名单或 DLL 位于 Windows 系统目录视为 system */
  classifyOriginShellExt(
    raw: PsRawShellExtItem,
    _protectionLevel: ItemProtectionLevel,
  ): 'system' | 'third-party' {
    if (SYSTEM_SHELL_EXT_CLSIDS.has(raw.actualClsid.toLowerCase())) return 'system';
    if (raw.dllPath) {
      const lc = raw.dllPath.toLowerCase().replace(/\//g, '\\');
      if (lc.includes('\\windows\\system32\\') ||
          lc.includes('\\windows\\syswow64\\') ||
          lc.includes('\\windows\\winsxs\\') ||
          lc.includes('\\windows\\immersivecontrolpanel\\') ||
          lc.match(/^[a-z]:\\windows\\[^\\]+\.dll$/i)) {
        return 'system';
      }
    }
    return 'third-party';
  }
}

const SYSTEM_SHELL_EXT_CLSIDS = new Set([
  '{f81e9010-6ea4-11ce-a7ff-00aa003ca9f6}', // Shell DocObject Viewer
  '{90aa3a4e-1cba-4233-b8bb-535773d48449}', // 共享
  '{ffe2a43c-56b9-4bf5-9a79-cc6d4285608a}', // CopyAsPath
  '{7ad84985-87b4-4a16-be58-8b72a5b390f7}', // CopyAsPathMenu
  '{49707377-a065-4a55-a672-40d0c9a30529}', // PlayTo Menu
  '{e2bf9676-5f8f-435c-97eb-11607a5bedf7}', // 新建
  '{d969a300-e7ff-11d0-a93b-00a0c90f2719}', // 任务栏固定
  '{b63ea76d-1f85-456f-a19c-48159efa858b}', // 快速访问固定
  '{081e31a0-8c7a-48cc-93b1-ed49cc3a8ac7}', // 开始菜单固定
]);
