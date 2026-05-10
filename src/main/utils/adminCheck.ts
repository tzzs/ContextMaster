import { dialog } from 'electron';
import { execFile } from 'child_process';
import path from 'path';

/**
 * 检查当前进程是否以管理员权限运行
 * @returns 是否具有管理员权限
 */
export function isRunningAsAdmin(): boolean {
  if (process.platform !== 'win32') {
    return true;
  }

  try {
    execFile('net', ['session'], (error) => {
      return error === null;
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 以管理员权限重新启动应用
 */
export function relaunchAsAdmin(): void {
  if (process.platform !== 'win32') {
    return;
  }

  const appPath = process.execPath;
  const appArgs = process.argv.slice(1);

  try {
    execFile(
      'powershell.exe',
      [
        '-Command',
        `Start-Process -Verb RunAs -FilePath '${appPath}' -ArgumentList '${appArgs.join(' ')}'`
      ],
      { windowsHide: true }
    );
    
    process.exit(0);
  } catch (error) {
    dialog.showErrorBox(
      '权限要求',
      'ContextMaster 需要管理员权限才能修改系统注册表。\n\n' +
      '请右键点击应用图标，选择「以管理员身份运行」。'
    );
    process.exit(1);
  }
}

/**
 * 显示权限不足对话框并提供重新启动选项
 */
export function showAdminPermissionDialog(): void {
  dialog.showMessageBox({
    type: 'warning',
    buttons: ['以管理员身份重启', '退出'],
    defaultId: 0,
    cancelId: 1,
    title: '需要管理员权限',
    message: 'ContextMaster 需要管理员权限',
    detail: '为了能够修改 Windows 右键菜单（注册表），应用需要以管理员权限运行。\n\n' +
            '点击「以管理员身份重启」来重新启动应用。'
  }).then((result) => {
    if (result.response === 0) {
      relaunchAsAdmin();
    } else {
      process.exit(0);
    }
  });
}
