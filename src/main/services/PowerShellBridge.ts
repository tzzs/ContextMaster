import { execFile } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { isAdmin } from '../utils/AdminHelper';
import log from '../utils/logger';

const execFileAsync = promisify(execFile);

const PWSH7_PATH = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe';
const PS_EXE = fs.existsSync(PWSH7_PATH) ? PWSH7_PATH : 'powershell.exe';

export class PowerShellBridge {
  /**
   * 执行 PowerShell 脚本并将 stdout 解析为 JSON
   */
  async execute<T>(script: string): Promise<T> {
    log.debug('[PS] execute:', script.substring(0, 200));
    const { stdout, stderr } = await execFileAsync(
      PS_EXE,
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
   * 以提权方式执行脚本（非管理员时弹出 UAC 对话框）
   * 管理员身份下直接 fallback 到 execute()
   */
  async executeElevated<T>(script: string): Promise<T> {
    if (isAdmin()) {
      return this.execute<T>(script);
    }

    const uid = crypto.randomUUID();
    const opScript  = path.join(os.tmpdir(), `cm_op_${uid}.ps1`);
    const resultFile = path.join(os.tmpdir(), `cm_res_${uid}.json`);

    // 包装原始脚本：捕获原始 JSON 输出（脚本本身已输出 JSON），写入 resultFile
    const resultFilePs = resultFile.replace(/'/g, "''");
    const wrappedScript2 = `
$ErrorActionPreference = 'Stop'
try {
  $__out = & {
${script}
  } | Out-String
  $__out = $__out.Trim()
  if (-not $__out) { $__out = 'null' }
  Set-Content -LiteralPath '${resultFilePs}' -Value $__out -Encoding UTF8
} catch {
  $__err = (@{ __error = $_.Exception.Message } | ConvertTo-Json -Compress)
  Set-Content -LiteralPath '${resultFilePs}' -Value $__err -Encoding UTF8
  exit 1
}
`.trim();

    fs.writeFileSync(opScript, wrappedScript2, 'utf8');

    // 通过非提权 PS 启动提权子进程（弹 UAC）
    const launchScript = `Start-Process '${PS_EXE.replace(/'/g, "''")}' -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList @('-NonInteractive','-NoProfile','-ExecutionPolicy','Bypass','-File','${opScript.replace(/'/g, "''")}')`;

    log.debug('[PS] executeElevated: launching UAC process');
    try {
      await execFileAsync(
        PS_EXE,
        ['-NonInteractive', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', launchScript],
        { maxBuffer: 1 * 1024 * 1024, timeout: 120000 }
      );
    } finally {
      try { fs.unlinkSync(opScript); } catch { /* ignore */ }
    }

    if (!fs.existsSync(resultFile)) {
      throw new Error('操作已取消（UAC 提权被拒绝）');
    }

    let resultJson: string;
    try {
      resultJson = fs.readFileSync(resultFile, 'utf8').trim();
      fs.unlinkSync(resultFile);
    } catch {
      throw new Error('读取操作结果失败');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(resultJson);
    } catch {
      throw new Error(`结果 JSON 解析失败: ${resultJson.substring(0, 200)}`);
    }

    if (parsed && typeof parsed === 'object' && '__error' in parsed) {
      throw new Error(String((parsed as Record<string, unknown>).__error));
    }

    return parsed as T;
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
New-PSDrive -Name HKCR -PSProvider Registry -Root HKEY_CLASSES_ROOT -ErrorAction SilentlyContinue | Out-Null
$keyPath = '${psPath}'
if (Test-Path -LiteralPath $keyPath) {
  $prop = Get-ItemProperty -LiteralPath $keyPath -Name 'LegacyDisable' -ErrorAction SilentlyContinue
  if ($prop -ne $null) {
    Remove-ItemProperty -LiteralPath $keyPath -Name 'LegacyDisable' -Force
  }
}
Write-Output '"ok"'
`.trim();
    } else {
      return `
$ErrorActionPreference = 'Stop'
New-PSDrive -Name HKCR -PSProvider Registry -Root HKEY_CLASSES_ROOT -ErrorAction SilentlyContinue | Out-Null
$keyPath = '${psPath}'
if (-not (Test-Path -LiteralPath $keyPath)) {
  throw "注册表项不存在: ${hkcrRelativeKey}"
}
Set-ItemProperty -LiteralPath $keyPath -Name 'LegacyDisable' -Value '' -Type String -Force
Write-Output '"ok"'
`.trim();
    }
  }
}
