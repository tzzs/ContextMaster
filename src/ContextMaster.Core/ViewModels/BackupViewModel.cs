using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using ContextMaster.Core.Models.Entities;
using ContextMaster.Core.Models.Enums;
using ContextMaster.Core.Services;
using System.Collections.ObjectModel;

namespace ContextMaster.Core.ViewModels;

/// <summary>
/// 备份管理 ViewModel
/// </summary>
public partial class BackupViewModel : ObservableObject
{
    private readonly IBackupService _backupService;

    [ObservableProperty]
    private ObservableCollection<BackupSnapshot> _backups = new ObservableCollection<BackupSnapshot>();

    [ObservableProperty]
    private BackupSnapshot? _selectedBackup;

    [ObservableProperty]
    private string _backupName = string.Empty;

    [ObservableProperty]
    private bool _isLoading = false;

    [ObservableProperty]
    private string _statusMessage = string.Empty;

    public BackupViewModel(IBackupService backupService)
    {
        _backupService = backupService;
        BackupName = $"Backup_{DateTime.Now:yyyyMMdd_HHmmss}";
    }

    /// <summary>
    /// 加载备份列表
    /// </summary>
    [RelayCommand]
    private async Task LoadBackupsAsync()
    {
        IsLoading = true;
        try
        {
            var backups = await _backupService.GetAllBackupsAsync();
            Backups.Clear();
            foreach (var backup in backups)
            {
                Backups.Add(backup);
            }
            StatusMessage = $"已加载 {Backups.Count} 个备份";
        }
        finally
        {
            IsLoading = false;
        }
    }

    /// <summary>
    /// 创建新备份
    /// </summary>
    [RelayCommand]
    private async Task CreateBackupAsync()
    {
        if (string.IsNullOrWhiteSpace(BackupName))
        {
            StatusMessage = "请输入备份名称";
            return;
        }

        IsLoading = true;
        try
        {
            await _backupService.CreateBackupAsync(BackupName, BackupType.Manual);
            BackupName = $"Backup_{DateTime.Now:yyyyMMdd_HHmmss}";
            await LoadBackupsAsync();
            StatusMessage = "备份创建成功";
        }
        catch (Exception ex)
        {
            StatusMessage = $"备份创建失败: {ex.Message}";
        }
        finally
        {
            IsLoading = false;
        }
    }

    /// <summary>
    /// 恢复备份
    /// </summary>
    [RelayCommand]
    private async Task RestoreBackupAsync(BackupSnapshot? backup)
    {
        if (backup == null) return;

        IsLoading = true;
        try
        {
            await _backupService.RestoreBackupAsync(backup);
            StatusMessage = "备份恢复成功";
        }
        catch (Exception ex)
        {
            StatusMessage = $"备份恢复失败: {ex.Message}";
        }
        finally
        {
            IsLoading = false;
        }
    }

    /// <summary>
    /// 删除备份
    /// </summary>
    [RelayCommand]
    private async Task DeleteBackupAsync(BackupSnapshot? backup)
    {
        if (backup == null) return;

        IsLoading = true;
        try
        {
            await _backupService.DeleteBackupAsync(backup.Id);
            await LoadBackupsAsync();
            StatusMessage = "备份已删除";
        }
        catch (Exception ex)
        {
            StatusMessage = $"删除失败: {ex.Message}";
        }
        finally
        {
            IsLoading = false;
        }
    }

    /// <summary>
    /// 导出备份
    /// </summary>
    [RelayCommand]
    private async Task ExportBackupAsync(BackupSnapshot? backup)
    {
        if (backup == null) return;

        try
        {
            var savePath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.Desktop),
                $"{backup.Name}.cmbackup");
            await _backupService.ExportBackupAsync(backup, savePath);
            StatusMessage = $"备份已导出到: {savePath}";
        }
        catch (Exception ex)
        {
            StatusMessage = $"导出失败: {ex.Message}";
        }
    }

    /// <summary>
    /// 导入备份
    /// </summary>
    [RelayCommand]
    private async Task ImportBackupAsync(string filePath)
    {
        if (!File.Exists(filePath))
        {
            StatusMessage = "文件不存在";
            return;
        }

        IsLoading = true;
        try
        {
            await _backupService.ImportBackupAsync(filePath);
            await LoadBackupsAsync();
            StatusMessage = "备份导入成功";
        }
        catch (Exception ex)
        {
            StatusMessage = $"导入失败: {ex.Message}";
        }
        finally
        {
            IsLoading = false;
        }
    }
}