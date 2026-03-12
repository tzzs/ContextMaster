import { MenuScene, OperationType } from '../../shared/enums';
import { MenuItemEntry } from '../../shared/types';
import { RegistryService } from './RegistryService';
import { OperationHistoryService } from './OperationHistoryService';
import log from '../utils/logger';

export class MenuManagerService {
  constructor(
    private readonly registry: RegistryService,
    private readonly history: OperationHistoryService
  ) {}

  async getMenuItems(scene: MenuScene): Promise<MenuItemEntry[]> {
    return this.registry.getMenuItems(scene);
  }

  async enableItem(item: MenuItemEntry): Promise<{ newRegistryKey?: string }> {
    if (item.isEnabled) return {};
    const result = await this.registry.setItemEnabled(item.registryKey, true);
    if (result.newRegistryKey) item.registryKey = result.newRegistryKey;
    item.isEnabled = true;
    this.history.recordOperation(
      OperationType.Enable,
      item.name,
      item.registryKey,
      'false',
      'true'
    );
    log.info(`Enabled: ${item.name}`);
    return result;
  }

  async disableItem(item: MenuItemEntry): Promise<{ newRegistryKey?: string }> {
    if (!item.isEnabled) return {};
    const result = await this.registry.setItemEnabled(item.registryKey, false);
    if (result.newRegistryKey) item.registryKey = result.newRegistryKey;
    item.isEnabled = false;
    this.history.recordOperation(
      OperationType.Disable,
      item.name,
      item.registryKey,
      'true',
      'false'
    );
    log.info(`Disabled: ${item.name}`);
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

    this.registry.createRollbackPoint(targets);
    try {
      for (const item of targets) {
        await this.enableItem(item);
      }
      this.registry.commitTransaction();
    } catch (e) {
      await this.registry.rollback();
      throw new Error(`批量启用失败，已回滚: ${(e as Error).message}`);
    }
  }

  async batchDisable(items: MenuItemEntry[]): Promise<void> {
    const targets = items.filter((i) => i.isEnabled);
    if (!targets.length) return;

    this.registry.createRollbackPoint(targets);
    try {
      for (const item of targets) {
        await this.disableItem(item);
      }
      this.registry.commitTransaction();
    } catch (e) {
      await this.registry.rollback();
      throw new Error(`批量禁用失败，已回滚: ${(e as Error).message}`);
    }
  }
}
