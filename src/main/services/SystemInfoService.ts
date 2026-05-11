import { PowerShellBridge } from './PowerShellBridge';
import log from '../utils/logger';

export interface SystemMenuStyle {
  osVersion: 'win10' | 'win11';
  menuStyle: 'classic' | 'win11-new';
  buildNumber: number;
}

interface RawSystemInfo {
  buildNumber: number;
  classicMenuForced: boolean;
}

export class SystemInfoService {
  private cached: SystemMenuStyle | null = null;

  constructor(private readonly ps: PowerShellBridge) {}

  async getMenuStyle(): Promise<SystemMenuStyle> {
    if (this.cached) return this.cached;

    const raw = await this.ps.execute<RawSystemInfo>(
      SystemInfoService.buildDetectScript(),
    );

    const isWin11 = raw.buildNumber >= 22000;
    const result: SystemMenuStyle = {
      osVersion: isWin11 ? 'win11' : 'win10',
      menuStyle: isWin11 && !raw.classicMenuForced ? 'win11-new' : 'classic',
      buildNumber: raw.buildNumber,
    };

    log.info(
      `[SystemInfo] OS=${result.osVersion} build=${result.buildNumber} menuStyle=${result.menuStyle}`,
    );
    this.cached = result;
    return result;
  }

  invalidateCache(): void {
    this.cached = null;
  }

  /** 切换菜单样式（HKCU 用户级，无需管理员）+ 重启 explorer 让其生效 */
  async setMenuStyle(target: 'classic' | 'win11-new'): Promise<void> {
    const script = target === 'classic'
      ? SystemInfoService.buildSetClassicScript()
      : SystemInfoService.buildSetWin11NewScript();
    await this.ps.execute<{ ok: boolean }>(script);
    this.invalidateCache();
    log.info(`[SystemInfo] Menu style switched to: ${target}`);
  }

  async restartExplorer(): Promise<void> {
    await this.ps.execute<{ ok: boolean }>(SystemInfoService.buildRestartExplorerScript());
    log.info('[SystemInfo] explorer.exe restarted');
  }

  /** 切到 Win10 经典菜单：在 HKCU CLSID 镜像下创建空字符串的 InprocServer32 默认值 */
  static buildSetClassicScript(): string {
    return `
$ErrorActionPreference = 'Stop'
$keyPath = 'HKCU:\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\\InprocServer32'
New-Item -Path $keyPath -Force | Out-Null
# 设置默认值为空字符串
New-ItemProperty -Path $keyPath -Name '(default)' -Value '' -PropertyType String -Force | Out-Null
Write-Output '{"ok":true}'
`.trim();
  }

  /** 切到 Win11 新版菜单：删除整个 {86ca1aa0...} HKCU 覆盖键 */
  static buildSetWin11NewScript(): string {
    return `
$ErrorActionPreference = 'Stop'
$keyPath = 'HKCU:\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}'
if (Test-Path -LiteralPath $keyPath) {
  Remove-Item -LiteralPath $keyPath -Recurse -Force
}
Write-Output '{"ok":true}'
`.trim();
  }

  /** 重启 explorer.exe（杀进程后由系统的 ShellInfrastructureHost 自动拉起，亦显式启动一次保险） */
  static buildRestartExplorerScript(): string {
    return `
$ErrorActionPreference = 'SilentlyContinue'
Stop-Process -Name explorer -Force
Start-Sleep -Milliseconds 600
$running = Get-Process -Name explorer -ErrorAction SilentlyContinue
if (-not $running) {
  Start-Process explorer.exe
}
Write-Output '{"ok":true}'
`.trim();
  }

  static buildDetectScript(): string {
    return `
$ErrorActionPreference = 'SilentlyContinue'
$buildNumber = 0
$ntKey = Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion' -Name CurrentBuildNumber -ErrorAction SilentlyContinue
if ($ntKey) { $buildNumber = [int]$ntKey.CurrentBuildNumber }
$classicMenuForced = $false
$classicKey = 'HKCU:\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\\InprocServer32'
if (Test-Path -LiteralPath $classicKey) {
  $val = (Get-Item -LiteralPath $classicKey).GetValue('')
  if ($val -ne $null -and $val -eq '') { $classicMenuForced = $true }
}
[PSCustomObject]@{
  buildNumber = $buildNumber
  classicMenuForced = $classicMenuForced
} | ConvertTo-Json -Compress
`.trim();
  }
}
