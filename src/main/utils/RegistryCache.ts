import { MenuScene } from '../../shared/enums';
import { MenuItemEntry } from '../../shared/types';
import log from './logger';

interface CacheEntry {
  data: MenuItemEntry[];
  timestamp: number;
  hitCount: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
}

/**
 * 注册表查询结果缓存管理器
 * 支持 TTL 过期机制和场景级缓存隔离
 */
export class RegistryCache {
  private readonly cache = new Map<MenuScene, CacheEntry>();
  private readonly stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  constructor(private readonly ttlMs: number = 30000) {}

  /**
   * 获取缓存的菜单条目
   * @param scene 菜单场景
   * @returns 缓存数据（未命中或过期返回 null）
   */
  get(scene: MenuScene): MenuItemEntry[] | null {
    const entry = this.cache.get(scene);

    if (!entry) {
      this.stats.misses++;
      log.debug(`[RegistryCache] Miss: ${scene} (not found)`);
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > this.ttlMs) {
      this.stats.misses++;
      this.cache.delete(scene);
      log.debug(`[RegistryCache] Miss: ${scene} (expired)`);
      return null;
    }

    entry.hitCount++;
    this.stats.hits++;
    log.debug(`[RegistryCache] Hit: ${scene} (hits: ${entry.hitCount})`);
    return entry.data;
  }

  /**
   * 设置缓存数据
   * @param scene 菜单场景
   * @param data 菜单条目数据
   */
  set(scene: MenuScene, data: MenuItemEntry[]): void {
    const existing = this.cache.get(scene);
    if (existing) {
      this.stats.evictions++;
    }

    this.cache.set(scene, {
      data,
      timestamp: Date.now(),
      hitCount: 0,
    });
    log.debug(`[RegistryCache] Set: ${scene} (${data.length} items)`);
  }

  /**
   * 清除指定场景的缓存
   * @param scene 菜单场景
   */
  invalidate(scene: MenuScene): void {
    if (this.cache.has(scene)) {
      this.cache.delete(scene);
      log.debug(`[RegistryCache] Invalidated: ${scene}`);
    }
  }

  /**
   * 清除所有缓存
   */
  invalidateAll(): void {
    const count = this.cache.size;
    this.cache.clear();
    log.debug(`[RegistryCache] Invalidated all: ${count} entries`);
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats & { hitRate: number; size: number } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;
    return {
      ...this.stats,
      hitRate,
      size: this.cache.size,
    };
  }

  /**
   * 打印统计日志
   */
  logStats(): void {
    const stats = this.getStats();
    log.info(
      `[RegistryCache] Stats: hits=${stats.hits}, misses=${stats.misses}, ` +
        `hitRate=${(stats.hitRate * 100).toFixed(1)}%, size=${stats.size}, evictions=${stats.evictions}`
    );
  }

  /**
   * 检查缓存是否有效（未过期）
   * @param scene 菜单场景
   */
  isValid(scene: MenuScene): boolean {
    const entry = this.cache.get(scene);
    if (!entry) return false;
    return Date.now() - entry.timestamp <= this.ttlMs;
  }
}
