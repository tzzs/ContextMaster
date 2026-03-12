import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackupSnapshotRepo } from '../../../../../src/main/data/repositories/BackupSnapshotRepo';
import { BackupType } from '../../../../../src/shared/enums';

describe('BackupSnapshotRepo', () => {
  let repo: BackupSnapshotRepo;
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

    repo = new BackupSnapshotRepo(mockDb);
  });

  describe('insert', () => {
    it('should insert a backup snapshot and return with id', () => {
      const snapshot = {
        name: 'Test Backup',
        creationTime: '2024-01-01T00:00:00Z',
        type: BackupType.Manual,
        menuItemsJson: '[]',
        sha256Checksum: 'abc123',
      };

      const result = repo.insert(snapshot);

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO backup_snapshots')
      );
      expect(mockRun).toHaveBeenCalledWith(
        snapshot.name,
        snapshot.creationTime,
        snapshot.type,
        snapshot.menuItemsJson,
        snapshot.sha256Checksum
      );
      expect(result).toEqual({ ...snapshot, id: 1 });
    });
  });

  describe('findAll', () => {
    it('should return all backup snapshots ordered by creation time', () => {
      const mockRows = [
        {
          id: 1,
          name: 'Backup 1',
          creation_time: '2024-01-01T00:00:00Z',
          type: 'Manual',
          menu_items_json: '[]',
          sha256_checksum: 'abc',
        },
        {
          id: 2,
          name: 'Backup 2',
          creation_time: '2024-01-02T00:00:00Z',
          type: 'Auto',
          menu_items_json: '[]',
          sha256_checksum: 'def',
        },
      ];
      mockAll.mockReturnValue(mockRows);

      const result = repo.findAll();

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY creation_time DESC')
      );
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Backup 1');
      expect(result[0].creationTime).toBe('2024-01-01T00:00:00Z');
      expect(result[0].type).toBe('Manual');
    });

    it('should return empty array when no backups exist', () => {
      mockAll.mockReturnValue([]);

      const result = repo.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return backup snapshot by id', () => {
      const mockRow = {
        id: 1,
        name: 'Test Backup',
        creation_time: '2024-01-01T00:00:00Z',
        type: 'Manual',
        menu_items_json: '[]',
        sha256_checksum: 'abc123',
      };
      mockGet.mockReturnValue(mockRow);

      const result = repo.findById(1);

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = ?')
      );
      expect(mockGet).toHaveBeenCalledWith(1);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('Test Backup');
    });

    it('should return null when backup not found', () => {
      mockGet.mockReturnValue(undefined);

      const result = repo.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete backup by id', () => {
      repo.delete(1);

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM backup_snapshots')
      );
      expect(mockRun).toHaveBeenCalledWith(1);
    });
  });
});
