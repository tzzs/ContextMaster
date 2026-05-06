import { IWin32Shell } from './Win32Shell';
import log from '../utils/logger';

// ---- 标准谓词翻译表 ----
// Windows 对 open/edit/print 等标准 shell 动词有内置翻译，MUIVerb 为空时生效
// 参考: https://learn.microsoft.com/en-us/windows/win32/shell/context-menu-handlers
const STANDARD_VERBS: Record<string, { zh: string; en: string }> = {
  'open':            { zh: '打开',               en: 'Open' },
  'edit':            { zh: '编辑',               en: 'Edit' },
  'print':           { zh: '打印',               en: 'Print' },
  'printto':         { zh: '打印到',             en: 'Print to' },
  'find':            { zh: '搜索',               en: 'Find' },
  'explore':         { zh: '浏览',               en: 'Explore' },
  'play':            { zh: '播放',               en: 'Play' },
  'preview':         { zh: '预览',               en: 'Preview' },
  'runas':           { zh: '以管理员身份运行',   en: 'Run as administrator' },
  'runasuser':       { zh: '以其他用户身份运行', en: 'Run as different user' },
  'properties':      { zh: '属性',               en: 'Properties' },
  'cut':             { zh: '剪切',               en: 'Cut' },
  'copy':            { zh: '复制',               en: 'Copy' },
  'paste':           { zh: '粘贴',               en: 'Paste' },
  'delete':          { zh: '删除',               en: 'Delete' },
  'rename':          { zh: '重命名',             en: 'Rename' },
  'sendto':          { zh: '发送到',             en: 'Send to' },
  'new':             { zh: '新建',               en: 'New' },
  'select':          { zh: '选择',               en: 'Select' },
  'refresh':         { zh: '刷新',               en: 'Refresh' },
  'view':            { zh: '查看',               en: 'View' },
  'sort':            { zh: '排序',               en: 'Sort' },
  'share':           { zh: '共享',               en: 'Share' },
  'format':          { zh: '格式化',             en: 'Format' },
  'eject':           { zh: '弹出',               en: 'Eject' },
  'install':         { zh: '安装',               en: 'Install' },
  'config':          { zh: '配置',               en: 'Configure' },
  'scan':            { zh: '扫描',               en: 'Scan' },
  'restore':         { zh: '还原',               en: 'Restore' },
  'togglehidden':    { zh: '显示/隐藏',          en: 'Toggle Hidden' },
  'pintohome':       { zh: '固定到快速访问',     en: 'Pin to Quick access' },
  'pintotaskbar':    { zh: '固定到任务栏',       en: 'Pin to taskbar' },
  'unpintotaskbar':  { zh: '从任务栏取消固定',   en: 'Unpin from taskbar' },
  'pinToStart':      { zh: '固定到"开始"屏幕',  en: 'Pin to Start' },
  'unpinFromStart':  { zh: '从"开始"屏幕取消固定', en: 'Unpin from Start' },
};

// ---- 数据契约：PS 脚本返回的原始数据 ----

export interface PsRawClassicItem {
  subKeyName: string;
  rawMUIVerb: string | null;
  rawDefault: string | null;
  rawLocalizedDisplayName: string | null;
  rawIcon: string | null;
  isEnabled: boolean;
  command: string;
  registryKey: string;
}

export interface PsRawShellExtItem {
  handlerKeyName: string;
  cleanName: string;
  defaultVal: string;
  isEnabled: boolean;
  actualClsid: string;
  clsidLocalizedString: string | null;
  clsidMUIVerb: string | null;
  clsidDefault: string | null;
  dllPath: string | null;
  siblingMUIVerb: string | null;
  registryKey: string;
}

// ---- 泛型名称过滤器 ----

type FilterRule = [RegExp, string];

const GENERIC_PATTERNS: FilterRule[] = [
  [/^外壳服务对象$/i, 'Group A: COM description'],
  [/^(context|ctx)\s*menu(\s*(handler|ext(ension)?|provider|manager))?$/i, 'Group A'],
  [/^shell\s*(extension|ext|common)(\s*(handler|provider|class))?$/i, 'Group A'],
  [/shell\s+extension$/i, 'Group A: * Shell Extension suffix'],
  [/^shell\s*service(\s*object)?$/i, 'Group A'],
  [/^com\s*(object|server|class)$/i, 'Group A'],
  [/\.dll$/i, 'Group A: filename'],
  [/^microsoft windows/i, 'Group A: system'],
  [/\s+class$/i, 'Group B: COM class suffix'],
  [/^todo:/i, 'Group C: placeholder'],
  [/<[^>]+>/, 'Group C: angle bracket placeholder'],
  [/^(n\/a|na|none|unknown|untitled)$/i, 'Group C: invalid'],
  [/^(a|an|the)\s+/i, 'Group D: article-start sentence'],
  [/^\(.+\)$/, 'Group D: parenthesized debug marker'],
];

