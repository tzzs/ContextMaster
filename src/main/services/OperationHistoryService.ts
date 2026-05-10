import { OperationType, MenuScene, MenuItemType } from '../../shared/enums';
import { OperationRecord, MenuItemEntry } from '../../shared/types';
import { OperationRecordRepo } from '../data/repositories/OperationRecordRepo';
import { MenuManagerService } from './MenuManagerService';
import log from '../utils/logger';

export class OperationHistoryService {
  constructor(private readonly repo: OperationRecordRepo) {}

  recordOperation(
    operationType: OperationType,
    targetEntryName: string,
    registryPath: string,
    oldValue?: string,
    newValue?: string
  ): void {
    this.repo.insert({
      timestamp: new Date().toISOString(),
      operationType,
      targetEntryName,
      registryPath,
      oldValue: oldValue ?? null,
      newValue: newValue ?? null,
    });
  }

  getAllRecords(): OperationRecord[] {
    log.debug('[History] Getting all records');
    return this.repo.findAll();
  }

  clearAll(): void {
    log.warn('[History] Clearing all operation records');
    this.repo.deleteAll();
  }

  async undoOperation(
    recordId: number,
    menuManager: MenuManagerService
  ): Promise<void> {
    const record = this.repo.findById(recordId);
    if (!record) throw new Error('找不到要撤销的操作记录');

    if (
      record.operationType !== OperationType.Enable &&
      record.operationType !== OperationType.Disable
    ) {
      throw new Error('不支持该类型操作的撤销');
    }

    const wasEnabled = record.operationType === OperationType.Enable;
    log.info(`[History] Undo operation: recordId=${recordId}, type=${record.operationType}, target=${record.targetEntryName}, reverting to ${wasEnabled ? 'disabled' : 'enabled'}`);

    const tempItem: MenuItemEntry = {
      id: -1,
      name: record.targetEntryName,
      command: '',
      iconPath: null,
      isEnabled: wasEnabled,
      source: '',
      menuScene: determineSceneFromRegistryKey(record.registryPath),
      registryKey: record.registryPath,
      type: MenuItemType.System,
    };

    if (wasEnabled) {
      await menuManager.disableItem(tempItem);
    } else {
      await menuManager.enableItem(tempItem);
    }

    menuManager.invalidateCache(tempItem.menuScene);
    log.info(`[History] Undo completed: ${record.targetEntryName} -> ${wasEnabled ? 'disabled' : 'enabled'}`);
  }
}

function determineSceneFromRegistryKey(registryKey: string): MenuScene {
  if (registryKey.includes('Directory\\Background')) return MenuScene.DirectoryBackground;
  if (registryKey.includes('DesktopBackground')) return MenuScene.Desktop;
  if (registryKey.includes('CLSID\\{645FF040')) return MenuScene.RecycleBin;
  if (registryKey.includes('Drive\\shell')) return MenuScene.Drive;
  if (registryKey.includes('Directory\\shell')) return MenuScene.Folder;
  if (registryKey.includes('*\\')) return MenuScene.File;
  throw new Error(`无法从注册表路径确定场景: ${registryKey}`);
}
