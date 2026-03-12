import { ipcMain, BrowserWindow, clipboard, shell, app } from 'electron';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { IPC } from '../../shared/ipc-channels';
import { isAdmin, restartAsAdmin } from '../utils/AdminHelper';
import { wrapHandler } from '../utils/ipcWrapper';
import log, { getLogDir } from '../utils/logger';

const execFileAsync = promisify(execFile);

export function registerSystemHandlers(): void {
  ipcMain.handle(IPC.SYS_IS_ADMIN, wrapHandler(() => isAdmin()));

  ipcMain.handle(IPC.SYS_RESTART_AS_ADMIN, wrapHandler(() => {
    restartAsAdmin();
    return true;
  }));

  ipcMain.handle(
    IPC.SYS_OPEN_REGEDIT,
    wrapHandler(async (_event: unknown, fullRegPath: string) => {
      log.info('[Regedit] 收到路径:', fullRegPath);

      // regedit 根节点名称随系统 UI 语言本地化，用 app.getLocale() 直接检测
      const locale = app.getLocale();
      const isChinese = locale.startsWith('zh');
      const computerPrefix = isChinese ? '计算机' : 'Computer';
      log.info('[Regedit] locale:', locale, '→ 根节点前缀:', computerPrefix);

      const normalizedPath = `${computerPrefix}\\${fullRegPath}`;
      log.info('[Regedit] 规范化路径:', normalizedPath);

      // 用 reg.exe 写入 LastKey
      try {
        const { stdout, stderr } = await execFileAsync('reg.exe', [
          'add',
          'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Applets\\Regedit',
          '/v', 'LastKey', '/t', 'REG_SZ', '/d', normalizedPath, '/f',
        ]);
        log.info('[Regedit] reg.exe 成功, stdout:', stdout.trim(), 'stderr:', stderr.trim());
      } catch (e) {
        log.error('[Regedit] reg.exe 失败:', e);
        throw e;
      }

      // 关闭已有 regedit（单实例，必须重启才会读取新的 LastKey）
      try {
        const { stdout } = await execFileAsync('taskkill.exe', ['/F', '/IM', 'regedit.exe']);
        log.info('[Regedit] taskkill 成功:', stdout.trim());
        await new Promise<void>((resolve) => setTimeout(resolve, 400));
      } catch (_e) {
        log.info('[Regedit] taskkill 失败（regedit 未运行，正常）');
      }

      // 通过 cmd /c start 启动 regedit
      // 直接 execFile('regedit.exe') 在管理员上下文会报 EACCES，需借道 cmd
      log.info('[Regedit] 启动 regedit.exe (via cmd)');
      const child = execFile('cmd.exe', ['/c', 'start', '', 'regedit.exe'], { detached: true });
      child.on('error', (err) => log.error('[Regedit] regedit.exe 启动失败:', err));
      child.unref();

      log.info('[Regedit] 完成');
      return true;
    })
  );

  ipcMain.handle(
    IPC.SYS_OPEN_LOG_DIR,
    wrapHandler(async () => {
      const dir = getLogDir();
      log.info('[System] 打开日志目录:', dir);
      const err = await shell.openPath(dir);
      if (err) throw new Error(err);
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

  ipcMain.handle(
    IPC.SYS_OPEN_EXTERNAL,
    wrapHandler((_event: unknown, url: string) => shell.openExternal(url))
  );

  // 窗口控制
  ipcMain.handle(IPC.WIN_MINIMIZE, (_event) => {
    const win = BrowserWindow.getFocusedWindow();
    win?.minimize();
  });

  ipcMain.handle(IPC.WIN_MAXIMIZE, (_event) => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return;
    if (win.isMaximized()) { win.unmaximize(); } else { win.maximize(); }
  });

  ipcMain.handle(IPC.WIN_CLOSE, (_event) => {
    const win = BrowserWindow.getFocusedWindow();
    win?.close();
  });

  ipcMain.handle(IPC.WIN_IS_MAXIMIZED, (_event) => {
    return BrowserWindow.getFocusedWindow()?.isMaximized() ?? false;
  });
}
