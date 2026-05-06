import { ipcMain, BrowserWindow, clipboard, shell, app } from 'electron';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { IPC } from '../../shared/ipc-channels';
import { isAdmin, restartAsAdmin } from '../utils/AdminHelper';
import { wrapHandler } from '../utils/ipcWrapper';
import log, { getLogDir } from '../utils/logger';
import type { IWin32Shell } from '../services/Win32Shell';

const execFileAsync = promisify(execFile);

export function registerSystemHandlers(
  win32Shell?: IWin32Shell,
  cmdStoreSize?: number,
): void {
  ipcMain.handle(
    IPC.SYS_IS_ADMIN,
    wrapHandler(() => {
      log.debug('[System] Checking admin status');
      return isAdmin();
    })
  );

  ipcMain.handle(
    IPC.SYS_RESTART_AS_ADMIN,
    wrapHandler(() => {
      log.info('[System] Restarting as admin');
      restartAsAdmin();
      return true;
    })
  );

  ipcMain.handle(
    IPC.SYS_OPEN_REGEDIT,
    wrapHandler(async (_event: unknown, fullRegPath: string) => {
      log.info('[Regedit] 收到路径:', fullRegPath);

      const locale = app.getLocale();
      const isChinese = locale.startsWith('zh');
      const computerPrefix = isChinese ? '计算机' : 'Computer';
      log.info('[Regedit] locale:', locale, '→ 根节点前缀:', computerPrefix);

      const normalizedPath = `${computerPrefix}\\${fullRegPath}`;
      log.info('[Regedit] 规范化路径:', normalizedPath);

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

      try {
        const { stdout } = await execFileAsync('taskkill.exe', ['/F', '/IM', 'regedit.exe']);
        log.info('[Regedit] taskkill 成功:', stdout.trim());
        await new Promise<void>((resolve) => setTimeout(resolve, 400));
      } catch (_e) {
        log.info('[Regedit] taskkill 失败（regedit 未运行，正常）');
      }

      log.info('[Regedit] 启动 regedit.exe (via cmd)');
      const child = spawn('cmd.exe', ['/c', 'start', '', 'regedit.exe'], { detached: true, stdio: 'ignore' });
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
      log.debug(`[System] Copying to clipboard: ${text.substring(0, 50)}...`);
      clipboard.writeText(text);
      return true;
    })
  );

  ipcMain.handle(
    IPC.SYS_OPEN_EXTERNAL,
    wrapHandler((_event: unknown, url: string) => {
      log.info(`[System] Opening external URL: ${url}`);
      return shell.openExternal(url);
    })
  );

  ipcMain.handle(
    IPC.SYS_LOG_TO_FILE,
    wrapHandler((_event: unknown, level: 'info' | 'warn' | 'error', message: string) => {
      const prefix = '[Renderer]';
      switch (level) {
        case 'error':
          log.error(prefix, message);
          break;
        case 'warn':
          log.warn(prefix, message);
          break;
        default:
          log.info(prefix, message);
      }
    })
  );

  ipcMain.handle(
    IPC.SYS_DIAGNOSE,
    wrapHandler(() => {
      const result: Record<string, unknown> = {
        koffiAvailable: false,
        resolveIndirectResult: null,
        resolveIndirectError: null,
        fileVersionResult: null,
        fileVersionError: null,
        uiLanguage: 'unknown',
        cmdStoreSize: cmdStoreSize ?? 0,
      };

      if (!win32Shell) {
        result.resolveIndirectError = 'Win32Shell not injected';
        return result;
      }

      result.koffiAvailable = true;
      result.uiLanguage = win32Shell.uiLanguage;

      // 测试 SHLoadIndirectString
      try {
        const resolved = win32Shell.resolveIndirect('@shell32.dll,-37423');
        result.resolveIndirectResult = resolved;
        log.info(`[Diagnose] resolveIndirect test: "${resolved}"`);
      } catch (e) {
        result.resolveIndirectError = String(e);
        log.error('[Diagnose] resolveIndirect test failed:', e);
      }

      // 测试 GetFileVersionInfo
      try {
        const fv = win32Shell.getFileVersionInfo('C:\\Windows\\System32\\shell32.dll');
        result.fileVersionResult = fv;
        log.info(`[Diagnose] getFileVersionInfo test: "${fv}"`);
      } catch (e) {
        result.fileVersionError = String(e);
        log.error('[Diagnose] getFileVersionInfo test failed:', e);
      }

      return result;
    })
  );

  ipcMain.handle(
    IPC.WIN_MINIMIZE,
    wrapHandler(() => {
      const win = BrowserWindow.getFocusedWindow();
      win?.minimize();
    })
  );

  ipcMain.handle(
    IPC.WIN_MAXIMIZE,
    wrapHandler(() => {
      const win = BrowserWindow.getFocusedWindow();
      if (!win) return;
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    })
  );

  ipcMain.handle(
    IPC.WIN_CLOSE,
    wrapHandler(() => {
      const win = BrowserWindow.getFocusedWindow();
      win?.close();
    })
  );

  ipcMain.handle(
    IPC.WIN_IS_MAXIMIZED,
    wrapHandler(() => {
      return BrowserWindow.getFocusedWindow()?.isMaximized() ?? false;
    })
  );
}