function isGenericName(name: string): boolean {
  if (!name || name.length < 2) return true;
  for (const [regex] of GENERIC_PATTERNS) {
    if (regex.test(name)) {
      log.debug(`[NameResolver] Filtered "${name}" — matches ${regex.source}`);
      return true;
    }
  }
  return false;
}

function isUselessPlain(value: string, fallback: string): boolean {
  if (!value || value.length < 2) return true;
  if (value.localeCompare(fallback, undefined, { sensitivity: 'base' }) === 0) return true;
  if (isGenericName(value)) return true;
  return false;
}

// ---- CommandStore 反向索引 ----

export class CommandStoreIndex {
  private map = new Map<string, string>();

  buildFromData(entries: Array<{ clsid: string; muiverb: string }>): void {
    for (const e of entries) {
      this.map.set(e.clsid.toLowerCase(), e.muiverb);
    }
  }

  get(clsid: string): string | null {
    return this.map.get(clsid.toLowerCase()) ?? null;
  }

  invalidate(): void {
    this.map.clear();
  }
}

function translateStandardVerb(name: string, language: 'zh' | 'en'): string | null {
  const lc = name.toLowerCase().trim();
  const entry = STANDARD_VERBS[lc];
  if (entry) {
    return entry[language] || entry.en;
  }
  return null;
}

// ---- Shell 扩展名称解析器 ----

export class ShellExtNameResolver {
  private readonly language: 'zh' | 'en';

  constructor(private readonly win32: IWin32Shell, language: 'zh' | 'en' = 'zh') {
    this.language = language;
  }

  /** Classic Shell 条目名称解析 */
  resolveClassicName(raw: PsRawClassicItem): string {
    const candidates = [
      raw.rawMUIVerb,
      raw.rawDefault,
      raw.rawLocalizedDisplayName,
    ];

    for (const cand of candidates) {
      if (!cand || cand.length < 2) continue;
      if (cand.startsWith('@') || cand.startsWith('ms-resource:')) {
        const resolved = this.win32.resolveIndirect(cand);
        if (resolved && resolved.length >= 2) return resolved;
      } else {
        return cand;
      }
    }

    // 标准谓词翻译：open → 打开, edit → 编辑, ...
    const translated = translateStandardVerb(raw.subKeyName, this.language);
    if (translated) {
      log.debug(`[NameResolver] Standard verb "${raw.subKeyName}" → "${translated}"`);
      return translated;
    }

    return raw.subKeyName;
  }

