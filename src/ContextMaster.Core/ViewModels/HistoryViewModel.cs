using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using ContextMaster.Core.Models.Entities;
using ContextMaster.Core.Models.Enums;
using ContextMaster.Core.Services;
using System.Collections.ObjectModel;

namespace ContextMaster.Core.ViewModels;

/// <summary>
/// 操作记录 ViewModel
/// </summary>
public partial class HistoryViewModel : ObservableObject
{
    private readonly IOperationHistoryService _historyService;
    private readonly IMenuManagerService _menuManagerService;

    [ObservableProperty]
    private ObservableCollection<OperationRecord> _records = new ObservableCollection<OperationRecord>();

    [ObservableProperty]
    private OperationType? _selectedOperationType = null;

    [ObservableProperty]
    private DateTime? _startDate = null;

    [ObservableProperty]
    private DateTime? _endDate = null;

    [ObservableProperty]
    private bool _isLoading = false;

    public HistoryViewModel(IOperationHistoryService historyService, IMenuManagerService menuManagerService)
    {
        _historyService = historyService;
        _menuManagerService = menuManagerService;
    }

    /// <summary>
    /// 加载操作记录
    /// </summary>
    [RelayCommand]
    private async Task LoadRecordsAsync()
    {
        IsLoading = true;
        try
        {
            List<OperationRecord> records;

            if (SelectedOperationType.HasValue)
            {
                records = await _historyService.GetRecordsByTypeAsync(SelectedOperationType.Value);
            }
            else if (StartDate.HasValue && EndDate.HasValue)
            {
                records = await _historyService.GetRecordsByDateRangeAsync(StartDate.Value, EndDate.Value);
            }
            else
            {
                records = await _historyService.GetAllRecordsAsync();
            }

            Records.Clear();
            foreach (var record in records)
            {
                Records.Add(record);
            }
        }
        finally
        {
            IsLoading = false;
        }
    }

    /// <summary>
    /// 撤销操作
    /// </summary>
    [RelayCommand]
    private async Task UndoOperationAsync(OperationRecord? record)
    {
        if (record == null) return;

        try
        {
            await _historyService.UndoOperationAsync(record.Id, _menuManagerService);
            await LoadRecordsAsync();
        }
        catch (Exception ex)
        {
            // 处理错误
        }
    }

    /// <summary>
    /// 清除所有记录
    /// </summary>
    [RelayCommand]
    private async Task ClearAllRecordsAsync()
    {
        try
        {
            await _historyService.ClearAllRecordsAsync();
            await LoadRecordsAsync();
        }
        catch (Exception ex)
        {
            // 处理错误
        }
    }

    /// <summary>
    /// 重置筛选条件
    /// </summary>
    [RelayCommand]
    private void ResetFilters()
    {
        SelectedOperationType = null;
        StartDate = null;
        EndDate = null;
        LoadRecordsAsync().ConfigureAwait(false);
    }
}