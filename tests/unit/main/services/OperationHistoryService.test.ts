import { describe, it, expect, vi, beforeEach, MockedObject } from 'vitest';
import { OperationHistoryService } from '@/main/services/OperationHistoryService';
import { OperationRecordRepo } from '@/main/data/repositories/OperationRecordRepo';
import { MenuManagerService } from '@/main/services/MenuManagerService';
import { MenuScene, MenuItemType, OperationType } from '@/shared/enums';
import { OperationRecord } from '@/shared/types';

vi.mock('@/main/utils/logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const makeRecord = (overrides: Partial<OperationRecord> = {}): OperationRecord => ({
  id: 1,
  timestamp: '2026-01-01T00:00:00Z',
  operationType: OperationType.Enable,
  targetEntryName: 'TestItem',
  registryPath: 'DesktopBackground\\Shell\\TestItem',
  oldValue: null,
  newValue: null,
  ...overrides,
});

const makeItem = (scene: MenuScene, registryKey: string) => ({
  id: -1,
  name: 'TestItem',
  command: '',
  iconPath: null,
  isEnabled: true,
  source: '',
  menuScene: scene,
  registryKey,
  type: MenuItemType.System,
});

describe('OperationHistoryService', () => {
  let service: OperationHistoryService;
  let mockRepo: MockedObject<OperationRecordRepo>;
  let mockMenuManager: MockedObject<MenuManagerService>;

  beforeEach(() => {
    mockRepo = {
      insert: vi.fn(),
      findAll: vi.fn().mockReturnValue([]),
      findById: vi.fn(),
      deleteAll: vi.fn(),
    } as unknown as MockedObject<OperationRecordRepo>;

    mockMenuManager = {
      enableItem: vi.fn(),
      disableItem: vi.fn(),
      invalidateCache: vi.fn(),
    } as unknown as MockedObject<MenuManagerService>;

    service = new OperationHistoryService(mockRepo);
  });

  // ── determineSceneFromRegistryKey（通过 undoOperation 间接测试）──

  describe('undoOperation — 场景路径解析', () => {
    it('Directory\\Background\\shell → DirectoryBackground（不误判为 Folder）', async () => {
      const record = makeRecord({
        operationType: OperationType.Enable,
        registryPath: 'Directory\\Background\\shell\\TestItem',
      });
      vi.mocked(mockRepo.findById).mockReturnValue(record);
      vi.mocked(mockMenuManager.disableItem).mockResolvedValue(undefined);

      await service.undoOperation(1, mockMenuManager as unknown as MenuManagerService);

      expect(mockMenuManager.invalidateCache).toHaveBeenCalledWith(MenuScene.DirectoryBackground);
    });

    it('DesktopBackground → Desktop', async () => {
      const record = makeRecord({ registryPath: 'DesktopBackground\\Shell\\TestItem' });
      vi.mocked(mockRepo.findById).mockReturnValue(record);
      vi.mocked(mockMenuManager.disableItem).mockResolvedValue(undefined);

      await service.undoOperation(1, mockMenuManager as unknown as MenuManagerService);

      expect(mockMenuManager.invalidateCache).toHaveBeenCalledWith(MenuScene.Desktop);
    });

    it('CLSID\\{645FF040 → RecycleBin', async () => {
      const record = makeRecord({
        registryPath: 'CLSID\\{645FF040-5081-101B-9F08-00AA002F954E}\\shell\\TestItem',
      });
      vi.mocked(mockRepo.findById).mockReturnValue(record);
      vi.mocked(mockMenuManager.disableItem).mockResolvedValue(undefined);

      await service.undoOperation(1, mockMenuManager as unknown as MenuManagerService);

      expect(mockMenuManager.invalidateCache).toHaveBeenCalledWith(MenuScene.RecycleBin);
    });

    it('Drive\\shell → Drive', async () => {
      const record = makeRecord({ registryPath: 'Drive\\shell\\TestItem' });
      vi.mocked(mockRepo.findById).mockReturnValue(record);
      vi.mocked(mockMenuManager.disableItem).mockResolvedValue(undefined);

      await service.undoOperation(1, mockMenuManager as unknown as MenuManagerService);

      expect(mockMenuManager.invalidateCache).toHaveBeenCalledWith(MenuScene.Drive);
    });

    it('Directory\\shell → Folder', async () => {
      const record = makeRecord({ registryPath: 'Directory\\shell\\TestItem' });
      vi.mocked(mockRepo.findById).mockReturnValue(record);
      vi.mocked(mockMenuManager.disableItem).mockResolvedValue(undefined);

      await service.undoOperation(1, mockMenuManager as unknown as MenuManagerService);

      expect(mockMenuManager.invalidateCache).toHaveBeenCalledWith(MenuScene.Folder);
    });

    it('*\\shell → File', async () => {
      const record = makeRecord({ registryPath: '*\\shell\\TestItem' });
      vi.mocked(mockRepo.findById).mockReturnValue(record);
      vi.mocked(mockMenuManager.disableItem).mockResolvedValue(undefined);

      await service.undoOperation(1, mockMenuManager as unknown as MenuManagerService);

      expect(mockMenuManager.invalidateCache).toHaveBeenCalledWith(MenuScene.File);
    });

    it('未知路径抛出错误', async () => {
      const record = makeRecord({ registryPath: 'UNKNOWN\\path\\TestItem' });
      vi.mocked(mockRepo.findById).mockReturnValue(record);

      await expect(
        service.undoOperation(1, mockMenuManager as unknown as MenuManagerService)
      ).rejects.toThrow('无法从注册表路径确定场景');
    });
  });

  // ── undoOperation 启用/禁用反转逻辑 ──

  describe('undoOperation — 启用/禁用反转', () => {
    it('Enable 操作撤销 → 调用 disableItem', async () => {
      const record = makeRecord({ operationType: OperationType.Enable });
      vi.mocked(mockRepo.findById).mockReturnValue(record);
      vi.mocked(mockMenuManager.disableItem).mockResolvedValue(undefined);

      await service.undoOperation(1, mockMenuManager as unknown as MenuManagerService);

      expect(mockMenuManager.disableItem).toHaveBeenCalled();
      expect(mockMenuManager.enableItem).not.toHaveBeenCalled();
    });

    it('Disable 操作撤销 → 调用 enableItem', async () => {
      const record = makeRecord({ operationType: OperationType.Disable });
      vi.mocked(mockRepo.findById).mockReturnValue(record);
      vi.mocked(mockMenuManager.enableItem).mockResolvedValue(undefined);

      await service.undoOperation(1, mockMenuManager as unknown as MenuManagerService);

      expect(mockMenuManager.enableItem).toHaveBeenCalled();
      expect(mockMenuManager.disableItem).not.toHaveBeenCalled();
    });

    it('撤销不存在的记录 → 抛出异常', async () => {
      vi.mocked(mockRepo.findById).mockReturnValue(null);

      await expect(
        service.undoOperation(999, mockMenuManager as unknown as MenuManagerService)
      ).rejects.toThrow('找不到要撤销的操作记录');
    });

    it('不支持 Backup 类型的撤销 → 抛出异常', async () => {
      const record = makeRecord({ operationType: OperationType.Backup });
      vi.mocked(mockRepo.findById).mockReturnValue(record);

      await expect(
        service.undoOperation(1, mockMenuManager as unknown as MenuManagerService)
      ).rejects.toThrow('不支持该类型操作的撤销');
    });
  });
});
