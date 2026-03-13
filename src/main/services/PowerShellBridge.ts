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
try {
  Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices; using System.Text;
public class CmShell {
    [DllImport("shlwapi.dll", CharSet=CharSet.Unicode)]
    static extern int SHLoadIndirectString(string s, StringBuilder b, int c, IntPtr r);
    public static string Resolve(string s) {
        if (string.IsNullOrEmpty(s) || !s.StartsWith("@")) return null;
        var sb = new StringBuilder(512);
        return SHLoadIndirectString(s, sb, 512, IntPtr.Zero) == 0 ? sb.ToString() : null;
    }
}
'@ -ErrorAction Stop
} catch {}
function Resolve-MenuName($raw) {
  if (-not $raw) { return $null }
  if ($raw -match '^@') {
    try { $r = [CmShell]::Resolve($raw); if ($r) { return $r } } catch {}
    return $null
  }
  return $raw
}
$basePath = 'HKCR:\\${hkcrSubPath}'
if (-not (Test-Path -LiteralPath $basePath)) { Write-Output '[]'; exit }
$subKeys = Get-ChildItem -LiteralPath $basePath | Where-Object { $_.PSIsContainer }
$result = @($subKeys | ForEach-Object {
  $key = $_
  $keyName = $key.PSChildName
  $name = Resolve-MenuName ($key.GetValue('MUIVerb'))
  if (-not $name) { $name = Resolve-MenuName ($key.GetValue('')) }
  if (-not $name) { $name = Resolve-MenuName ($key.GetValue('LocalizedDisplayName')) }
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
   * 使用三级级联策略解析本地化名称：
   *  1. LocalizedString → SHLoadIndirectString（@ 格式）或直接使用
   *  2. CLSID 默认值（可靠、ASCII-safe）
   *  3. 处理程序键名（最终兜底）
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
public class CmHelper {
    [DllImport("shlwapi.dll", CharSet = CharSet.Unicode)]
    static extern int SHLoadIndirectString(string s, StringBuilder buf, int cap, IntPtr r);
    public static string ResolveIndirect(string s) {
        if (string.IsNullOrEmpty(s) ||
            (!s.StartsWith("@") && !s.StartsWith("ms-resource:"))) return null;
        var sb = new StringBuilder(512);
        return SHLoadIndirectString(s, sb, 512, IntPtr.Zero) == 0 ? sb.ToString() : null;
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
function Resolve-ExtName($clsid, $fallback, $directName = $null) {
  # Level 0: directName（仅间接格式：@dll,-id 或 ms-resource:，最高本地化优先级）
  if ($directName -and ($directName.StartsWith('@') -or $directName.StartsWith('ms-resource:'))) {
    try {
      $resolved = [CmHelper]::ResolveIndirect($directName)
      if ($resolved -and $resolved.Length -ge 2) { return $resolved }
    } catch {}
  }
  if ($clsid -match '^\\{[0-9A-Fa-f-]+\\}$') {
    $clsidPath = 'HKCR:\\CLSID\\' + $clsid
    if (Test-Path -LiteralPath $clsidPath) {
      $clsidKey = Get-Item -LiteralPath $clsidPath
      # Level 1: LocalizedString（专为 Shell 扩展显示名设计，自动多语言）
      # 注意：FriendlyTypeName 是 COM 类型描述（如"外壳服务对象"），不是菜单名，已移除
      $raw = $clsidKey.GetValue('LocalizedString')
      if ($raw) {
        if ($raw.StartsWith('@') -or $raw.StartsWith('ms-resource:')) {
          try {
            $resolved = [CmHelper]::ResolveIndirect($raw)
            if ($resolved -and $resolved.Length -ge 2) { return $resolved }
          } catch {}
        } elseif ($raw.Length -ge 2) {
          # 过滤泛型 COM 类型描述，这类值不适合作为菜单显示名
          $lc = $raw.ToLower()
          if ($lc -notmatch '外壳服务对象' -and
              $lc -notmatch 'shell service object' -and
              $lc -notmatch 'shell extension') {
            return $raw
          }
        }
      }
      # Level 1.5: MUIVerb（部分扩展如 gvim 通过此键注册显示名）
      $muiVerb = $clsidKey.GetValue('MUIVerb')
      if ($muiVerb) {
        if ($muiVerb.StartsWith('@') -or $muiVerb.StartsWith('ms-resource:')) {
          try {
            $resolved = [CmHelper]::ResolveIndirect($muiVerb)
            if ($resolved -and $resolved.Length -ge 2) { return $resolved }
          } catch {}
        } elseif ($muiVerb.Length -ge 2) { return $muiVerb }
      }
      # Level 1.7: CommandStore 反向查找（ExplorerCommandHandler = $clsid → MUIVerb）
      # 适用于通过 ImplementsVerbs 注册但 CLSID 自身无本地化字段的 shell 扩展（如 Taskband Pin）
      if ($cmdStoreVerbs.ContainsKey($clsid)) { return $cmdStoreVerbs[$clsid] }
      # Level 2: CLSID 默认值（与参考脚本 (default) 逻辑一致，可靠、ASCII-safe）
      $def = $clsidKey.GetValue('')
      if ($def -and $def.Length -ge 2) { return [string]$def }
    }
    # Level 2.5: InprocServer32 DLL FileDescription/ProductName
    # 适用于无本地化注册表字段的第三方扩展（如 YunShellExt → 阿里云盘）
    $inprocPath2 = $clsidPath + '\\InprocServer32'
    if (Test-Path -LiteralPath $inprocPath2) {
      $dllRaw2 = (Get-Item -LiteralPath $inprocPath2).GetValue('')
      if ($dllRaw2) {
        $dllExp = [System.Environment]::ExpandEnvironmentVariables($dllRaw2)
        if ($dllExp -and (Test-Path -LiteralPath $dllExp -PathType Leaf)) {
          try {
            $vi = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($dllExp)
            foreach ($cand in @($vi.FileDescription, $vi.ProductName)) {
              if ($cand -and $cand.Length -ge 2 -and $cand.Length -le 64) {
                $lc = $cand.ToLower()
                if ($lc -notmatch 'shell\s*(extension|ext|common)' -and
                    $lc -notmatch 'context\s*menu' -and
                    $lc -notmatch 'ctx\s*menu' -and
                    $lc -notmatch '外壳服务对象' -and
                    $lc -notmatch '\bshell service' -and
                    $lc -notmatch '\bcom (object|server|class)' -and
                    $lc -notmatch '\.dll$' -and
                    $lc -notmatch '^microsoft windows') {
                  return $cand
                }
              }
            }
          } catch {}
        }
      }
    }
  }
  # Level 3: directName 普通字符串兜底（优先 CLSID 本地化后再用英文名）
  if ($directName -and
      -not $directName.StartsWith('@') -and
      -not $directName.StartsWith('ms-resource:')) {
    $lc = $directName.ToLower()
    if ($lc -notmatch '外壳服务对象' -and
        $lc -notmatch 'shell service object' -and
        $lc -notmatch 'shell extension') { return $directName }
  }
  return $fallback
}
function Format-DisplayName($name) {
  if (-not $name) { return $name }
  return $name.Trim()
}
# 预建 CommandStore 反向索引：ExplorerCommandHandler(CLSID) → 已解析的 MUIVerb
# 仅扫描一次，供 Resolve-ExtName Level 1.7 使用
$cmdStoreVerbs = @{}
$cmdStorePath = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\CommandStore\\shell'
if (Test-Path -LiteralPath $cmdStorePath) {
  Get-ChildItem -LiteralPath $cmdStorePath | ForEach-Object {
    $handler = $_.GetValue('ExplorerCommandHandler')
    if ($handler -match '^\\{[0-9A-Fa-f-]+\\}$' -and -not $cmdStoreVerbs.ContainsKey($handler)) {
      $mv = $_.GetValue('MUIVerb')
      if ($mv) {
        if ($mv.StartsWith('@') -or $mv.StartsWith('ms-resource:')) {
          try {
            $r = [CmHelper]::ResolveIndirect($mv)
            if ($r -and $r.Length -ge 2) { $cmdStoreVerbs[$handler] = $r }
          } catch {}
        } elseif ($mv.Length -ge 2) { $cmdStoreVerbs[$handler] = $mv }
      }
    }
  }
}
$shellexPath = 'HKCR:\\${shellexSubPath}'
if (-not (Test-Path -LiteralPath $shellexPath)) { Write-Output '[]'; exit }
$handlers = Get-ChildItem -LiteralPath $shellexPath | Where-Object { $_.PSIsContainer }
$result = @($handlers | ForEach-Object {
  $handlerKeyName = $_.PSChildName
  $defaultVal  = $_.GetValue('')
  $cleanName   = $handlerKeyName -replace '^-+', ''
  # 实际 CLSID：键名若为 CLSID 格式则优先；否则检查默认值是否为 CLSID
  $actualClsid = $cleanName
  if ($cleanName -notmatch '^\{[0-9A-Fa-f-]+\}$' -and
      $defaultVal -match '^\{[0-9A-Fa-f-]+\}$') {
    $actualClsid = $defaultVal
  }
  # 直接名称：仅当键名是 CLSID 格式且默认值是非 CLSID 字符串时
  $directName = $null
  if ($actualClsid -eq $cleanName -and $defaultVal -and
      $defaultVal -notmatch '^\{[0-9A-Fa-f-]+\}$' -and $defaultVal.Length -ge 2) {
    $directName = $defaultVal
  }
  $displayName = Resolve-ExtName $actualClsid $cleanName $directName
  $displayName = Format-DisplayName $displayName
  $isEnabled   = -not $handlerKeyName.StartsWith('-')
  $regKey = '${shellexSubPath}\\' + $cleanName
  $dllPath = $null
  if ($actualClsid -match '^\\{[0-9A-Fa-f-]+\\}$') {
    $inprocPath = 'HKCR:\\CLSID\\' + $actualClsid + '\\InprocServer32'
    if (Test-Path -LiteralPath $inprocPath) {
      $raw = (Get-Item -LiteralPath $inprocPath).GetValue('')
      if ($raw) { $dllPath = [System.Environment]::ExpandEnvironmentVariables($raw) }
    }
  }
  [PSCustomObject]@{
    name        = [string]$displayName
    command     = [string]$actualClsid
    iconPath    = $null
    isEnabled   = [bool]$isEnabled
    source      = [string]$handlerKeyName
    registryKey = [string]$regKey
    subKeyName  = [string]$handlerKeyName
    itemType    = 'ShellExt'
    dllPath     = $dllPath
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
if (-not (Test-Path -LiteralPath $fullPath)) {
  throw "ShellExt key not found: $fullPath"
}
Rename-Item -LiteralPath $fullPath -NewName $newKey -Force
Write-Output '{"ok":true}'
`.trim();
  }
}
