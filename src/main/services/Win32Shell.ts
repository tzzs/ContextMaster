import koffi from 'koffi';
import log from '../utils/logger';

export interface IWin32Shell {
  resolveIndirect(source: string): string | null;
  getFileVersionInfo(dllPath: string): string | null;
  readonly uiLanguage: 'zh' | 'en';
}

export class Win32Shell implements IWin32Shell {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private resolveIndirectFn?: (...args: any[]) => number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getFileVersionInfoSizeW?: (...args: any[]) => [number, number];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getFileVersionInfoW?: (...args: any[]) => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private verQueryValueW?: (...args: any[]) => [boolean, bigint | null, number];

  private indirectCache = new Map<string, string | null>();
  private versionCache = new Map<string, string | null>();
  private koffiAvailable = true;

  // 用户 UI 语言 LCID（主语言 ID），用于 DLL 版本信息优先匹配
  private readonly uiLangId: number;

  /** 暴露给 ShellExtNameResolver 用于标准谓词翻译 */
  get uiLanguage(): 'zh' | 'en' {
    // 中文主语言 ID = 0x04 (简体/繁体均适用)
    return this.uiLangId === 0x04 ? 'zh' : 'en';
  }

  constructor() {
    try {
      const shlwapi = koffi.load('shlwapi.dll');
      const version = koffi.load('version.dll');

      this.resolveIndirectFn = shlwapi.func('__stdcall', 'SHLoadIndirectString', 'int', [
        'str16',    // PCWSTR pszSource
        'void *',   // PWSTR pszOutBuf
        'uint32',   // UINT cchOutBuf
        'void *',   // void **ppvReserved
      ]);

      this.getFileVersionInfoSizeW = version.func('__stdcall', 'GetFileVersionInfoSizeW', 'uint32', [
        'str16',
        koffi.out('uint32 *'),
      ]);

      this.getFileVersionInfoW = version.func('__stdcall', 'GetFileVersionInfoW', 'bool', [
        'str16',
        'uint32',
        'uint32',
        'void *',
      ]);

      this.verQueryValueW = version.func('__stdcall', 'VerQueryValueW', 'bool', [
        'void *',
        'str16',
        koffi.out(koffi.pointer('void *')),
        koffi.out('uint32 *'),
      ]);

      // GetUserDefaultUILanguage() returns LANGID (16-bit)
      const kernel32 = koffi.load('kernel32.dll');
      const getLangId = kernel32.func('__stdcall', 'GetUserDefaultUILanguage', 'uint16', []);
      this.uiLangId = getLangId() & 0xFF;
      log.info(`[Win32Shell] Initialized OK — koffiAvailable=true, uiLanguage=${this.uiLanguage}`);
    } catch (e) {
      log.error(`[Win32Shell] FAILED — koffiAvailable=false, reason: ${String(e)}`);
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
      // Buffer.alloc + 'void *' 才能在 koffi 中正确传递预分配输出缓冲区
      // koffi.alloc('char16') + decode('str16') 会导致 segfault
      const buf = Buffer.alloc(2048);
      const hr = this.resolveIndirectFn(source, buf, 1024, null);
      if (hr === 0) {
        const result = buf.toString('utf16le').replace(/\0[\s\S]*$/, '');
        log.debug(`[Win32Shell] SHLoadIndirectString("${source.substring(0, 50)}...") → "${result}"`);
        this.indirectCache.set(source, result || null);
        return result || null;
      }
      log.debug(`[Win32Shell] SHLoadIndirectString failed with HRESULT 0x${(hr >>> 0).toString(16)} for "${source.substring(0, 50)}..."`);
      this.indirectCache.set(source, null);
      return null;
    } catch (e) {
      log.warn('[Win32Shell] SHLoadIndirectString exception:', String(e));
      this.indirectCache.set(source, null);
      return null;
    }
  }

