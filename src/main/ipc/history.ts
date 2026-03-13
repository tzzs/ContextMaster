import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { OperationHistoryService } from '../services/OperationHistoryService';
import { MenuManagerService } from '../services/MenuManagerService';
import { wrapHandler } from '../utils/ipcWrapper';
import log from '../utils/logger';

export function registerHistoryHandlers(
  history: OperationHistoryService,
  menuManager: MenuManagerService
): void {
  ipcMain.handle(
    IPC.HISTORY_GET_ALL,
    wrapHandler(() => {
      log.debug('[History] Getting all records');
      return history.getAllRecords();
    })
  );

  ipcMain.handle(
    IPC.HISTORY_UNDO,
    wrapHandler((_event: unknown, recordId: number) => {
      log.info(`[History] Undo operation requested: recordId=${recordId}`);
      return history.undoOperation(recordId, menuManager);
    })
  );

  ipcMain.handle(
    IPC.HISTORY_CLEAR,
    wrapHandler(() => {
      log.warn('[History] Clear all records requested');
      history.clearAll();
      return true;
    })
  );
}
