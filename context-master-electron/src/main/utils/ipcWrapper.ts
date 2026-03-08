import { IpcResult } from '../../shared/types';
import log from 'electron-log';

/**
 * 统一 IPC handler 包装：捕获异常，返回 IpcResult<T>
 * renderer 层无需 try-catch
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function wrapHandler<T>(
  fn: (...args: any[]) => T | Promise<T>
): (...args: any[]) => Promise<IpcResult<T>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (...args: any[]): Promise<IpcResult<T>> => {
    try {
      const data = await fn(...args);
      return { success: true, data };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      log.error('[IPC Error]', msg, e);
      return { success: false, error: msg };
    }
  };
}
