import { execFileSync, execFile } from 'child_process';
import { app } from 'electron';
import log from './logger';

/**
 * 检查当前进程是否以管理员身份运行
 * Windows: 尝试执行 net session，非管理员会抛出错误
 */
export function isAdmin(): boolean {
  if (process.platform !== 'win32') return true;
  try {
    execFileSync('net', ['session'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * 以管理员身份重启应用（UAC 提权）
 * 使用 PowerShell Start-Process -Verb RunAs
 */
export function restartAsAdmin(): void {
  const exePath = app.getPath('exe');
  log.info(`Restarting as admin: ${exePath}`);

  const script = `Start-Process -FilePath "${exePath}" -Verb RunAs`;
  execFile(
    'powershell.exe',
    ['-NonInteractive', '-NoProfile', '-Command', script],
    (err) => {
      if (err) {
        log.error('Failed to restart as admin:', err);
      }
    }
  );

  // 延迟退出，确保 Start-Process 已发出
  setTimeout(() => app.quit(), 500);
}
