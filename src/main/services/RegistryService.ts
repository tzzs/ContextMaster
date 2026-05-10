import { MenuScene, MenuItemType } from '../../shared/enums';
import { MenuItemEntry } from '../../shared/types';
import { PowerShellBridge } from './PowerShellBridge';
import { RegistryCache } from '../utils/RegistryCache';
import { ShellExtNameResolver, CommandStoreIndex, PsRawClassicItem, PsRawShellExtItem } from './ShellExtNameResolver';
import log from '../utils/logger';

// 与 C# RegistryService._sceneRegistryPaths 完全一致
const SCENE_REGISTRY_PATHS: Record<MenuScene, string> = {
  [MenuScene.Desktop]:            'DesktopBackground\\Shell',
  [MenuScene.File]:               '*\\shell',
  [MenuScene.Folder]:             'Directory\\shell',
  [MenuScene.Drive]:              'Drive\\shell',
  [MenuScene.DirectoryBackground]:'Directory\\Background\\shell',
  [MenuScene.RecycleBin]:         'CLSID\\{645FF040-5081-101B-9F08-00AA002F954E}\\shell',
};

// Shell 扩展（COM）注册路径：shellex\ContextMenuHandlers
const SCENE_SHELLEX_PATHS: Record<MenuScene, string> = {
  [MenuScene.Desktop]:            'DesktopBackground\\shellex\\ContextMenuHandlers',
  [MenuScene.File]:               '*\\shellex\\ContextMenuHandlers',
  [MenuScene.Folder]:             'Directory\\shellex\\ContextMenuHandlers',
  [MenuScene.Drive]:              'Drive\\shellex\\ContextMenuHandlers',
  [MenuScene.DirectoryBackground]:'Directory\\Background\\shellex\\ContextMenuHandlers',
  [MenuScene.RecycleBin]:         'CLSID\\{645FF040-5081-101B-9F08-00AA002F954E}\\shellex\\ContextMenuHandlers',
};

// 完整 HKCR 前缀（用于显示）
const HKCR_PREFIX = 'HKEY_CLASSES_ROOT';

export class RegistryService {
  private readonly ps: PowerShellBridge;
  private readonly cache: RegistryCache;
  private readonly resolver: ShellExtNameResolver;
  private readonly cmdStoreIndex: CommandStoreIndex;
  /** 事务回滚数据：registryKey → 原始 isEnabled */
  private rollbackData = new Map<string, boolean>();
  private inTransaction = false;
  private nextId = 1;

  constructor(
    ps: PowerShellBridge,
    resolver: ShellExtNameResolver,
    cmdStoreIndex: CommandStoreIndex,
    cache?: RegistryCache,
  ) {
    this.ps = ps;
    this.resolver = resolver;
    this.cmdStoreIndex = cmdStoreIndex;
    this.cache = cache ?? new RegistryCache();
  }

  /**
   * 获取指定场景下的所有菜单条目（Classic Shell + Shell 扩展）
   * 优先从缓存读取，缓存未命中时执行 PowerShell 查询
   */
  async getMenuItems(scene: MenuScene, priority: 'high' | 'normal' = 'normal'): Promise<MenuItemEntry[]> {
    // 尝试从缓存读取
    const cached = this.cache.get(scene);
    if (cached) {
      log.debug(`RegistryService: Returning cached data for ${scene} (${cached.length} items)`);
      return cached;
    }

    const basePath = SCENE_REGISTRY_PATHS[scene];
    const shellexPath = SCENE_SHELLEX_PATHS[scene];

    try {
      // 并行读取 Classic Shell 命令 + Shell 扩展（COM ContextMenuHandlers）
      const script = this.ps.buildGetItemsScript(basePath);
      const shellexScript = this.ps.buildGetShellExtItemsScript(shellexPath);
      const [raw, shellexRaw] = await Promise.all([
        this.ps.execute<PsRawClassicItem[]>(script, priority),
        this.ps.execute<PsRawShellExtItem[]>(shellexScript, priority).catch((e) => {
          log.warn(`getMenuItems shellex(${scene}) failed (non-fatal):`, e);
          return [] as PsRawShellExtItem[];
        }),
      ]);
      const classicItems = Array.isArray(raw) ? raw : (raw ? [raw] : []);
      const shellexItems = Array.isArray(shellexRaw) ? shellexRaw : [];

      // Classic Shell 条目：通过 resolver 解析名称（保护：单条失败不影响整体）
      const classicEntries: MenuItemEntry[] = classicItems.map((r: PsRawClassicItem) => {
        let name: string;
        try {
          name = this.cleanDisplayName(this.resolver.resolveClassicName(r));
        } catch (e) {
          log.warn(`[RegistryService] resolveClassicName failed for "${r.subKeyName}":`, String(e));
          name = this.cleanDisplayName(r.subKeyName);
        }
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
        };
      });

      // Shell 扩展条目：通过 resolver 解析名称（保护：单条失败不影响整体）
      const shellexEntries: MenuItemEntry[] = shellexItems.map((r: PsRawShellExtItem) => {
        let name: string;
        try {
          name = this.cleanDisplayName(this.resolver.resolveExtName(r, this.cmdStoreIndex));
        } catch (e) {
          log.warn(`[RegistryService] resolveExtName failed for "${r.cleanName}":`, String(e));
          name = this.cleanDisplayName(r.cleanName);
        }
        return {
          id: this.nextId++,
          name,
          command: r.actualClsid,
          iconPath: null,
          isEnabled: r.isEnabled,
          source: r.handlerKeyName,
          menuScene: scene,
          registryKey: r.registryKey,
          type: MenuItemType.ShellExt,
          dllPath: r.dllPath ?? null,
        };
      });

      const result = [...classicEntries, ...shellexEntries];

      // 逐条诊断日志: 打印每个 ShellExt 条目的解析结果和原始数据
      for (let i = 0; i < shellexEntries.length; i++) {
        const entry = shellexEntries[i];
        const raw = shellexItems[i];
        log.info(`[ResolveTrace] ${scene} | "${entry.name}" ← cleanName="${raw.cleanName}" clsid=${raw.actualClsid} dll=${raw.dllPath || 'none'} clsidDef="${raw.clsidDefault || ''}" clsidLS="${raw.clsidLocalizedString || ''}" clsidMUI="${raw.clsidMUIVerb || ''}" progId="${raw.progIdName || ''}" dllDesc="${raw.dllFileDescription || ''}" dllProd="${raw.dllProductName || ''}" siblingMUI="${raw.siblingMUIVerb || ''}" defVal="${raw.defaultVal || ''}"`);
      }

      // 写入缓存
      this.cache.set(scene, result);
      
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
    return `${HKCR_PREFIX}\\${SCENE_REGISTRY_PATHS[scene]}`;
  }

  /**
   * 清除指定场景的缓存
   */
  invalidateCache(scene: MenuScene): void {
    this.cache.invalidate(scene);
  }

  /**
   * 清除所有缓存
   */
  invalidateAllCache(): void {
    this.cache.invalidateAll();
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): ReturnType<RegistryCache['getStats']> {
    return this.cache.getStats();
  }

  /**
   * 打印缓存统计日志
   */
  logCacheStats(): void {
    this.cache.logStats();
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

}