  /** Shell 扩展条目名称解析（多级回退链） */
  resolveExtName(raw: PsRawShellExtItem, cmdStore: CommandStoreIndex): string {
    const fallback = raw.cleanName;

    // Level 0: directName 间接格式（@dll,-id 或 ms-resource:）
    if (raw.defaultVal && (raw.defaultVal.startsWith('@') || raw.defaultVal.startsWith('ms-resource:'))) {
      try {
        const resolved = this.win32.resolveIndirect(raw.defaultVal);
        if (resolved && resolved.length >= 2) {
          log.debug(`[NameResolver] ${fallback} → Level 0 (directName indirect): "${resolved}"`);
          return resolved;
        }
      } catch { /* fall through */ }
    }

    // 以下 Level 需 CLSID 路径存在
    if (raw.actualClsid) {
      // Level 1: CLSID.LocalizedString
      if (raw.clsidLocalizedString) {
        if (raw.clsidLocalizedString.startsWith('@') || raw.clsidLocalizedString.startsWith('ms-resource:')) {
          try {
            const resolved = this.win32.resolveIndirect(raw.clsidLocalizedString);
            if (resolved && resolved.length >= 2) {
              log.debug(`[NameResolver] ${fallback} → Level 1 (LocalizedString indirect): "${resolved}"`);
              return resolved;
            }
          } catch { /* fall through */ }
        } else if (raw.clsidLocalizedString.length >= 2) {
          if (!isUselessPlain(raw.clsidLocalizedString, fallback)) {
            log.debug(`[NameResolver] ${fallback} → Level 1 (LocalizedString plain): "${raw.clsidLocalizedString}"`);
            return raw.clsidLocalizedString;
          }
        }
      }

      // Level 1.3: Sibling Shell Key MUIVerb
      if (raw.siblingMUIVerb) {
        if (raw.siblingMUIVerb.startsWith('@') || raw.siblingMUIVerb.startsWith('ms-resource:')) {
          try {
            const resolved = this.win32.resolveIndirect(raw.siblingMUIVerb);
            if (resolved && resolved.length >= 2) {
              log.debug(`[NameResolver] ${fallback} → Level 1.3 (sibling MUIVerb indirect): "${resolved}"`);
              return resolved;
            }
          } catch { /* fall through */ }
        } else if (raw.siblingMUIVerb.length >= 2) {
          if (!isUselessPlain(raw.siblingMUIVerb, fallback)) {
            log.debug(`[NameResolver] ${fallback} → Level 1.3 (sibling MUIVerb): "${raw.siblingMUIVerb}"`);
            return raw.siblingMUIVerb;
          }
        }
      }

      // Level 1.5: CLSID.MUIVerb
      if (raw.clsidMUIVerb) {
        if (raw.clsidMUIVerb.startsWith('@') || raw.clsidMUIVerb.startsWith('ms-resource:')) {
          try {
            const resolved = this.win32.resolveIndirect(raw.clsidMUIVerb);
            if (resolved && resolved.length >= 2) {
              log.debug(`[NameResolver] ${fallback} → Level 1.5 (MUIVerb indirect): "${resolved}"`);
              return resolved;
            }
          } catch { /* fall through */ }
        } else if (raw.clsidMUIVerb.length >= 2) {
          if (!isUselessPlain(raw.clsidMUIVerb, fallback)) {
            log.debug(`[NameResolver] ${fallback} → Level 1.5 (MUIVerb): "${raw.clsidMUIVerb}"`);
            return raw.clsidMUIVerb;
          }
        }
      }

      // Level 1.7: CommandStore 反向索引
      const cmdVerb = cmdStore.get(raw.actualClsid);
      if (cmdVerb) {
        // CommandStore MUIVerb 可能是间接字符串（@dll,-id），需 resolveIndirect 解析
        if (cmdVerb.startsWith('@') || cmdVerb.startsWith('ms-resource:')) {
          const resolved = this.win32.resolveIndirect(cmdVerb);
          if (resolved && resolved.length >= 2) {
            log.debug(`[NameResolver] ${fallback} → Level 1.7 (CommandStore resolved): "${resolved}"`);
            return resolved;
          }
        } else {
          log.debug(`[NameResolver] ${fallback} → Level 1.7 (CommandStore): "${cmdVerb}"`);
          return cmdVerb;
        }
      }

      // Level 2: CLSID 默认值
      if (raw.clsidDefault && raw.clsidDefault.length >= 2) {
        if (!isUselessPlain(raw.clsidDefault, fallback)) {
          log.debug(`[NameResolver] ${fallback} → Level 2 (CLSID Default): "${raw.clsidDefault}"`);
          return raw.clsidDefault;
        }
      }
    }

    // Level 2.5: InprocServer32 DLL FileDescription/ProductName
    if (raw.dllPath) {
      const dllName = this.win32.getFileVersionInfo(raw.dllPath);
      if (dllName && dllName.length >= 2 && dllName.length <= 64) {
        if (!isGenericName(dllName)) {
          log.debug(`[NameResolver] ${fallback} → Level 2.5 (DLL): "${dllName}"`);
          return dllName;
        }
        log.debug(`[NameResolver] ${fallback} — Level 2.5 DLL "${dllName}" filtered as generic`);
      }
    }

    // Level 3: directName plain 字符串
    if (raw.defaultVal &&
        !raw.defaultVal.startsWith('@') &&
        !raw.defaultVal.startsWith('ms-resource:')) {
      if (!isUselessPlain(raw.defaultVal, fallback)) {
        log.debug(`[NameResolver] ${fallback} → Level 3 (directName plain): "${raw.defaultVal}"`);
        return raw.defaultVal;
      }
    }

    // 标准谓词翻译：对 cleanName 做最后一搏
    const translated = translateStandardVerb(fallback, this.language);
    if (translated) {
      log.debug(`[NameResolver] ${fallback} → Standard verb translation: "${translated}"`);
      return translated;
    }

    log.debug(`[NameResolver] ${fallback} → Fallback (key name)`);
    return fallback;
  }
}
