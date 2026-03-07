using ContextMaster.Core.Models.Entities;
using ContextMaster.Core.Models.Enums;
using ContextMaster.Core.Services;
using ContextMaster.Data;
using Microsoft.EntityFrameworkCore;

namespace ContextMaster.Data.Implementations;

/// <summary>
/// 操作历史服务实现
/// 管理操作记录的 CRUD，支持按场景/类型/日期过滤，支持单条撤销
/// </summary>
public class OperationHistoryService : IOperationHistoryService
{
    private readonly DatabaseContext _dbContext;

    public OperationHistoryService(DatabaseContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <summary>
    /// 记录操作
    /// </summary>
    public void RecordOperation(OperationType operationType, string targetEntryName,
        string registryPath, string? oldValue = null, string? newValue = null)
    {
        var record = new OperationRecord
        {
            OperationType = operationType,
            TargetEntryName = targetEntryName,
            RegistryPath = registryPath,
            OldValue = oldValue,
            NewValue = newValue,
            Timestamp = DateTime.Now
        };

        _dbContext.OperationRecords.Add(record);
        _dbContext.SaveChanges();
    }

    /// <summary>
    /// 获取所有操作记录
    /// </summary>
    public async Task<List<OperationRecord>> GetAllRecordsAsync()
    {
        return await _dbContext.OperationRecords
            .OrderByDescending(r => r.Timestamp)
            .ToListAsync();
    }

    /// <summary>
    /// 按日期范围获取操作记录
    /// </summary>
    public async Task<List<OperationRecord>> GetRecordsByDateRangeAsync(DateTime startDate, DateTime endDate)
    {
        return await _dbContext.OperationRecords
            .Where(r => r.Timestamp >= startDate && r.Timestamp <= endDate)
            .OrderByDescending(r => r.Timestamp)
            .ToListAsync();
    }

    /// <summary>
    /// 按操作类型获取记录
    /// </summary>
    public async Task<List<OperationRecord>> GetRecordsByTypeAsync(OperationType operationType)
    {
        return await _dbContext.OperationRecords
            .Where(r => r.OperationType == operationType)
            .OrderByDescending(r => r.Timestamp)
            .ToListAsync();
    }

    /// <summary>
    /// 清除所有操作记录
    /// </summary>
    public async Task ClearAllRecordsAsync()
    {
        var records = await _dbContext.OperationRecords.ToListAsync();
        _dbContext.OperationRecords.RemoveRange(records);
        await _dbContext.SaveChangesAsync();
    }

    /// <summary>
    /// 单条操作撤销（根据记录中的前值执行反向操作）
    /// </summary>
    public async Task UndoOperationAsync(int recordId, IMenuManagerService menuManagerService)
    {
        var record = await _dbContext.OperationRecords.FindAsync(recordId);
        if (record == null)
        {
            throw new InvalidOperationException("找不到要撤销的操作记录");
        }

        if (record.OperationType == OperationType.Enable || record.OperationType == OperationType.Disable)
        {
            var tempItem = new MenuItemEntry
            {
                Id = -1,
                Name = record.TargetEntryName,
                Command = string.Empty,
                IconPath = string.Empty,
                IsEnabled = record.OperationType == OperationType.Enable,
                Source = string.Empty,
                MenuScene = DetermineSceneFromRegistryKey(record.RegistryPath),
                RegistryKey = record.RegistryPath,
                Type = MenuItemType.System
            };

            if (record.OperationType == OperationType.Enable)
            {
                menuManagerService.DisableItem(tempItem);
            }
            else
            {
                menuManagerService.EnableItem(tempItem);
            }
        }
        else
        {
            throw new InvalidOperationException("不支持该类型操作的撤销");
        }
    }

    private MenuScene DetermineSceneFromRegistryKey(string registryKey)
    {
        if (registryKey.Contains("DesktopBackground"))
            return MenuScene.Desktop;
        if (registryKey.Contains(@"*\"))
            return MenuScene.File;
        if (registryKey.Contains("Directory\\shell") && !registryKey.Contains("Directory\\Background"))
            return MenuScene.Folder;
        if (registryKey.Contains("Drive\\shell"))
            return MenuScene.Drive;
        if (registryKey.Contains("Directory\\Background"))
            return MenuScene.DirectoryBackground;
        if (registryKey.Contains("CLSID"))
            return MenuScene.RecycleBin;
        return MenuScene.File;
    }
}