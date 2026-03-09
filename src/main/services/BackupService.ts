import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { dialog, BrowserWindow } from 'electron';
import { BackupType, MenuScene, OperationType } from '../../shared/enums';
import { BackupSnapshot, MenuItemEntry, RestoreDiffItem } from '../../shared/types';
import { BackupSnapshotRepo } from '../data/repositories/BackupSnapshotRepo';
import { MenuManagerService } from './MenuManagerService';
import { OperationHistoryService } from './OperationHistoryService';
import log from '../utils/logger';

export class BackupService {
  constructor(
    private readonly repo: BackupSnapshotRepo,
    private readonly menuManager: MenuManagerService,
    private readonly history: OperationHistoryService
  ) {}

  async createBackup(name: string, type = BackupType.Manual): Promise<BackupSnapshot> {
    const allItems: MenuItemEntry[] = [];
    for (const scene of Object.values(MenuScene)) {
      const items = await this.menuManager.getMenuItems(scene);
      allItems.push(...items);
    }

    const jsonData = JSON.stringify(allItems);
    const checksum = createHash('sha256').update(jsonData).digest('hex');

    const snapshot = this.repo.insert({
      name,
      creationTime: new Date().toISOString(),
      type,
      menuItemsJson: jsonData,
      sha256Checksum: checksum,
    });

    this.history.recordOperation(OperationType.Backup, name, '', '', checksum);
    log.info(`Backup created: ${name} (${allItems.length} items)`);
    return snapshot;
  }

  async restoreBackup(snapshotId: number): Promise<void> {
    const snapshot = this.repo.findById(snapshotId);
    if (!snapshot) throw new Error('找不到备份快照');

    const expectedChecksum = createHash('sha256')
      .update(snapshot.menuItemsJson)
      .digest('hex');
    if (expectedChecksum !== snapshot.sha256Checksum) {
      throw new Error('备份校验失败，文件可能已被篡改');
    }

    // 还原前先自动创建备份
    await this.createBackup(
      `AutoBackup_BeforeRestore_${new Date().toISOString().replace(/[:.]/g, '-')}`,
      BackupType.Auto
    );

    const itemsToRestore: MenuItemEntry[] = JSON.parse(snapshot.menuItemsJson);
    if (!itemsToRestore.length) throw new Error('备份文件中没有有效的菜单项数据');

    const allCurrentItems: MenuItemEntry[] = [];
    for (const scene of Object.values(MenuScene)) {
      allCurrentItems.push(...(await this.menuManager.getMenuItems(scene)));
    }

    const toEnable: MenuItemEntry[] = [];
    const toDisable: MenuItemEntry[] = [];

    for (const backupItem of itemsToRestore) {
      const current = allCurrentItems.find((i) => i.registryKey === backupItem.registryKey);
      if (current && current.isEnabled !== backupItem.isEnabled) {
        current.isEnabled = backupItem.isEnabled;
        if (backupItem.isEnabled) toEnable.push(current);
        else toDisable.push(current);
      }
    }

    if (toEnable.length) await this.menuManager.batchEnable(toEnable);
    if (toDisable.length) await this.menuManager.batchDisable(toDisable);

    this.history.recordOperation(OperationType.Restore, snapshot.name, '', '', snapshotId.toString());
    log.info(`Restore completed from backup: ${snapshot.name}`);
  }

  async deleteBackup(id: number): Promise<void> {
    this.repo.delete(id);
  }

  getAllBackups(): BackupSnapshot[] {
    return this.repo.findAll();
  }

  async previewRestoreDiff(snapshotId: number): Promise<RestoreDiffItem[]> {
    const snapshot = this.repo.findById(snapshotId);
    if (!snapshot) throw new Error('找不到备份快照');

    const backupItems: MenuItemEntry[] = JSON.parse(snapshot.menuItemsJson);
    const currentItems: MenuItemEntry[] = [];
    for (const scene of Object.values(MenuScene)) {
      currentItems.push(...(await this.menuManager.getMenuItems(scene)));
    }

    const diff: RestoreDiffItem[] = [];
    for (const backupItem of backupItems) {
      const current = currentItems.find((i) => i.registryKey === backupItem.registryKey);
      if (current && current.isEnabled !== backupItem.isEnabled) {
        diff.push({ current, backup: backupItem });
      }
    }
    return diff;
  }

  async exportBackup(snapshotId: number, win: BrowserWindow): Promise<void> {
    const snapshot = this.repo.findById(snapshotId);
    if (!snapshot) throw new Error('找不到备份快照');

    const { filePath, canceled } = await dialog.showSaveDialog(win, {
      title: '导出备份文件',
      defaultPath: `${snapshot.name.replace(/[\\/:*?"<>|]/g, '_')}.cmbackup`,
      filters: [{ name: 'ContextMaster Backup', extensions: ['cmbackup'] }],
    });

    if (canceled || !filePath) return;
    await fs.writeFile(filePath, snapshot.menuItemsJson, 'utf-8');
    log.info(`Backup exported to: ${filePath}`);
  }

  async importBackup(win: BrowserWindow): Promise<BackupSnapshot> {
    const { filePaths, canceled } = await dialog.showOpenDialog(win, {
      title: '导入备份文件',
      filters: [
        { name: 'ContextMaster Backup', extensions: ['cmbackup'] },
        { name: 'JSON Files', extensions: ['json'] },
      ],
      properties: ['openFile'],
    });

    if (canceled || !filePaths.length) throw new Error('未选择文件');

    const filePath = filePaths[0];
    const jsonData = await fs.readFile(filePath, 'utf-8');
    const checksum = createHash('sha256').update(jsonData).digest('hex');

    const snapshot = this.repo.insert({
      name: `导入 · ${require('path').basename(filePath, '.cmbackup')}`,
      creationTime: new Date().toISOString(),
      type: BackupType.Manual,
      menuItemsJson: jsonData,
      sha256Checksum: checksum,
    });

    log.info(`Backup imported from: ${filePath}`);
    return snapshot;
  }
}
