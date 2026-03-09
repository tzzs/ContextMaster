import { ipcMain, BrowserWindow, clipboard } from 'electron';
import { execFile } from 'child_process';
import { IPC } from '../../shared/ipc-channels';
import { isAdmin, restartAsAdmin } from '../utils/AdminHelper';
import { PowerShellBridge } from '../services/PowerShellBridge';
import { wrapHandler } from '../utils/ipcWrapper';

export function registerSystemHandlers(ps: PowerShellBridge): void {
  ipcMain.handle(IPC.SYS_IS_ADMIN, wrapHandler(() => isAdmin()));

  ipcMain.handle(IPC.SYS_RESTART_AS_ADMIN, wrapHandler(() => {
    restartAsAdmin();
    return true;
  }));

  ipcMain.handle(
    IPC.SYS_OPEN_REGEDIT,
    wrapHandler(async (_event: unknown, fullRegPath: string) => {
      const script = ps.buildOpenRegeditScript(fullRegPath);
      await ps.execute<string>(script);
      return true;
    })
  );

  ipcMain.handle(
    IPC.SYS_COPY_CLIPBOARD,
    wrapHandler((_event: unknown, text: string) => {
      clipboard.writeText(text);
      return true;
    })
  );

  // 窗口控制
  ipcMain.handle(IPC.WIN_MINIMIZE, (_event) => {
    const win = BrowserWindow.getFocusedWindow();
    win?.minimize();
  });

  ipcMain.handle(IPC.WIN_MAXIMIZE, (_event) => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return;
    win.isMaximized() ? win.unmaximize() : win.maximize();
  });

  ipcMain.handle(IPC.WIN_CLOSE, (_event) => {
    const win = BrowserWindow.getFocusedWindow();
    win?.close();
  });

  ipcMain.handle(IPC.WIN_IS_MAXIMIZED, (_event) => {
    return BrowserWindow.getFocusedWindow()?.isMaximized() ?? false;
  });
}
