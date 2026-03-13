import { MenuScene, OperationType } from '../../shared/enums';
import { MenuItemEntry } from '../../shared/types';
import { RegistryService } from './RegistryService';
import { OperationHistoryService } from './OperationHistoryService';
import log from '../utils/logger';

interface CacheEntry {
  items: MenuItemEntry[];
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000;

export class MenuManagerService {
  private cache = new Map<MenuScene, CacheEntry>();

  constructor(
    private readonly registry: RegistryService,
    private readonly history: OperationHistoryService
  ) {}

  async getMenuItems(scene: MenuScene, forceRefresh = false): Promise<MenuItemEntry[]> {
    if (!forceRefresh) {
      const cached = this.cache.get(scene);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        log.debug(`[MenuManager] Cache hit for scene: ${scene}`);
        return cached.items;
      }
    }

    log.debug(`[MenuManager] Loading items for scene: ${scene} (forceRefresh: ${forceRefresh})`);
    const start = Date.now();
    const items = await this.registry.getMenuItems(scene);
    const elapsed = Date.now() - start;
    
    if (elapsed > 100) {
      log.info(`[MenuManager] Loaded ${items.length} items for ${scene} in ${elapsed}ms`);
    }

    this.cache.set(scene, { items, timestamp: Date.now() });
    return items;
  }

  invalidateCache(scene?: MenuScene): void {
    if (scene) {
      this.cache.delete(scene);
      log.debug(`[MenuManager] Cache invalidated for scene: ${scene}`);
    } else {
      this.cache.clear();
      log.debug('[MenuManager] All cache invalidated');
    }
  }

  /**
   * 获取所有场景的菜单条目（并行加载）
   */
  async getAllMenuItems(): Promise<Record<MenuScene, MenuItemEntry[]>> {
    const scenes = Object.values(MenuScene) as MenuScene[];
    const results = await Promise.all(
      scenes.map(async (scene) => {
        try {
          const items = await this.registry.getMenuItems(scene);
          return { scene, items, success: true };
        } catch (e) {
          log.error(`Failed to load scene ${scene}:`, e);
          return { scene, items: [] as MenuItemEntry[], success: false };
        }
      })
    );

    const allItems: Record<MenuScene, MenuItemEntry[]> = {
      [MenuScene.Desktop]: [],
      [MenuScene.File]: [],
      [MenuScene.Folder]: [],
      [MenuScene.Drive]: [],
      [MenuScene.DirectoryBackground]: [],
      [MenuScene.RecycleBin]: [],
    };

    for (const result of results) {
      allItems[result.scene] = result.items;
    }

    return allItems;
  }

  async enableItem(item: MenuItemEntry): Promise<{ newRegistryKey?: string }> {
    if (item.isEnabled) return {};
    const result = await this.registry.setItemEnabled(item.registryKey, true);
    if (result.newRegistryKey) item.registryKey = result.newRegistryKey;
    item.isEnabled = true;
    
    // 操作成功后清除对应场景的缓存
    this.registry.invalidateCache(item.menuScene);
    log.debug(`Cache invalidated for scene ${item.menuScene} after enabling ${item.name}`);
    
    this.history.recordOperation(
      OperationType.Enable,
      item.name,
      item.registryKey,
      'false',
      'true'
    );
    log.info(`[MenuManager] Enabled: ${item.name}`);
    return result;
  }

  async disableItem(item: MenuItemEntry): Promise<{ newRegistryKey?: string }> {
    if (!item.isEnabled) return {};
    const result = await this.registry.setItemEnabled(item.registryKey, false);
    if (result.newRegistryKey) item.registryKey = result.newRegistryKey;
    item.isEnabled = false;
    
    // 操作成功后清除对应场景的缓存
    this.registry.invalidateCache(item.menuScene);
    log.debug(`Cache invalidated for scene ${item.menuScene} after disabling ${item.name}`);
    
    this.history.recordOperation(
      OperationType.Disable,
      item.name,
      item.registryKey,
      'true',
      'false'
    );
    log.info(`[MenuManager] Disabled: ${item.name}`);
    return result;
  }

  async toggleItem(item: MenuItemEntry): Promise<{ newRegistryKey?: string }> {
    if (item.isEnabled) {
      return this.disableItem(item);
    } else {
      return this.enableItem(item);
    }
  }

  async batchEnable(items: MenuItemEntry[]): Promise<void> {
    const targets = items.filter((i) => !i.isEnabled);
    if (!targets.length) return;

    // 收集需要清除缓存的场景
    const affectedScenes = new Set<MenuScene>();
    
    this.registry.createRollbackPoint(targets);
    try {
      for (const item of targets) {
        await this.enableItem(item);
        affectedScenes.add(item.menuScene);
      }
      this.registry.commitTransaction();
      this.cache.clear();
    } catch (e) {
      await this.registry.rollback();
      throw new Error(`批量启用失败，已回滚: ${(e as Error).message}`);
    }
  }

  async batchDisable(items: MenuItemEntry[]): Promise<void> {
    const targets = items.filter((i) => i.isEnabled);
    if (!targets.length) return;

    // 收集需要清除缓存的场景
    const affectedScenes = new Set<MenuScene>();
    
    this.registry.createRollbackPoint(targets);
    try {
      for (const item of targets) {
        await this.disableItem(item);
        affectedScenes.add(item.menuScene);
      }
      this.registry.commitTransaction();
      this.cache.clear();
    } catch (e) {
      await this.registry.rollback();
      throw new Error(`批量禁用失败，已回滚: ${(e as Error).message}`);
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): ReturnType<RegistryService['getCacheStats']> {
    return this.registry.getCacheStats();
  }

  /**
   * 打印缓存统计日志
   */
  logCacheStats(): void {
    this.registry.logCacheStats();
  }
}
