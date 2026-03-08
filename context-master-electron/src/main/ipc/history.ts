import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { OperationHistoryService } from '../services/OperationHistoryService';
import { MenuManagerService } from '../services/MenuManagerService';
import { wrapHandler } from '../utils/ipcWrapper';

export function registerHistoryHandlers(
  history: OperationHistoryService,
  menuManager: MenuManagerService
): void {
  ipcMain.handle(
    IPC.HISTORY_GET_ALL,
    wrapHandler(() => history.getAllRecords())
  );

  ipcMain.handle(
    IPC.HISTORY_UNDO,
    wrapHandler((_event: unknown, recordId: number) =>
      history.undoOperation(recordId, menuManager)
    )
  );

  ipcMain.handle(
    IPC.HISTORY_CLEAR,
    wrapHandler(() => { history.clearAll(); return true; })
  );
}
