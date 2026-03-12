import { execFileSync, execFile } from 'child_process';
import { app } from 'electron';
import log from './logger';

// 进程级缓存，避免每次写操作都 spawn 子进程检测
let _adminCache: boolean | null = null;

/**
 * 检查当前进程是否以管理员身份运行（进程令牌已提权）
 * 使用 Windows Security Principal API，比 net session 更可靠：
 * net session 在域环境或特定组策略下可能误报 true
 */
export function isAdmin(): boolean {
  if (process.platform !== 'win32') return true;
  if (_adminCache !== null) return _adminCache;
  try {
    const out = execFileSync(
      'powershell.exe',
      [
        '-NonInteractive', '-NoProfile', '-Command',
        '([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)',
      ],
      { stdio: 'pipe' }
    ).toString().trim();
    _adminCache = out === 'True';
  } catch {
    _adminCache = false;
  }
  return _adminCache;
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
