import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OperationRecordRepo } from '@/main/data/repositories/OperationRecordRepo';
import { OperationType } from '@/shared/enums';

describe('OperationRecordRepo', () => {
  let repo: OperationRecordRepo;
  let mockDb: any;
  let mockPrepare: any;
  let mockRun: any;
  let mockGet: any;
  let mockAll: any;

  beforeEach(() => {
    mockRun = vi.fn().mockReturnValue({ lastInsertRowid: 1, changes: 1 });
    mockGet = vi.fn();
    mockAll = vi.fn().mockReturnValue([]);
    
    mockPrepare = vi.fn().mockReturnValue({
      run: mockRun,
      get: mockGet,
      all: mockAll,
    });

    mockDb = {
      prepare: mockPrepare,
    };

    repo = new OperationRecordRepo(mockDb);
  });

  describe('insert', () => {
    it('should insert an operation record and return with id', () => {
      const record = {
        timestamp: '2024-01-01T00:00:00Z',
        operationType: OperationType.Enable,
        targetEntryName: 'Test Menu',
        registryPath: 'HKCR\\test',
        oldValue: 'disabled',
        newValue: 'enabled',
      };

      const result = repo.insert(record);

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO operation_records')
      );
      expect(mockRun).toHaveBeenCalledWith(
        record.timestamp,
        record.operationType,
        record.targetEntryName,
        record.registryPath,
        record.oldValue,
        record.newValue
      );
      expect(result).toEqual({ ...record, id: 1 });
    });

    it('should handle null values for old and new values', () => {
      const record = {
        timestamp: '2024-01-01T00:00:00Z',
        operationType: OperationType.Backup,
        targetEntryName: 'Test Backup',
        registryPath: '',
        oldValue: null,
        newValue: null,
      };

      repo.insert(record);

      expect(mockRun).toHaveBeenCalledWith(
        record.timestamp,
        record.operationType,
        record.targetEntryName,
        record.registryPath,
        null,
        null
      );
    });
  });

  describe('findAll', () => {
    it('should return all operation records ordered by timestamp', () => {
      const mockRows = [
        {
          id: 1,
          timestamp: '2024-01-01T00:00:00Z',
          operation_type: 'Enable',
          target_name: 'Menu 1',
          registry_path: 'HKCR\\test1',
          old_value: 'disabled',
          new_value: 'enabled',
        },
        {
          id: 2,
          timestamp: '2024-01-02T00:00:00Z',
          operation_type: 'Disable',
          target_name: 'Menu 2',
          registry_path: 'HKCR\\test2',
          old_value: 'enabled',
          new_value: 'disabled',
        },
      ];
      mockAll.mockReturnValue(mockRows);

      const result = repo.findAll();

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY timestamp DESC')
      );
      expect(result).toHaveLength(2);
      expect(result[0].operationType).toBe('Enable');
      expect(result[1].operationType).toBe('Disable');
    });
  });

  describe('findById', () => {
    it('should return operation record by id', () => {
      const mockRow = {
        id: 1,
        timestamp: '2024-01-01T00:00:00Z',
        operation_type: 'Enable',
        target_name: 'Test Menu',
        registry_path: 'HKCR\\test',
        old_value: 'disabled',
        new_value: 'enabled',
      };
      mockGet.mockReturnValue(mockRow);

      const result = repo.findById(1);

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = ?')
      );
      expect(mockGet).toHaveBeenCalledWith(1);
      expect(result).not.toBeNull();
      expect(result?.operationType).toBe('Enable');
    });

    it('should return null when record not found', () => {
      mockGet.mockReturnValue(undefined);

      const result = repo.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('deleteAll', () => {
    it('should delete all operation records', () => {
      repo.deleteAll();

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM operation_records')
      );
      expect(mockRun).toHaveBeenCalled();
    });
  });
});
