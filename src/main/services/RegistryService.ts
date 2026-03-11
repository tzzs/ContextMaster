import { MenuScene, MenuItemType } from '../../shared/enums';
import { MenuItemEntry } from '../../shared/types';
import { PowerShellBridge } from './PowerShellBridge';
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

// 完整 HKCR 前缀（用于显示）
const HKCR_PREFIX = 'HKEY_CLASSES_ROOT';

interface PsMenuItemRaw {
  name: string;
  command: string;
  iconPath: string | null;
  isEnabled: boolean;
  source: string;
  registryKey: string;
  subKeyName: string;
}

export class RegistryService {
  private readonly ps: PowerShellBridge;
  /** 事务回滚数据：registryKey → 原始 isEnabled */
  private rollbackData = new Map<string, boolean>();
  private inTransaction = false;
  private nextId = 1;

  constructor(ps: PowerShellBridge) {
    this.ps = ps;
  }

  /**
   * 获取指定场景下的所有菜单条目
   */
  async getMenuItems(scene: MenuScene): Promise<MenuItemEntry[]> {
    const basePath = SCENE_REGISTRY_PATHS[scene];
    try {
      const script = this.ps.buildGetItemsScript(basePath);
      const raw = await this.ps.execute<PsMenuItemRaw[]>(script);

      // PS 可能返回单对象（不是数组），统一转为数组
      const items = Array.isArray(raw) ? raw : (raw ? [raw] : []);

      return items.map((r) => ({
        id: this.nextId++,
        name: r.name,
        command: r.command,
        iconPath: r.iconPath,
        isEnabled: r.isEnabled,
        source: r.source || this.inferSource(r.subKeyName),
        menuScene: scene,
        registryKey: r.registryKey,
        type: this.determineType(r.subKeyName),
      }));
    } catch (e) {
      log.error(`getMenuItems(${scene}) failed:`, e);
      throw new Error(`读取注册表场景 ${scene} 失败: ${(e as Error).message}`);
    }
  }

  /**
   * 启用或禁用单个菜单条目
   */
  async setItemEnabled(registryKey: string, enabled: boolean): Promise<void> {
    try {
      const script = this.ps.buildSetEnabledScript(registryKey, enabled);
      await this.ps.executeElevated<string>(script);
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
    try {
      for (const [key, wasEnabled] of this.rollbackData) {
        await this.setItemEnabledInternal(key, wasEnabled);
      }
    } finally {
      this.inTransaction = false;
      this.rollbackData.clear();
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

  private async setItemEnabledInternal(registryKey: string, enabled: boolean): Promise<void> {
    const script = this.ps.buildSetEnabledScript(registryKey, enabled);
    await this.ps.execute<string>(script);
  }

  private inferSource(subKeyName: string): string {
    // 简单启发式：首字母大写子键名推断来源
    return subKeyName || '';
  }

  private determineType(subKeyName: string): MenuItemType {
    // 系统内置通常以已知前缀命名，这里默认都标为 System
    // 实际扩展可通过检查 Owner 等属性区分
    return MenuItemType.System;
  }
}
