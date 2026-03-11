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

interface PsMenuItemRaw {
  name: string;
  command: string;
  iconPath: string | null;
  isEnabled: boolean;
  source: string;
  registryKey: string;
  subKeyName: string;
  itemType?: string;  // 'ShellExt' for shell extensions
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
   * 获取指定场景下的所有菜单条目（Classic Shell + Shell 扩展）
   */
  async getMenuItems(scene: MenuScene): Promise<MenuItemEntry[]> {
    const basePath = SCENE_REGISTRY_PATHS[scene];
    const shellexPath = SCENE_SHELLEX_PATHS[scene];
    try {
      // 读取 Classic Shell 命令
      const script = this.ps.buildGetItemsScript(basePath);
      const raw = await this.ps.execute<PsMenuItemRaw[]>(script);
      const items = Array.isArray(raw) ? raw : (raw ? [raw] : []);

      // 读取 Shell 扩展（COM ContextMenuHandlers），失败不阻断主流程
      let shellexItems: PsMenuItemRaw[] = [];
      try {
        const shellexScript = this.ps.buildGetShellExtItemsScript(shellexPath);
        const shellexRaw = await this.ps.execute<PsMenuItemRaw[]>(shellexScript);
        shellexItems = Array.isArray(shellexRaw) ? shellexRaw : (shellexRaw ? [shellexRaw] : []);
      } catch (e) {
        log.warn(`getMenuItems shellex(${scene}) failed (non-fatal):`, e);
      }

      return [...items, ...shellexItems].map((r) => ({
        id: this.nextId++,
        name: r.name,
        command: r.command,
        iconPath: r.iconPath,
        isEnabled: r.isEnabled,
        source: r.source || this.inferSource(r.subKeyName),
        menuScene: scene,
        registryKey: r.registryKey,
        type: this.determineType(r.itemType),
      }));
    } catch (e) {
      log.error(`getMenuItems(${scene}) failed:`, e);
      throw new Error(`读取注册表场景 ${scene} 失败: ${(e as Error).message}`);
    }
  }

  /**
   * 启用或禁用单个菜单条目
   * ShellExt 通过重命名键（±前缀）实现；Classic Shell 通过 LegacyDisable 值实现
   * 返回 newRegistryKey（仅 ShellExt 会变化）
   */
  async setItemEnabled(registryKey: string, enabled: boolean): Promise<{ newRegistryKey?: string }> {
    try {
      if (this.isShellExtKey(registryKey)) {
        const script = this.ps.buildShellExtToggleScript(registryKey, enabled);
        await this.ps.execute<{ ok: boolean }>(script);
        return { newRegistryKey: this.computeShellExtNewKey(registryKey, enabled) };
      } else {
        const script = this.ps.buildSetEnabledScript(registryKey, enabled);
        await this.ps.execute<{ ok: boolean }>(script);
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
    if (this.isShellExtKey(registryKey)) {
      const script = this.ps.buildShellExtToggleScript(registryKey, enabled);
      await this.ps.execute<{ ok: boolean }>(script);
    } else {
      const script = this.ps.buildSetEnabledScript(registryKey, enabled);
      await this.ps.execute<{ ok: boolean }>(script);
    }
  }

  /** Shell 扩展的 registryKey 包含 'shellex' 和 'ContextMenuHandlers' 路径段 */
  private isShellExtKey(registryKey: string): boolean {
    return registryKey.includes('shellex') && registryKey.includes('ContextMenuHandlers');
  }

  /**
   * 计算 ShellExt 切换后的新 registryKey
   * enable: ...ContextMenuHandlers\-Name → ...ContextMenuHandlers\Name
   * disable: ...ContextMenuHandlers\Name → ...ContextMenuHandlers\-Name
   */
  private computeShellExtNewKey(registryKey: string, enable: boolean): string {
    const lastSlash = registryKey.lastIndexOf('\\');
    const parentPath = registryKey.substring(0, lastSlash);
    const keyName = registryKey.substring(lastSlash + 1);
    const cleanName = keyName.replace(/^-+/, '');
    const newKeyName = enable ? cleanName : `-${cleanName}`;
    return `${parentPath}\\${newKeyName}`;
  }

  private inferSource(subKeyName: string): string {
    return subKeyName || '';
  }

  private determineType(itemType?: string): MenuItemType {
    if (itemType === 'ShellExt') return MenuItemType.ShellExt;
    return MenuItemType.System;
  }
}
