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
  private pending = 0;
  private maxConcurrent = 3;
  private readonly waitQueue: Array<() => void> = [];

  private slotWaitTimeoutMs = 30000;

  private async acquireSlot(priority: 'high' | 'normal' = 'normal'): Promise<void> {
    if (this.pending < this.maxConcurrent) {
      this.pending++;
      return;
    }
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waitQueue.indexOf(cb);
        if (idx !== -1) this.waitQueue.splice(idx, 1);
        reject(new Error('PowerShell 任务等待超时，请稍后重试'));
      }, this.slotWaitTimeoutMs);
      const cb = () => {
        clearTimeout(timer);
        this.pending++;
        resolve();
      };
      if (priority === 'high') this.waitQueue.unshift(cb);
      else                     this.waitQueue.push(cb);
    });
  }

  private releaseSlot(): void {
    this.pending--;
    const next = this.waitQueue.shift();
    if (next) next();
  }

  setMaxConcurrent(n: number): void {
    this.maxConcurrent = Math.max(1, n);
    // 立即唤醒队列中符合新上限的 waiter
    while (this.pending < this.maxConcurrent && this.waitQueue.length > 0) {
      const next = this.waitQueue.shift();
      if (next) { next(); }
    }
  }

  /**
   * 执行 PowerShell 脚本并将 stdout 解析为 JSON
   * 信号量限制最多 maxConcurrent 个进程并发，其余排队等待
   */
  async execute<T>(script: string, priority: 'high' | 'normal' = 'normal'): Promise<T> {
    await this.acquireSlot(priority);
    try {
      log.debug('[PS] execute:', script.substring(0, 200));
      // 强制 PS 输出 UTF-8 编码，避免中文乱码
      const utf8Script = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n' + script;
      const { stdout, stderr } = await execFileAsync(
        PS_EXE,
        ['-NonInteractive', '-NoProfile', '-OutputFormat', 'Text', '-Command', utf8Script],
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
    } finally {
      this.releaseSlot();
    }
  }

  /**
   * 以提权方式执行脚本（非管理员时弹出 UAC 对话框）
   * 管理员身份下直接 fallback 到 execute()
   */
  async executeElevated<T>(script: string, priority: 'high' | 'normal' = 'normal'): Promise<T> {
    if (isAdmin()) {
      return this.execute<T>(script, priority);
    }

    const uid = crypto.randomUUID();
    const opScript  = path.join(os.tmpdir(), `cm_op_${uid}.ps1`);
    const resultFile = path.join(os.tmpdir(), `cm_res_${uid}.json`);

    // 包装原始脚本：捕获原始 JSON 输出（脚本本身已输出 JSON），写入 resultFile
    const resultFilePs = resultFile.replace(/'/g, "''");
    const wrappedScript2 = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
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
      if (!fs.existsSync(resultFile)) {
        throw new Error('操作已取消（UAC 提权被拒绝）');
      }
    }

    let resultJson: string;
    try {
      resultJson = fs.readFileSync(resultFile, 'utf8').trim();
    } catch {
      throw new Error('读取操作结果失败');
    } finally {
      try { fs.unlinkSync(resultFile); } catch { /* ignore */ }
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
   * 构建扫描 Classic Shell 注册表路径的脚本
   * 仅返回原始注册表值（MUIVerb/Default/LocalizedDisplayName），
   * 不执行间接字符串解析。解析逻辑由 TypeScript 侧 ShellExtNameResolver 完成。
   */
  buildGetItemsScript(hkcrSubPath: string): string {
    return `
$ErrorActionPreference = 'SilentlyContinue'
New-PSDrive -Name HKCR -PSProvider Registry -Root HKEY_CLASSES_ROOT -ErrorAction SilentlyContinue | Out-Null
$basePath = 'HKCR:\\${hkcrSubPath}'
if (-not (Test-Path -LiteralPath $basePath)) { Write-Output '[]'; exit }
$subKeys = Get-ChildItem -LiteralPath $basePath | Where-Object { $_.PSIsContainer }
$result = @($subKeys | ForEach-Object {
  $key = $_
  $keyName = $key.PSChildName
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
    subKeyName             = [string]$keyName
    rawMUIVerb             = if ($key.GetValue('MUIVerb')) { [string]$key.GetValue('MUIVerb') } else { $null }
    rawDefault             = if ($key.GetValue('')) { [string]$key.GetValue('') } else { $null }
    rawLocalizedDisplayName = if ($key.GetValue('LocalizedDisplayName')) { [string]$key.GetValue('LocalizedDisplayName') } else { $null }
    rawIcon                = if ($iconPath) { [string]$iconPath } else { $null }
    isEnabled              = [bool]$isEnabled
    command                = [string]$command
    registryKey            = [string]$regKey
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
Write-Output '{"ok":true}'
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
Write-Output '{"ok":true}'
`.trim();
    }
  }

  /**
   * 构建枚举 shellex\ContextMenuHandlers 下所有 Shell 扩展的脚本
   * 仅读取原始注册表数据（键名、CLSID、LocalizedString、MUIVerb、DLL 路径等），
   * 不执行名称解析。解析逻辑由 TypeScript 侧 ShellExtNameResolver 完成。
   */
  buildGetShellExtItemsScript(shellexSubPath: string): string {
    return `
$ErrorActionPreference = 'SilentlyContinue'
New-PSDrive -Name HKCR -PSProvider Registry -Root HKEY_CLASSES_ROOT -ErrorAction SilentlyContinue | Out-Null
$shellexPath = 'HKCR:\\${shellexSubPath}'
if (-not (Test-Path -LiteralPath $shellexPath)) { Write-Output '[]'; exit }
# 推导 sibling shell 路径
$shellPath = $null
if ($shellexPath -match '\\\\shellex\\\\ContextMenuHandlers$') {
  $shellPath = $shellexPath -replace '\\\\shellex\\\\ContextMenuHandlers$', '\\shell'
}
$handlers = Get-ChildItem -LiteralPath $shellexPath | Where-Object { $_.PSIsContainer }
$result = @($handlers | ForEach-Object {
  $handlerKeyName = $_.PSChildName
  $defaultVal  = $_.GetValue('')
  $cleanName   = $handlerKeyName -replace '^-+', ''
  $actualClsid = $cleanName
  if ($cleanName -notmatch '^\\{[0-9A-Fa-f-]+\\}$' -and
      $defaultVal -match '^\\{[0-9A-Fa-f-]+\\}$') {
    $actualClsid = $defaultVal
  }
  # 读取 CLSID 子键原始值
  $clsidLocalizedString = $null
  $clsidMUIVerb = $null
  $clsidDefault = $null
  $dllPath = $null
  if ($actualClsid -match '^\\{[0-9A-Fa-f-]+\\}$') {
    $clsidPath = 'HKCR:\\CLSID\\' + $actualClsid
    if (Test-Path -LiteralPath $clsidPath) {
      $clsidKey = Get-Item -LiteralPath $clsidPath
      if ($clsidKey.GetValue('LocalizedString')) { $clsidLocalizedString = [string]$clsidKey.GetValue('LocalizedString') }
      if ($clsidKey.GetValue('MUIVerb')) { $clsidMUIVerb = [string]$clsidKey.GetValue('MUIVerb') }
      if ($clsidKey.GetValue('')) { $clsidDefault = [string]$clsidKey.GetValue('') }
      $inprocPath = $clsidPath + '\\InprocServer32'
      if (Test-Path -LiteralPath $inprocPath) {
        $dllRaw = (Get-Item -LiteralPath $inprocPath).GetValue('')
        if ($dllRaw) { $dllPath = [System.Environment]::ExpandEnvironmentVariables($dllRaw) }
      }
      # CLSID\Shell 子键的 MUIVerb（COM 对象自身注册的 verb）
      $clsidShellPath = $clsidPath + '\\Shell'
      if (Test-Path -LiteralPath $clsidShellPath) {
        Get-ChildItem -LiteralPath $clsidShellPath -ErrorAction SilentlyContinue | ForEach-Object {
          $shellMv = $_.GetValue('MUIVerb')
          if ($shellMv -and -not $clsidMUIVerb) { $clsidMUIVerb = [string]$shellMv }
        }
      }
      # ProgID → 应用程序名（用于 Level 1.6）
      $progIdVal = $clsidKey.GetValue('ProgID')
      if ($progIdVal) {
        $progIdPath = 'HKCR:\' + $progIdVal
        if (Test-Path -LiteralPath $progIdPath) {
          $progIdDef = (Get-Item -LiteralPath $progIdPath).GetValue('')
          if ($progIdDef -and $progIdDef.Length -ge 2) { $progIdName = [string]$progIdDef }
        }
      }
    }
  }
  # DLL 版本资源（.NET FileVersionInfo，天然支持 UI 语言，无需 koffi）
  $dllFileDescription = $null
  $dllProductName = $null
  if ($dllPath -and (Test-Path -LiteralPath $dllPath -PathType Leaf)) {
    try {
      $vi = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($dllPath)
      if ($vi.FileDescription -and $vi.FileDescription.Length -ge 2) {
        $dllFileDescription = [string]$vi.FileDescription
      }
      if ($vi.ProductName -and $vi.ProductName.Length -ge 2) {
        $dllProductName = [string]$vi.ProductName
      }
    } catch {}
  }
  # sibling shell key MUIVerb
  $siblingMUIVerb = $null
  if ($shellPath) {
    $siblingVerbPath = Join-Path $shellPath $cleanName
    if (Test-Path -LiteralPath $siblingVerbPath) {
      $smv = (Get-Item -LiteralPath $siblingVerbPath).GetValue('MUIVerb')
      if ($smv) { $siblingMUIVerb = [string]$smv }
    }
    # 回退：反向扫描 shell verbs，查找 CommandStateHandler/DelegateExecute = $actualClsid
    if (-not $siblingMUIVerb -and $actualClsid) {
      Get-ChildItem -LiteralPath $shellPath -ErrorAction SilentlyContinue | ForEach-Object {
        $csh = $_.GetValue('CommandStateHandler')
        $de  = $_.GetValue('DelegateExecute')
        $ech = $_.GetValue('ExplorerCommandHandler')
        if (($csh -eq $actualClsid) -or ($de -eq $actualClsid) -or ($ech -eq $actualClsid)) {
          $mv = $_.GetValue('MUIVerb')
          if ($mv) { $siblingMUIVerb = [string]$mv }
        }
      }
    }
  }
  $isEnabled = -not $handlerKeyName.StartsWith('-')
  $regKey = '${shellexSubPath}\\' + $cleanName
  [PSCustomObject]@{
    handlerKeyName       = [string]$handlerKeyName
    cleanName            = [string]$cleanName
    defaultVal           = [string]$defaultVal
    isEnabled            = [bool]$isEnabled
    actualClsid          = [string]$actualClsid
    clsidLocalizedString = $clsidLocalizedString
    clsidMUIVerb         = $clsidMUIVerb
    clsidDefault         = $clsidDefault
    dllPath              = $dllPath
    dllFileDescription   = $dllFileDescription
    dllProductName       = $dllProductName
    progIdName           = $progIdName
    siblingMUIVerb       = $siblingMUIVerb
    registryKey          = [string]$regKey
  }
})
$result | ConvertTo-Json -Compress -Depth 3
`.trim();
  }

  /**
   * 构建读取 CommandStore shell 索引的脚本（Level 1.7 用）
   * 返回 [{clsid, muiverb}] JSON 数组，MUIVerb 为原始值（间接字符串由 TS 侧解析）
   */
  buildCommandStoreScript(): string {
    return `
$ErrorActionPreference = 'SilentlyContinue'
$cmdStorePath = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\CommandStore\\shell'
$result = @()
if (Test-Path -LiteralPath $cmdStorePath) {
  Get-ChildItem -LiteralPath $cmdStorePath | ForEach-Object {
    $handler = $_.GetValue('ExplorerCommandHandler')
    if ($handler -and $handler -match '^\\{[0-9A-Fa-f-]+\\}$') {
      $mv = $_.GetValue('MUIVerb')
      if ($mv) {
        [PSCustomObject]@{
          clsid   = [string]$handler
          muiverb = [string]$mv
        }
      }
    }
  } | ForEach-Object { $result += $_ }
}
$result | ConvertTo-Json -Compress -Depth 2
`.trim();
  }

  /**
   * 构建启用/禁用 Shell 扩展的脚本（通过重命名键名添加/去除 '-' 前缀）
   * enable=true  → 将 '-Name' 重命名为 'Name'
   * enable=false → 将 'Name' 重命名为 '-Name'
   */
  buildShellExtToggleScript(hkcrRelativeKey: string, enable: boolean): string {
    const lastSlash = hkcrRelativeKey.lastIndexOf('\\');
    const parentRelPath = hkcrRelativeKey.substring(0, lastSlash);
    const keyName = hkcrRelativeKey.substring(lastSlash + 1);
    const cleanName = keyName.replace(/^-+/, '');
    const psParentPath = `HKCR:\\${parentRelPath}`;
    // enable: 找 -cleanName 改为 cleanName；disable: 找 cleanName 改为 -cleanName
    const psCurrentKeyName = enable ? `-${cleanName}` : cleanName;
    const psNewKeyName = enable ? cleanName : `-${cleanName}`;
    return `
$ErrorActionPreference = 'Stop'
New-PSDrive -Name HKCR -PSProvider Registry -Root HKEY_CLASSES_ROOT -ErrorAction SilentlyContinue | Out-Null
$parentPath = '${psParentPath}'
$currentKey = '${psCurrentKeyName}'
$newKey = '${psNewKeyName}'
$fullPath = Join-Path $parentPath $currentKey
if (-not (Test-Path -LiteralPath $fullPath)) {
  throw "ShellExt key not found: $fullPath"
}
Rename-Item -LiteralPath $fullPath -NewName $newKey -Force
Write-Output '{"ok":true}'
`.trim();
  }
}
