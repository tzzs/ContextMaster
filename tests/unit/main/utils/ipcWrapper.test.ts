import { describe, it, expect, vi } from 'vitest';
import { wrapHandler } from '@/main/utils/ipcWrapper';
import { IpcResult } from '@/shared/types';

describe('wrapHandler', () => {
  it('should return success result when handler succeeds', async () => {
    const handler = vi.fn().mockResolvedValue('test data');
    const wrapped = wrapHandler(handler);
    
    const result = await wrapped('arg1', 'arg2');
    
    expect(result).toEqual({ success: true, data: 'test data' });
    expect(handler).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('should return error result when handler throws Error', async () => {
    const error = new Error('Test error');
    const handler = vi.fn().mockRejectedValue(error);
    const wrapped = wrapHandler(handler);
    
    const result = await wrapped();
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('Test error');
    expect(result.data).toBeUndefined();
  });

  it('should handle non-Error exceptions (string)', async () => {
    const handler = vi.fn().mockRejectedValue('string error');
    const wrapped = wrapHandler(handler);
    
    const result = await wrapped();
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('string error');
  });

  it('should handle non-Error exceptions (number)', async () => {
    const handler = vi.fn().mockRejectedValue(404);
    const wrapped = wrapHandler(handler);
    
    const result = await wrapped();
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('404');
  });

  it('should handle non-Error exceptions (object)', async () => {
    const handler = vi.fn().mockRejectedValue({ code: 'ERR_001' });
    const wrapped = wrapHandler(handler);
    
    const result = await wrapped();
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('[object Object]');
  });

  it('should handle undefined error', async () => {
    const handler = vi.fn().mockRejectedValue(undefined);
    const wrapped = wrapHandler(handler);
    
    const result = await wrapped();
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('undefined');
  });

  it('should handle null error', async () => {
    const handler = vi.fn().mockRejectedValue(null);
    const wrapped = wrapHandler(handler);
    
    const result = await wrapped();
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('null');
  });

  it('should handle promise rejection with Error constructor', async () => {
    const error = new Error('Promise rejected');
    const handler = vi.fn().mockImplementation(() => Promise.reject(error));
    const wrapped = wrapHandler(handler);
    
    const result = await wrapped();
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('Promise rejected');
  });
});
