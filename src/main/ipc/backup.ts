import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { BackupType } from '../../shared/enums';
import { BackupService } from '../services/BackupService';
import { wrapHandler } from '../utils/ipcWrapper';

export function registerBackupHandlers(backup: BackupService): void {
  ipcMain.handle(
    IPC.BACKUP_GET_ALL,
    wrapHandler(() => backup.getAllBackups())
  );

  ipcMain.handle(
    IPC.BACKUP_CREATE,
    wrapHandler((_event: unknown, name: string) =>
      backup.createBackup(name, BackupType.Manual)
    )
  );

  ipcMain.handle(
    IPC.BACKUP_RESTORE,
    wrapHandler((_event: unknown, snapshotId: number) =>
      backup.restoreBackup(snapshotId)
    )
  );

  ipcMain.handle(
    IPC.BACKUP_DELETE,
    wrapHandler((_event: unknown, id: number) => {
      backup.deleteBackup(id);
      return true;
    })
  );

  ipcMain.handle(
    IPC.BACKUP_EXPORT,
    wrapHandler(async (event: Electron.IpcMainInvokeEvent, snapshotId: number) => {
      const win = BrowserWindow.fromWebContents(event.sender)!;
      await backup.exportBackup(snapshotId, win);
      return true;
    })
  );

  ipcMain.handle(
    IPC.BACKUP_IMPORT,
    wrapHandler(async (event: Electron.IpcMainInvokeEvent) => {
      const win = BrowserWindow.fromWebContents(event.sender)!;
      return backup.importBackup(win);
    })
  );

  ipcMain.handle(
    IPC.BACKUP_PREVIEW_DIFF,
    wrapHandler((_event: unknown, snapshotId: number) =>
      backup.previewRestoreDiff(snapshotId)
    )
  );
}
