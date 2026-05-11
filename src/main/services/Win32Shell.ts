import koffi from 'koffi';
import log from '../utils/logger';

/** 完整 BCP47 短码（按系统 UI 语言映射，用于 STANDARD_VERBS 多语言查找） */
export type PrimaryLang = 'zh' | 'en' | 'ja' | 'ko' | 'de' | 'fr' | 'ru' | 'es' | 'pt' | 'it';

/** Windows LANGID 主语言 ID（低 10 位）→ BCP47 短码 */
const PRIMARY_LANG_MAP: Record<number, PrimaryLang> = {
  0x04: 'zh',  // LANG_CHINESE
  0x09: 'en',  // LANG_ENGLISH
  0x11: 'ja',  // LANG_JAPANESE
  0x12: 'ko',  // LANG_KOREAN
  0x07: 'de',  // LANG_GERMAN
  0x0C: 'fr',  // LANG_FRENCH
  0x19: 'ru',  // LANG_RUSSIAN
  0x0A: 'es',  // LANG_SPANISH
  0x16: 'pt',  // LANG_PORTUGUESE
  0x10: 'it',  // LANG_ITALIAN
};

export interface IWin32Shell {
  resolveIndirect(source: string): string | null;
  /** @deprecated 仅 zh/en 二分，新代码请用 primaryLang */
  readonly uiLanguage: 'zh' | 'en';
  /** 扩展的系统 UI 主语言代码（10 种语言，其他系统回退 en） */
  readonly primaryLang: PrimaryLang;
}

export class Win32Shell implements IWin32Shell {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private resolveIndirectFn?: (...args: any[]) => number;

  private indirectCache = new Map<string, string | null>();
  private koffiAvailable = true;

  private readonly uiLangId: number;

  get uiLanguage(): 'zh' | 'en' {
    return (this.uiLangId & 0x3FF) === 0x04 ? 'zh' : 'en';
  }

  get primaryLang(): PrimaryLang {
    // GetUserDefaultUILanguage 返回 LANGID，低 10 位为主语言 ID
    const primaryId = this.uiLangId & 0x3FF;
    return PRIMARY_LANG_MAP[primaryId] ?? 'en';
  }

  constructor() {
    try {
      const shlwapi = koffi.load('shlwapi.dll');
      this.resolveIndirectFn = shlwapi.func('__stdcall', 'SHLoadIndirectString', 'int', [
        'str16',    // PCWSTR pszSource
        'void *',   // PWSTR pszOutBuf
        'uint32',   // UINT cchOutBuf
        'void *',   // void **ppvReserved
      ]);

      const kernel32 = koffi.load('kernel32.dll');
      const getLangId = kernel32.func('__stdcall', 'GetUserDefaultUILanguage', 'uint16', []);
      // 注意：保留完整 16 位 LANGID（之前 & 0xFF 截断会丢失次语言信息，对 primaryLang 不影响）
      this.uiLangId = getLangId();
      log.info(`[Win32Shell] Initialized OK — uiLanguage=${this.uiLanguage} primaryLang=${this.primaryLang} (LANGID=0x${this.uiLangId.toString(16)})`);
    } catch (e) {
      log.error(`[Win32Shell] FAILED — reason: ${String(e)}`);
      this.koffiAvailable = false;
      this.uiLangId = 0x0409;  // en-US fallback
    }
  }

  resolveIndirect(source: string): string | null {
    if (!this.koffiAvailable || !this.resolveIndirectFn) return null;
    if (!source || (!source.startsWith('@') && !source.startsWith('ms-resource:'))) {
      return null;
    }
    const cached = this.indirectCache.get(source);
    if (cached !== undefined) return cached;

    try {
      const buf = Buffer.alloc(2048);
      const hr = this.resolveIndirectFn(source, buf, 1024, null);
      if (hr === 0) {
        const result = buf.toString('utf16le').replace(/\0[\s\S]*$/, '');
        log.debug(`[Win32Shell] SHLoadIndirectString("${source.substring(0, 50)}...") → "${result}"`);
        this.indirectCache.set(source, result || null);
        return result || null;
      }
      log.debug(`[Win32Shell] SHLoadIndirectString failed HRESULT 0x${(hr >>> 0).toString(16)} for "${source.substring(0, 50)}..."`);
      this.indirectCache.set(source, null);
      return null;
    } catch (e) {
      log.warn('[Win32Shell] SHLoadIndirectString exception:', String(e));
      this.indirectCache.set(source, null);
      return null;
    }
  }
}
