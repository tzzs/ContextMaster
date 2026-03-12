import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackupService } from '../../../../../src/main/services/BackupService';
import { BackupSnapshotRepo } from '../../../../../src/main/data/repositories/BackupSnapshotRepo';
import { MenuManagerService } from '../../../../../src/main/services/MenuManagerService';
import { OperationHistoryService } from '../../../../../src/main/services/OperationHistoryService';
import { BackupType, MenuScene, OperationType, MenuItemType } from '../../../../../src/shared/enums';
import { MenuItemEntry } from '../../../../../src/shared/types';

// Mock dependencies
vi.mock('../../../../../src/main/data/repositories/BackupSnapshotRepo');
vi.mock('../../../../../src/main/services/MenuManagerService');
vi.mock('../../../../../src/main/services/OperationHistoryService');
vi.mock('electron', () => ({
  dialog: {
    showSaveDialog: vi.fn(),
    showOpenDialog: vi.fn(),
  },
  BrowserWindow: vi.fn(),
}));
vi.mock('fs', () => ({
  promises: {
    writeFile: vi.fn(),
    readFile: vi.fn(),
  },
}));
vi.mock('crypto', () => ({
  createHash: vi.fn(() => ({
    update: vi.fn(() => ({
      digest: vi.fn(() => 'mock-sha256-hash'),
    })),
  })),
}));

describe('BackupService', () => {
  let service: BackupService;
  let mockRepo: BackupSnapshotRepo;
  let mockMenuManager: MenuManagerService;
  let mockHistory: OperationHistoryService;

  beforeEach(() => {
    mockRepo = {
      insert: vi.fn().mockReturnValue({ id: 1 }),
      findAll: vi.fn().mockReturnValue([]),
      findById: vi.fn(),
      delete: vi.fn(),
    } as unknown as BackupSnapshotRepo;

    mockMenuManager = {
      getMenuItems: vi.fn(),
      batchEnable: vi.fn(),
      batchDisable: vi.fn(),
    } as unknown as MenuManagerService;

    mockHistory = {
      recordOperation: vi.fn(),
    } as unknown as OperationHistoryService;

    service = new BackupService(mockRepo, mockMenuManager, mockHistory);
  });

  describe('createBackup', () => {
    it('should create backup with all menu items', async () => {
      const mockItems: MenuItemEntry[] = [
        {
          id: 1,
          name: 'Test Menu',
          command: 'test.exe',
          iconPath: null,
          isEnabled: true,
          source: 'TestApp',
          menuScene: MenuScene.Desktop,
          registryKey: 'HKCR\\test',
          type: MenuItemType.System,
        },
      ];

      mockMenuManager.getMenuItems.mockResolvedValue(mockItems);

      await service.createBackup('Test Backup', BackupType.Manual);

      expect(mockMenuManager.getMenuItems).toHaveBeenCalledTimes(
        Object.values(MenuScene).length
      );
      expect(mockRepo.insert).toHaveBeenCalled();
      expect(mockHistory.recordOperation).toHaveBeenCalledWith(
        OperationType.Backup,
        'Test Backup',
        '',
        '',
        expect.any(String)
      );
    });

    it('should include backup type in snapshot', async () => {
      mockMenuManager.getMenuItems.mockResolvedValue([]);

      await service.createBackup('Auto Backup', BackupType.Auto);

      expect(mockRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Auto Backup',
          type: BackupType.Auto,
        })
      );
    });
  });

  describe('deleteBackup', () => {
    it('should call repo delete with correct id', () => {
      service.deleteBackup(123);

      expect(mockRepo.delete).toHaveBeenCalledWith(123);
    });
  });

  describe('getAllBackups', () => {
    it('should return all backups from repo', () => {
      const mockBackups = [
        { id: 1, name: 'Backup 1' },
        { id: 2, name: 'Backup 2' },
      ];
      mockRepo.findAll.mockReturnValue(mockBackups);

      const result = service.getAllBackups();

      expect(result).toEqual(mockBackups);
      expect(mockRepo.findAll).toHaveBeenCalled();
    });
  });
});
