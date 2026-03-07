using ContextMaster.Core.Models.Entities;
using ContextMaster.Core.Models.Enums;

namespace ContextMaster.Core.Services;

/// <summary>
/// 备份服务接口
/// </summary>
public interface IBackupService
{
    Task<BackupSnapshot> CreateBackupAsync(string name, BackupType type = BackupType.Manual);
    Task<BackupSnapshot> ImportBackupAsync(string filePath);
    Task ExportBackupAsync(BackupSnapshot snapshot, string filePath);
    Task RestoreBackupAsync(BackupSnapshot snapshot);
    Task<List<BackupSnapshot>> GetAllBackupsAsync();
    Task<BackupSnapshot?> GetLatestBackupAsync();
    Task DeleteBackupAsync(int id);
    Task<List<(MenuItemEntry Current, MenuItemEntry Backup)>> PreviewRestoreDifferencesAsync(BackupSnapshot snapshot);
}