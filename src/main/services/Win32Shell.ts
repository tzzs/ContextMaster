import koffi from 'koffi';
import log from '../utils/logger';

export interface IWin32Shell {
  resolveIndirect(source: string): string | null;
  getFileVersionInfo(dllPath: string): string | null;
}

// koffi out-param types — 返回数组 [ret, out1, out2, ...]
type Out2<A, B> = [A, B];
type Out3<A, B, C> = [A, B, C];

export class Win32Shell implements IWin32Shell {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private resolveIndirectFn: (...args: any[]) => number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getFileVersionInfoSizeW: (...args: any[]) => Out2<number, number>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getFileVersionInfoW: (...args: any[]) => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private verQueryValueW: (...args: any[]) => Out3<boolean, bigint | null, number>;

  // 缓存已解析的字符串，避免重复 FFI 调用
  private indirectCache = new Map<string, string | null>();
  private versionCache = new Map<string, string | null>();

  constructor() {
    const shlwapi = koffi.load('shlwapi.dll');
    const version = koffi.load('version.dll');

    // HRESULT SHLoadIndirectString(PCWSTR pszSource, PWSTR pszOutBuf, UINT cchOutBuf, void **ppvReserved)
    this.resolveIndirectFn = shlwapi.func('__stdcall', 'SHLoadIndirectString', 'int', [
      'str16',
      'char16 *',
      'uint32',
      'void *',
    ]);

    // DWORD GetFileVersionInfoSizeW(LPCWSTR lptstrFilename, LPDWORD lpdwHandle)
    this.getFileVersionInfoSizeW = version.func('__stdcall', 'GetFileVersionInfoSizeW', 'uint32', [
      'str16',
      koffi.out('uint32 *'),
    ]);

    // BOOL GetFileVersionInfoW(LPCWSTR lptstrFilename, DWORD dwHandle, DWORD dwLen, LPVOID lpData)
    this.getFileVersionInfoW = version.func('__stdcall', 'GetFileVersionInfoW', 'bool', [
      'str16',
      'uint32',
      'uint32',
      'void *',
    ]);

    // BOOL VerQueryValueW(LPCVOID pBlock, LPCWSTR lpSubBlock, LPVOID *lplpBuffer, PUINT puLen)
    this.verQueryValueW = version.func('__stdcall', 'VerQueryValueW', 'bool', [
      'void *',
      'str16',
      koffi.out(koffi.pointer('void *')),
      koffi.out('uint32 *'),
    ]);
  }

  resolveIndirect(source: string): string | null {
    if (!source || (!source.startsWith('@') && !source.startsWith('ms-resource:'))) {
      return null;
    }
    const cached = this.indirectCache.get(source);
    if (cached !== undefined) return cached;

    try {
      const buf = Buffer.alloc(1024);
      const hr = this.resolveIndirectFn(source, buf, 512, null);
      if (hr === 0) {
        const result = buf.toString('utf16le').replace(/\0[\s\S]*$/, '');
        this.indirectCache.set(source, result || null);
        return result || null;
      }
      this.indirectCache.set(source, null);
      return null;
    } catch (e) {
      log.warn('[Win32Shell] SHLoadIndirectString failed:', String(e));
      this.indirectCache.set(source, null);
      return null;
    }
  }

  getFileVersionInfo(dllPath: string): string | null {
    const cached = this.versionCache.get(dllPath);
    if (cached !== undefined) return cached;

    try {
      // Step 1: Get buffer size
      const result = this.getFileVersionInfoSizeW(dllPath, [0]);
      const size = Array.isArray(result) ? result[0] : (result as unknown as number);
      if (!size || size === 0) {
        this.versionCache.set(dllPath, null);
        return null;
      }

      // Step 2: Read version info
      const data = Buffer.alloc(size as number);
      if (!this.getFileVersionInfoW(dllPath, 0, size as number, data)) {
        this.versionCache.set(dllPath, null);
        return null;
      }

      // Step 3: Query translation table
      const vtResult = this.verQueryValueW(data, '\\VarFileInfo\\Translation');
      const transPtr = Array.isArray(vtResult) ? vtResult[1] : null;
      const transLen = Array.isArray(vtResult) ? vtResult[2] : 0;
      if (!transPtr || (transLen as number) < 4) {
        this.versionCache.set(dllPath, null);
        return null;
      }

      // Read language/codepage pairs
      const langKeys: string[] = [];
      const numPairs = (transLen as number) / 4;
      for (let i = 0; i < numPairs; i++) {
        const offset = i * 4;
        const lang = this.readUInt16(transPtr as bigint, offset);
        const cp = this.readUInt16(transPtr as bigint, offset + 2);
        langKeys.push(
          `${lang.toString(16).padStart(4, '0').toUpperCase()}${cp.toString(16).padStart(4, '0').toUpperCase()}`
        );
      }

      // Step 4: Query FileDescription / ProductName for each language
      for (const langKey of langKeys) {
        const descResult = this.verQueryValueW(data, `\\StringFileInfo\\${langKey}\\FileDescription`);
        const descPtr = Array.isArray(descResult) ? descResult[1] : null;
        const descLen = Array.isArray(descResult) ? descResult[2] : 0;
        if (descPtr && (descLen as number) > 0) {
          const desc = koffi.decode(descPtr as bigint, 'str16');
          if (desc && desc.length >= 2 && desc.length <= 64) {
            this.versionCache.set(dllPath, desc);
            return desc;
          }
        }

        const prodResult = this.verQueryValueW(data, `\\StringFileInfo\\${langKey}\\ProductName`);
        const prodPtr = Array.isArray(prodResult) ? prodResult[1] : null;
        const prodLen = Array.isArray(prodResult) ? prodResult[2] : 0;
        if (prodPtr && (prodLen as number) > 0) {
          const prod = koffi.decode(prodPtr as bigint, 'str16');
          if (prod && prod.length >= 2 && prod.length <= 64) {
            this.versionCache.set(dllPath, prod);
            return prod;
          }
        }
      }

      this.versionCache.set(dllPath, null);
      return null;
    } catch (e) {
      log.warn('[Win32Shell] GetFileVersionInfo failed for', dllPath, ':', String(e));
      this.versionCache.set(dllPath, null);
      return null;
    }
  }

  private readUInt16(ptr: bigint, offset: number): number {
    // 用 koffi.as 在 ptr+offset 地址处读取 uint16
    const addr = BigInt(Number(ptr) + offset);
    const p = koffi.as(addr, 'uint16 *');
    return koffi.decode(p, 'uint16') as unknown as number;
  }
}
