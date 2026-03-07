using ContextMaster.Core.Models.Entities;
using ContextMaster.Core.Models.Enums;

namespace ContextMaster.Core.Services;

/// <summary>
/// 操作历史服务接口
/// </summary>
public interface IOperationHistoryService
{
    void RecordOperation(OperationType operationType, string targetEntryName,
        string registryPath, string? oldValue = null, string? newValue = null);
    Task<List<OperationRecord>> GetAllRecordsAsync();
    Task<List<OperationRecord>> GetRecordsByDateRangeAsync(DateTime startDate, DateTime endDate);
    Task<List<OperationRecord>> GetRecordsByTypeAsync(OperationType operationType);
    Task ClearAllRecordsAsync();
    Task UndoOperationAsync(int recordId, IMenuManagerService menuManagerService);
}