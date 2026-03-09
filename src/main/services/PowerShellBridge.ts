import { execFile } from 'child_process';
import { promisify } from 'util';
import log from '../utils/logger';

const execFileAsync = promisify(execFile);

export class PowerShellBridge {
  /**
   * 执行 PowerShell 脚本并将 stdout 解析为 JSON
   */
  async execute<T>(script: string): Promise<T> {
    log.debug('[PS] execute:', script.substring(0, 200));
    const { stdout, stderr } = await execFileAsync(
      'powershell.exe',
      ['-NonInteractive', '-NoProfile', '-OutputFormat', 'Text', '-Command', script],
      { maxBuffer: 10 * 1024 * 1024, timeout: 30000 }
    );

    if (stderr) {
      log.warn('[PS] stderr:', stderr);
    }

    const trimmed = stdout.trim();
    if (!trimmed) return [] as unknown as T;

    try {
      return JSON.parse(trimmed) as T;
    } catch (e) {
      log.error('[PS] JSON parse error. stdout:', trimmed.substring(0, 500));
      throw new Error(`PowerShell 输出 JSON 解析失败: ${String(e)}`);
    }
  }

  /**
   * 构建扫描指定注册表路径下所有子键的脚本
   * 返回 JSON 数组，每项含菜单条目信息
   */
  buildGetItemsScript(hkcrSubPath: string): string {
    // PS 单对象会返回哈希表而非数组，用 @(...) 强制数组
    return `
$ErrorActionPreference = 'SilentlyContinue'
New-PSDrive -Name HKCR -PSProvider Registry -Root HKEY_CLASSES_ROOT -ErrorAction SilentlyContinue | Out-Null
$basePath = 'HKCR:\\${hkcrSubPath}'
if (-not (Test-Path -LiteralPath $basePath)) { Write-Output '[]'; exit }
$subKeys = Get-ChildItem -LiteralPath $basePath | Where-Object { $_.PSIsContainer }
$result = @($subKeys | ForEach-Object {
  $key = $_
  $keyName = $key.PSChildName
  $name = $key.GetValue('')
  if (-not $name) { $name = $keyName }
  $iconPath = $key.GetValue('Icon')
  $isEnabled = ($key.GetValue('LegacyDisable') -eq $null)
  $commandSubKey = Join-Path $key.PSPath 'command'
  $command = ''
  if (Test-Path -LiteralPath $commandSubKey) {
    $command = (Get-Item -LiteralPath $commandSubKey).GetValue('')
    if (-not $command) { $command = '' }
  }
  $regKey = '${hkcrSubPath}\\' + $keyName
  [PSCustomObject]@{
    name      = [string]$name
    command   = [string]$command
    iconPath  = if ($iconPath) { [string]$iconPath } else { $null }
    isEnabled = [bool]$isEnabled
    source    = ''
    registryKey = [string]$regKey
    subKeyName = [string]$keyName
  }
})
$result | ConvertTo-Json -Compress -Depth 3
`.trim();
  }

  /**
   * 构建启用/禁用单个菜单项的脚本
   * enable=true  → Remove-ItemProperty LegacyDisable
   * enable=false → Set-ItemProperty LegacyDisable -Value ''
   */
  buildSetEnabledScript(hkcrRelativeKey: string, enable: boolean): string {
    const psPath = `HKCR:\\${hkcrRelativeKey}`;
    if (enable) {
      return `
$ErrorActionPreference = 'Stop'
$keyPath = '${psPath}'
if (Test-Path $keyPath) {
  $prop = Get-ItemProperty -Path $keyPath -Name 'LegacyDisable' -ErrorAction SilentlyContinue
  if ($prop -ne $null) {
    Remove-ItemProperty -Path $keyPath -Name 'LegacyDisable' -Force
  }
}
Write-Output 'ok'
`.trim();
    } else {
      return `
$ErrorActionPreference = 'Stop'
$keyPath = '${psPath}'
if (-not (Test-Path $keyPath)) {
  throw "注册表项不存在: ${hkcrRelativeKey}"
}
Set-ItemProperty -Path $keyPath -Name 'LegacyDisable' -Value '' -Type String -Force
Write-Output 'ok'
`.trim();
    }
  }
}