  getFileVersionInfo(dllPath: string): string | null {
    if (!this.koffiAvailable || !this.getFileVersionInfoSizeW) return null;
    const cached = this.versionCache.get(dllPath);
    if (cached !== undefined) return cached;

    try {
      // koffi out 参数在运行时可能返回 number 而非 [number,number] 元组
      const fvResult = this.getFileVersionInfoSizeW!(dllPath, [0]);
      const size: number = Array.isArray(fvResult) ? fvResult[0] : (fvResult as unknown as number);
      if (!size || size === 0) {
        this.versionCache.set(dllPath, null);
        return null;
      }

      const data = Buffer.alloc(size);
      if (!this.getFileVersionInfoW!(dllPath, 0, size, data)) {
        log.debug(`[Win32Shell] GetFileVersionInfoW failed for "${dllPath}"`);
        this.versionCache.set(dllPath, null);
        return null;
      }

      // Query translation table
      const vtResult = this.verQueryValueW!(data, '\\VarFileInfo\\Translation');
      const transPtr: bigint | null = Array.isArray(vtResult) ? vtResult[1] : null;
      const transLen: number = Array.isArray(vtResult) ? (vtResult[2] as number) : 0;
      if (!transPtr || transLen < 4) {
        log.debug(`[Win32Shell] No Translation table in "${dllPath}"`);
        this.versionCache.set(dllPath, null);
        return null;
      }

      // 读取语言/代码页对，UI 语言优先（修复：原版本按文件顺序遍历，始终返回英文）
      const langKeys: string[] = [];
      const uiLangPrefixed: string[] = [];
      const numPairs = transLen / 4;
      for (let i = 0; i < numPairs; i++) {
        const offset = i * 4;
        const lang = this.readUInt16(transPtr, offset);
        const cp = this.readUInt16(transPtr, offset + 2);
        const key = `${lang.toString(16).padStart(4, '0').toUpperCase()}${cp.toString(16).padStart(4, '0').toUpperCase()}`;
        // UI 语言匹配的插入队首
        if ((lang & 0xFF) === this.uiLangId) {
          uiLangPrefixed.push(key);
        } else {
          langKeys.push(key);
        }
      }
      const orderedKeys = [...uiLangPrefixed, ...langKeys];
      log.debug(`[Win32Shell] "${dllPath}" languages: ${orderedKeys.join(', ')} (UI lang 0x${this.uiLangId.toString(16)})`);

      // Query FileDescription / ProductName for each language (UI language first)
      for (const langKey of orderedKeys) {
        const descResult = this.verQueryValueW!(data, `\\StringFileInfo\\${langKey}\\FileDescription`);
        const descPtr: bigint | null = Array.isArray(descResult) ? descResult[1] : null;
        const descLen: number = Array.isArray(descResult) ? (descResult[2] as number) : 0;
        if (descPtr && descLen > 0) {
          const desc = koffi.decode(descPtr, 'str16');
          if (desc && desc.length >= 2 && desc.length <= 64) {
            log.debug(`[Win32Shell] FileDescription for "${dllPath}" [${langKey}]: "${desc}"`);
            this.versionCache.set(dllPath, desc);
            return desc;
          }
        }

        const prodResult = this.verQueryValueW!(data, `\\StringFileInfo\\${langKey}\\ProductName`);
        const prodPtr: bigint | null = Array.isArray(prodResult) ? prodResult[1] : null;
        const prodLen: number = Array.isArray(prodResult) ? (prodResult[2] as number) : 0;
        if (prodPtr && prodLen > 0) {
          const prod = koffi.decode(prodPtr, 'str16');
          if (prod && prod.length >= 2 && prod.length <= 64) {
            log.debug(`[Win32Shell] ProductName for "${dllPath}" [${langKey}]: "${prod}"`);
            this.versionCache.set(dllPath, prod);
            return prod;
          }
        }
      }

      log.debug(`[Win32Shell] No suitable version string found in "${dllPath}"`);
      this.versionCache.set(dllPath, null);
      return null;
    } catch (e) {
      log.warn('[Win32Shell] GetFileVersionInfo failed for', dllPath, ':', String(e));
      this.versionCache.set(dllPath, null);
      return null;
    }
  }

  /**
   * 从 koffi 指针地址读取 uint16 值
   * ptr: koffi out 参数返回的 bigint 地址
   * offset: 字节偏移量
   */
  private readUInt16(ptr: bigint, offset: number): number {
    // koffi.as 将 bigint 地址解释为指定类型的指针
    const typed = koffi.as(ptr + BigInt(offset), 'uint16 *');
    return koffi.decode(typed, 'uint16') as unknown as number;
  }
}
