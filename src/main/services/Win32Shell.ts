import koffi from 'koffi';
import log from '../utils/logger';

export interface IWin32Shell {
  resolveIndirect(source: string): string | null;
  readonly uiLanguage: 'zh' | 'en';
}

export class Win32Shell implements IWin32Shell {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private resolveIndirectFn?: (...args: any[]) => number;

  private indirectCache = new Map<string, string | null>();
  private koffiAvailable = true;

  private readonly uiLangId: number;

  get uiLanguage(): 'zh' | 'en' {
    return this.uiLangId === 0x04 ? 'zh' : 'en';
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
      this.uiLangId = getLangId() & 0xFF;
      log.info(`[Win32Shell] Initialized OK — uiLanguage=${this.uiLanguage}`);
    } catch (e) {
      log.error(`[Win32Shell] FAILED — reason: ${String(e)}`);
      this.koffiAvailable = false;
      this.uiLangId = 0x09;
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
