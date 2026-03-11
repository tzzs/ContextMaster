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
   * 使用四级级联策略解析本地化名称：
   *  1. LocalizedString/FriendlyTypeName → SHLoadIndirectString（解析 @DLL,-ID 格式）
   *  2. InprocServer32 DLL 字符串表 → 通用字符串质量筛选（LoadLibraryEx + LoadString）
   *  3. CLSID 默认值
   *  4. 处理程序键名（最终兜底）
   * CmHelper.dll 编译后缓存至 %LOCALAPPDATA%\ContextMaster\，避免重复编译开销
   */
  buildGetShellExtItemsScript(shellexSubPath: string): string {
    return `
$ErrorActionPreference = 'SilentlyContinue'
New-PSDrive -Name HKCR -PSProvider Registry -Root HKEY_CLASSES_ROOT -ErrorAction SilentlyContinue | Out-Null
$cmDir = Join-Path $env:LOCALAPPDATA 'ContextMaster'
$cmDll = Join-Path $cmDir 'CmHelper.dll'
$helperLoaded = $false
if (Test-Path $cmDll) {
  try { Add-Type -Path $cmDll -ErrorAction Stop; $helperLoaded = $true } catch {}
}
if (-not $helperLoaded) {
  $src = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Collections.Generic;
public class CmHelper {
    const uint LOAD_AS_DATA = 2u;
    [DllImport("shlwapi.dll", CharSet = CharSet.Unicode)]
    static extern int SHLoadIndirectString(string s, StringBuilder buf, int cap, IntPtr r);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    static extern IntPtr LoadLibraryEx(string p, IntPtr h, uint f);
    [DllImport("kernel32.dll")]
    static extern bool FreeLibrary(IntPtr h);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern int LoadString(IntPtr h, uint id, StringBuilder buf, int cap);
    public static string ResolveIndirect(string s) {
        if (string.IsNullOrEmpty(s) || !s.StartsWith("@")) return null;
        var sb = new StringBuilder(512);
        return SHLoadIndirectString(s, sb, 512, IntPtr.Zero) == 0 ? sb.ToString() : null;
    }
    public static string[] ReadDllStrings(string dll, uint from, uint to) {
        var list = new List<string>();
        var hMod = LoadLibraryEx(dll, IntPtr.Zero, LOAD_AS_DATA);
        if (hMod == IntPtr.Zero) return list.ToArray();
        try {
            for (uint i = from; i <= to; i++) {
                var sb = new StringBuilder(512);
                if (LoadString(hMod, i, sb, 512) > 0) list.Add(sb.ToString());
            }
        } finally { FreeLibrary(hMod); }
        return list.ToArray();
    }
}
'@
  if (-not (Test-Path $cmDir)) { New-Item -Path $cmDir -ItemType Directory -Force | Out-Null }
  if (Test-Path $cmDll) { Remove-Item -Path $cmDll -Force -ErrorAction SilentlyContinue }
  try {
    Add-Type -TypeDefinition $src -OutputAssembly $cmDll -ErrorAction Stop
    $helperLoaded = $true
  } catch {
    try { Add-Type -TypeDefinition $src -ErrorAction Stop; $helperLoaded = $true } catch {}
  }
}
function Resolve-ExtName($clsid, $fallback) {
  if ($clsid -match '^\\{[0-9A-Fa-f-]+\\}$') {
    $clsidPath = 'HKCR:\\CLSID\\' + $clsid
    if (Test-Path -LiteralPath $clsidPath) {
      $clsidKey = Get-Item -LiteralPath $clsidPath
      foreach ($valName in @('LocalizedString', 'FriendlyTypeName')) {
        $raw = $clsidKey.GetValue($valName)
        if ($raw -and $raw.StartsWith('@')) {
          try {
            $resolved = [CmHelper]::ResolveIndirect($raw)
            if ($resolved -and $resolved.Length -ge 2) { return $resolved }
          } catch {}
        }
      }
      $inprocPath = Join-Path $clsidPath 'InprocServer32'
      if (Test-Path -LiteralPath $inprocPath) {
        $dllPath = (Get-Item -LiteralPath $inprocPath).GetValue('')
        # Fix 1: 展开 %SystemRoot% 等环境变量，否则 Test-Path 永远返回 $false
        if ($dllPath) {
          $dllPath = [System.Environment]::ExpandEnvironmentVariables($dllPath)
        }
        if ($dllPath -and (Test-Path -LiteralPath $dllPath)) {
          # Level 2: 通用字符串质量筛选（过滤后取第一条，无硬编码词表，无长度限制）
          try {
            $candidates = [CmHelper]::ReadDllStrings($dllPath, 1, 1000) |
              Where-Object {
                $_.Length -ge 2 -and
                $_ -notmatch '[\\\\/:*?<>|]' -and
                $_ -notmatch '^\\{' -and
                $_ -notmatch '^https?://' -and
                $_ -notmatch '%[0-9A-Za-z]' -and
                $_ -notmatch '\\{[0-9]+\\}' -and
                $_ -notmatch '[\\r\\n\\t]' -and
                $_ -notmatch '^[0-9]' -and
                $_ -notmatch '[\\u3002\\uff01\\uff1f]' -and
                $_ -notmatch '[.!?]$'
              }
            $pool = $candidates | Where-Object { $_ -match '[^\\x00-\\x7F]' }
            if (-not $pool) { $pool = $candidates }
            $best = $pool | Select-Object -First 1
            if ($best) { return $best }
          } catch {}
          # Level 2.5: DLL VersionInfo（适用于英文/日文等非中文软件）
          try {
            $ver = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($dllPath)
            $desc = $null
            if ($ver.FileDescription -and $ver.FileDescription.Length -ge 2) {
              $desc = $ver.FileDescription
            } elseif ($ver.ProductName -and $ver.ProductName.Length -ge 2) {
              $desc = $ver.ProductName
            }
            if ($desc -and $desc.Length -le 80 -and $desc -notmatch '^\\{' -and $desc -notmatch '[\\\\/:*?<>|]') {
              return $desc
            }
          } catch {}
        }
      }
      $def = $clsidKey.GetValue('')
      if ($def) { return [string]$def }
    }
  }
  return $fallback
}
$shellexPath = 'HKCR:\\${shellexSubPath}'
if (-not (Test-Path -LiteralPath $shellexPath)) { Write-Output '[]'; exit }
$handlers = Get-ChildItem -LiteralPath $shellexPath | Where-Object { $_.PSIsContainer }
$result = @($handlers | ForEach-Object {
  $handlerKeyName = $_.PSChildName
  $clsid = $_.GetValue('')
  if (-not $clsid) { $clsid = $handlerKeyName }
  $cleanName   = $handlerKeyName -replace '^-+', ''
  $displayName = Resolve-ExtName $clsid $cleanName
  $isEnabled   = -not $handlerKeyName.StartsWith('-')
  $regKey = '${shellexSubPath}\\' + $handlerKeyName
  [PSCustomObject]@{
    name        = [string]$displayName
    command     = [string]$clsid
    iconPath    = $null
    isEnabled   = [bool]$isEnabled
    source      = [string]$handlerKeyName
    registryKey = [string]$regKey
    subKeyName  = [string]$handlerKeyName
    itemType    = 'ShellExt'
  }
})
$result | ConvertTo-Json -Compress -Depth 3
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
if (Test-Path -LiteralPath $fullPath) {
  Rename-Item -LiteralPath $fullPath -NewName $newKey -Force
}
Write-Output '{"ok":true}'
`.trim();
  }
}
