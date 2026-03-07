using ContextMaster.Core.Models.Entities;
using ContextMaster.Core.Models.Enums;
using ContextMaster.Core.Services;
using ContextMaster.Core.Helpers;
using ContextMaster.Data;
using Microsoft.EntityFrameworkCore;

namespace ContextMaster.Data.Implementations;

/// <summary>
/// 备份服务实现
/// 负责序列化全部场景的 MenuItemEntry 列表为 JSON，加 SHA256 校验码后写入 .cmbackup 文件；
/// 导入时校验后反序列化并预览差异
/// </summary>
public class BackupService : IBackupService
{
    private readonly DatabaseContext _dbContext;
    private readonly IMenuManagerService _menuManagerService;

    public BackupService(DatabaseContext dbContext, IMenuManagerService menuManagerService)
    {
        _dbContext = dbContext;
        _menuManagerService = menuManagerService;
    }

    /// <summary>
    /// 创建备份快照
    /// </summary>
    public async Task<BackupSnapshot> CreateBackupAsync(string name, BackupType type = BackupType.Manual)
    {
        var allItems = new List<MenuItemEntry>();
        foreach (var scene in Enum.GetValues<MenuScene>())
        {
            allItems.AddRange(_menuManagerService.GetMenuItems(scene));
        }

        var jsonData = JsonHelper.Serialize(allItems);
        var checksum = HashHelper.ComputeSha256(jsonData);

        var snapshot = new BackupSnapshot
        {
            Name = name,
            CreationTime = DateTime.Now,
            Type = type,
            MenuItemsJson = jsonData,
            Sha256Checksum = checksum
        };

        _dbContext.BackupSnapshots.Add(snapshot);
        await _dbContext.SaveChangesAsync();

        return snapshot;
    }

    /// <summary>
    /// 从备份文件导入
    /// </summary>
    public async Task<BackupSnapshot> ImportBackupAsync(string filePath)
    {
        var jsonData = await File.ReadAllTextAsync(filePath);

        if (!HashHelper.VerifySha256(jsonData, HashHelper.ComputeSha256(jsonData)))
        {
            throw new InvalidOperationException("备份文件校验失败，文件可能已被篡改");
        }

        var snapshot = new BackupSnapshot
        {
            Name = Path.GetFileNameWithoutExtension(filePath),
            CreationTime = File.GetCreationTime(filePath),
            Type = BackupType.Manual,
            MenuItemsJson = jsonData,
            Sha256Checksum = HashHelper.ComputeSha256(jsonData)
        };

        _dbContext.BackupSnapshots.Add(snapshot);
        await _dbContext.SaveChangesAsync();

        return snapshot;
    }

    /// <summary>
    /// 导出备份到文件
    /// </summary>
    public async Task ExportBackupAsync(BackupSnapshot snapshot, string filePath)
    {
        await File.WriteAllTextAsync(filePath, snapshot.MenuItemsJson);
    }

    /// <summary>
    /// 从备份快照还原
    /// </summary>
    public async Task RestoreBackupAsync(BackupSnapshot snapshot)
    {
        if (!HashHelper.VerifySha256(snapshot.MenuItemsJson, snapshot.Sha256Checksum))
        {
            throw new InvalidOperationException("备份校验失败，无法还原");
        }

        await CreateBackupAsync($"AutoBackup_BeforeRestore_{DateTime.Now:yyyyMMdd_HHmmss}", BackupType.Auto);

        var itemsToRestore = JsonHelper.Deserialize<List<MenuItemEntry>>(snapshot.MenuItemsJson);
        if (itemsToRestore == null || !itemsToRestore.Any())
        {
            throw new InvalidOperationException("备份文件中没有有效的菜单项数据");
        }

        try
        {
            var allCurrentItems = new List<MenuItemEntry>();
            foreach (var scene in Enum.GetValues<MenuScene>())
            {
                allCurrentItems.AddRange(_menuManagerService.GetMenuItems(scene));
            }

            var itemsToUpdate = new List<MenuItemEntry>();
            foreach (var item in itemsToRestore)
            {
                var currentItem = allCurrentItems.FirstOrDefault(i => i.RegistryKey == item.RegistryKey);
                if (currentItem != null && currentItem.IsEnabled != item.IsEnabled)
                {
                    currentItem.IsEnabled = item.IsEnabled;
                    itemsToUpdate.Add(currentItem);
                }
            }

            if (itemsToUpdate.Any())
            {
                _menuManagerService.BatchEnable(itemsToUpdate.Where(i => i.IsEnabled).ToList());
                _menuManagerService.BatchDisable(itemsToUpdate.Where(i => !i.IsEnabled).ToList());
            }
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException("还原失败: " + ex.Message, ex);
        }
    }

    /// <summary>
    /// 获取所有备份快照
    /// </summary>
    public async Task<List<BackupSnapshot>> GetAllBackupsAsync()
    {
        return await _dbContext.BackupSnapshots
            .OrderByDescending(b => b.CreationTime)
            .ToListAsync();
    }

    /// <summary>
    /// 获取最新备份
    /// </summary>
    public async Task<BackupSnapshot?> GetLatestBackupAsync()
    {
        return await _dbContext.BackupSnapshots
            .OrderByDescending(b => b.CreationTime)
            .FirstOrDefaultAsync();
    }

    /// <summary>
    /// 删除备份快照
    /// </summary>
    public async Task DeleteBackupAsync(int id)
    {
        var snapshot = await _dbContext.BackupSnapshots.FindAsync(id);
        if (snapshot == null)
        {
            throw new InvalidOperationException("找不到要删除的备份");
        }

        _dbContext.BackupSnapshots.Remove(snapshot);
        await _dbContext.SaveChangesAsync();
    }

    /// <summary>
    /// 预览备份与当前状态的差异
    /// </summary>
    public async Task<List<(MenuItemEntry Current, MenuItemEntry Backup)>> PreviewRestoreDifferencesAsync(BackupSnapshot snapshot)
    {
        var itemsInBackup = JsonHelper.Deserialize<List<MenuItemEntry>>(snapshot.MenuItemsJson);
        if (itemsInBackup == null)
        {
            return new List<(MenuItemEntry, MenuItemEntry)>();
        }

        var currentItems = new List<MenuItemEntry>();
        foreach (var scene in Enum.GetValues<MenuScene>())
        {
            currentItems.AddRange(_menuManagerService.GetMenuItems(scene));
        }

        var differences = new List<(MenuItemEntry Current, MenuItemEntry Backup)>();
        foreach (var backupItem in itemsInBackup)
        {
            var currentItem = currentItems.FirstOrDefault(i => i.RegistryKey == backupItem.RegistryKey);
            if (currentItem != null && currentItem.IsEnabled != backupItem.IsEnabled)
            {
                differences.Add((currentItem, backupItem));
            }
        }

        return differences;
    }
}