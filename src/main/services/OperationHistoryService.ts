import { OperationType, MenuScene, MenuItemType } from '../../shared/enums';
import { OperationRecord, MenuItemEntry } from '../../shared/types';
import { OperationRecordRepo } from '../data/repositories/OperationRecordRepo';
import { MenuManagerService } from './MenuManagerService';

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
    return this.repo.findAll();
  }

  clearAll(): void {
    this.repo.deleteAll();
  }

  /**
   * 单条撤销：根据操作类型执行反向操作
   * 仅支持 Enable / Disable
   */
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
  }
}

/** 与 C# DetermineSceneFromRegistryKey 逻辑一致 */
function determineSceneFromRegistryKey(registryKey: string): MenuScene {
  if (registryKey.includes('DesktopBackground')) return MenuScene.Desktop;
  if (registryKey.includes('*\\')) return MenuScene.File;
  if (
    registryKey.includes('Directory\\shell') &&
    !registryKey.includes('Directory\\Background')
  )
    return MenuScene.Folder;
  if (registryKey.includes('Drive\\shell')) return MenuScene.Drive;
  if (registryKey.includes('Directory\\Background')) return MenuScene.DirectoryBackground;
  if (registryKey.includes('CLSID')) return MenuScene.RecycleBin;
  return MenuScene.File;
}
