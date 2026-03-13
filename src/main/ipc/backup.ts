import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { BackupType } from '../../shared/enums';
import { BackupService } from '../services/BackupService';
import { wrapHandler } from '../utils/ipcWrapper';
import log from '../utils/logger';

export function registerBackupHandlers(backup: BackupService): void {
  ipcMain.handle(
    IPC.BACKUP_GET_ALL,
    wrapHandler(() => {
      log.debug('[Backup] Getting all backups');
      return backup.getAllBackups();
    })
  );

  ipcMain.handle(
    IPC.BACKUP_CREATE,
    wrapHandler((_event: unknown, name: string) => {
      log.info(`[Backup] Creating backup: ${name}`);
      return backup.createBackup(name, BackupType.Manual);
    })
  );

  ipcMain.handle(
    IPC.BACKUP_RESTORE,
    wrapHandler((_event: unknown, snapshotId: number) => {
      log.info(`[Backup] Restoring backup: snapshotId=${snapshotId}`);
      return backup.restoreBackup(snapshotId);
    })
  );

  ipcMain.handle(
    IPC.BACKUP_DELETE,
    wrapHandler((_event: unknown, id: number) => {
      log.warn(`[Backup] Deleting backup: id=${id}`);
      backup.deleteBackup(id);
      return true;
    })
  );

  ipcMain.handle(
    IPC.BACKUP_EXPORT,
    wrapHandler(async (event: Electron.IpcMainInvokeEvent, snapshotId: number) => {
      log.info(`[Backup] Exporting backup: snapshotId=${snapshotId}`);
      const win = BrowserWindow.fromWebContents(event.sender)!;
      await backup.exportBackup(snapshotId, win);
      return true;
    })
  );

  ipcMain.handle(
    IPC.BACKUP_IMPORT,
    wrapHandler(async (event: Electron.IpcMainInvokeEvent) => {
      log.info('[Backup] Importing backup');
      const win = BrowserWindow.fromWebContents(event.sender)!;
      return backup.importBackup(win);
    })
  );

  ipcMain.handle(
    IPC.BACKUP_PREVIEW_DIFF,
    wrapHandler((_event: unknown, snapshotId: number) => {
      log.debug(`[Backup] Previewing restore diff: snapshotId=${snapshotId}`);
      return backup.previewRestoreDiff(snapshotId);
    })
  );
}
