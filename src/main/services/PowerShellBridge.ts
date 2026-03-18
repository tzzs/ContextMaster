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

  /** 加载或编译 CmHelper.dll（缓存至 %LOCALAPPDATA%\ContextMaster\），设置 $helperLoaded */
  private buildCmHelperBlock(): string {
    return `$cmDir = Join-Path $env:LOCALAPPDATA 'ContextMaster'
$cmDll = Join-Path $cmDir 'CmHelper.dll'
$helperLoaded = $false
if (Test-Path $cmDll) {
  try { Add-Type -Path $cmDll -ErrorAction Stop; $helperLoaded = $true } catch {}
}
if ($helperLoaded) {
  try { if ([CmHelper]::Ver -ne '2026.3') { $helperLoaded = $false } } catch { $helperLoaded = $false }
}
if (-not $helperLoaded) {
  $src = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public class CmHelper {
    public static readonly string Ver = "2026.3";
    [DllImport("shlwapi.dll", CharSet = CharSet.Unicode)]
    static extern int SHLoadIndirectString(string s, StringBuilder buf, int cap, IntPtr r);
    public static string ResolveIndirect(string s) {
        if (string.IsNullOrEmpty(s) ||
            (!s.StartsWith("@") && !s.StartsWith("ms-resource:"))) return null;
        var sb = new StringBuilder(512);
        return SHLoadIndirectString(s, sb, 512, IntPtr.Zero) == 0 ? sb.ToString() : null;
    }
    [DllImport("version.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern uint GetFileVersionInfoSize(string lp, out uint h);
    [DllImport("version.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern bool GetFileVersionInfo(string lp, uint h, uint n, byte[] d);
    [DllImport("version.dll", SetLastError=false)]
    static extern bool VerQueryValue(byte[] d, string s, out IntPtr p, out uint l);
    public static string[] GetLocalizedVerStrings(string path) {
        uint h; uint sz = GetFileVersionInfoSize(path, out h);
        if (sz == 0) return null;
        byte[] data = new byte[sz];
        if (!GetFileVersionInfo(path, h, sz, data)) return null;
        IntPtr tp; uint tl;
        if (!VerQueryValue(data, @"\\VarFileInfo\\Translation", out tp, out tl) || tl < 4) return null;
        int uiLang = System.Globalization.CultureInfo.CurrentUICulture.LCID;
        var trans = new System.Collections.Generic.List<string>();
        for (uint i = 0; i < tl / 4; i++) {
            short lang = System.Runtime.InteropServices.Marshal.ReadInt16(tp, (int)(i * 4));
            short cp   = System.Runtime.InteropServices.Marshal.ReadInt16(tp, (int)(i * 4 + 2));
            string key = string.Format("{0:X4}{1:X4}", (ushort)lang, (ushort)cp);
            if ((int)(ushort)lang == uiLang) trans.Insert(0, key); else trans.Add(key);
        }
        foreach (var key in trans) {
            IntPtr p; uint l;
            string fd = null, pn = null;
            if (VerQueryValue(data, @"\\StringFileInfo\\" + key + @"\\FileDescription", out p, out l) && l > 0)
                fd = System.Runtime.InteropServices.Marshal.PtrToStringUni(p);
            if (VerQueryValue(data, @"\\StringFileInfo\\" + key + @"\\ProductName", out p, out l) && l > 0)
                pn = System.Runtime.InteropServices.Marshal.PtrToStringUni(p);
            if (fd != null || pn != null) return new string[] { fd ?? "", pn ?? "" };
        }
        return null;
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
}`;
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
${this.buildCmHelperBlock()}
function Resolve-MenuName($raw) {
  if (-not $raw) { return $null }
  if ($raw -match '^@' -or $raw -match '^ms-resource:') {
    if ($helperLoaded) {
      try { $r = [CmHelper]::ResolveIndirect($raw); if ($r) { return $r } } catch {}
    }
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
${this.buildCmHelperBlock()}
function Test-IsGenericName($name) {
  if (-not $name -or $name.Length -lt 2) { return $true }
  $lc = $name.ToLower()
  # Group A: COM/Shell 技术内部描述
  if ($lc -match '外壳服务对象')                    { return $true }
  if ($lc -match '^(context|ctx)\\s*menu(\\s*(handler|ext(ension)?|provider|manager))?$') { return $true }
  if ($lc -match '^shell\\s*(extension|ext|common)(\\s*(handler|provider|class))?$')      { return $true }
  # Group A: "* Shell Extension" 后缀（COM 类描述，非用户可见名称，如 "Vim Shell Extension"）
  if ($lc -match 'shell\\s+extension$')                { return $true }
  if ($lc -match '^shell\\s*service(\\s*object)?$')    { return $true }
  if ($lc -match '^com\\s*(object|server|class)$')     { return $true }
  if ($lc -match '\\.dll$')                         { return $true }
  if ($lc -match '^microsoft windows')              { return $true }
  # Group B: COM 类名后缀（新增）
  if ($lc -match '\\s+class$')                      { return $true }
  # Group C: 占位符/未完成文本（新增）
  if ($lc -match '^todo:')                          { return $true }
  if ($lc -match '<[^>]+>')                         { return $true }
  if ($lc -match '^(n/a|na|none|unknown|untitled)$') { return $true }
  # Group D: 句子式描述 / 内部调试标记
  if ($lc -match '^(a|an|the)\\s+') { return $true }  # 冠词开头句子（如 "A small project for..."）
  if ($lc -match '^\\(.+\\)$')      { return $true }  # 括号完全包裹（如 "(调试)"、"(Debug)"）
  return $false
}
# 判断 plain string 是否"无用"：为空/过短、与键名相同（开发者占位符）或泛型 COM 描述
function Test-IsUselessPlain($value, $fallback) {
  if (-not $value -or $value.Length -lt 2) { return $true }
  if ($value -ieq $fallback)               { return $true }  # 等于键名 → 无信息量
  if (Test-IsGenericName $value)           { return $true }  # COM/Shell 泛型术语
  return $false
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
          # 过滤泛型 COM 类型描述，这类值不适合作为菜单显示名；与键名相同的值跳过让 Level 2.5 执行
          if (-not (Test-IsUselessPlain $raw $fallback)) { return $raw }
        }
      }
      # Level 1.3: Sibling Shell Key MUIVerb（通用方案）
      # 适用于既注册 shellex 又注册 shell verb 的扩展（如 gvim → HKCR:\\*\\shell\\gvim\\MUIVerb）
      # $shellPath 为脚本级变量，由 $shellexPath 推导，无需修改函数签名
      if ($shellPath) {
        $siblingVerbPath = Join-Path $shellPath $fallback
        if (Test-Path -LiteralPath $siblingVerbPath) {
          $siblingMUI = (Get-Item -LiteralPath $siblingVerbPath).GetValue('MUIVerb')
          if ($siblingMUI) {
            if ($siblingMUI.StartsWith('@') -or $siblingMUI.StartsWith('ms-resource:')) {
              try {
                $resolved = [CmHelper]::ResolveIndirect($siblingMUI)
                if ($resolved -and $resolved.Length -ge 2) { return $resolved }
              } catch {}
            } elseif ($siblingMUI.Length -ge 2) {
              if (-not (Test-IsUselessPlain $siblingMUI $fallback)) { return $siblingMUI }
            }
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
        } elseif ($muiVerb.Length -ge 2) {
          if (-not (Test-IsUselessPlain $muiVerb $fallback)) { return $muiVerb }
        }
      }
      # Level 1.7: CommandStore 反向查找（ExplorerCommandHandler = $clsid → MUIVerb）
      # 适用于通过 ImplementsVerbs 注册但 CLSID 自身无本地化字段的 shell 扩展（如 Taskband Pin）
      if ($cmdStoreVerbs.ContainsKey($clsid)) { return $cmdStoreVerbs[$clsid] }
      # Level 2: CLSID 默认值（与参考脚本 (default) 逻辑一致，可靠、ASCII-safe）
      $def = $clsidKey.GetValue('')
      if ($def -and $def.Length -ge 2) {
        if (-not (Test-IsUselessPlain $def $fallback)) { return [string]$def }
      }
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
            $vs = [CmHelper]::GetLocalizedVerStrings($dllExp)
            $candidates = if ($vs) { $vs } else {
              $vi = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($dllExp)
              @($vi.FileDescription, $vi.ProductName)
            }
            foreach ($cand in $candidates) {
              if ($cand -and $cand.Length -ge 2 -and $cand.Length -le 64) {
                if (-not (Test-IsGenericName $cand)) { return $cand }
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
    if (-not (Test-IsUselessPlain $directName $fallback)) { return $directName }
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
# 推导 sibling shell 路径（仅适用于 shellex\\ContextMenuHandlers 路径）
$shellPath = $null
if ($shellexPath -match '\\\\shellex\\\\ContextMenuHandlers$') {
  $shellPath = $shellexPath -replace '\\\\shellex\\\\ContextMenuHandlers$', '\\shell'
}
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
