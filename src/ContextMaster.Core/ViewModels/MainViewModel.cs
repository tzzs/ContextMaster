using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using ContextMaster.Core.Models.Entities;
using ContextMaster.Core.Models.Enums;
using ContextMaster.Core.Services;
using System.Collections.ObjectModel;

namespace ContextMaster.Core.ViewModels;

/// <summary>
/// 主页面 ViewModel
/// </summary>
public partial class MainViewModel : ObservableObject
{
    private readonly IMenuManagerService _menuManagerService;
    private CancellationTokenSource? _debounceCts;

    [ObservableProperty]
    private MenuScene _currentScene = MenuScene.Desktop;

    [ObservableProperty]
    private ObservableCollection<MenuItemEntry> _menuItems = new ObservableCollection<MenuItemEntry>();

    [ObservableProperty]
    private MenuItemEntry? _selectedItem;

    [ObservableProperty]
    private string _searchText = string.Empty;

    [ObservableProperty]
    private FilterMode _filterMode = FilterMode.All;

    [ObservableProperty]
    private bool _isLoading = false;

    [ObservableProperty]
    private ObservableCollection<MenuItemEntry> _selectedItems = new ObservableCollection<MenuItemEntry>();

    public MainViewModel(IMenuManagerService menuManagerService)
    {
        _menuManagerService = menuManagerService;
    }

    /// <summary>
    /// 加载菜单项
    /// </summary>
    [RelayCommand]
    private async Task LoadMenuItemsAsync()
    {
        IsLoading = true;
        try
        {
            var items = await Task.Run(() => _menuManagerService.GetMenuItems(CurrentScene));
            MenuItems.Clear();
            foreach (var item in items)
            {
                MenuItems.Add(item);
            }
        }
        finally
        {
            IsLoading = false;
        }
    }

    /// <summary>
    /// 切换条目的启用/禁用状态
    /// </summary>
    [RelayCommand]
    private async Task ToggleItemAsync(MenuItemEntry? item)
    {
        if (item == null) return;

        try
        {
            await Task.Run(() => _menuManagerService.ToggleItem(item));
            await LoadMenuItemsAsync();
        }
        catch (Exception ex)
        {
            // 处理错误
        }
    }

    /// <summary>
    /// 启用条目
    /// </summary>
    [RelayCommand]
    private async Task EnableItemAsync(MenuItemEntry? item)
    {
        if (item == null) return;

        try
        {
            await Task.Run(() => _menuManagerService.EnableItem(item));
            await LoadMenuItemsAsync();
        }
        catch (Exception ex)
        {
            // 处理错误
        }
    }

    /// <summary>
    /// 禁用条目
    /// </summary>
    [RelayCommand]
    private async Task DisableItemAsync(MenuItemEntry? item)
    {
        if (item == null) return;

        try
        {
            await Task.Run(() => _menuManagerService.DisableItem(item));
            await LoadMenuItemsAsync();
        }
        catch (Exception ex)
        {
            // 处理错误
        }
    }

    /// <summary>
    /// 批量启用选中的条目
    /// </summary>
    [RelayCommand]
    private async Task BatchEnableAsync()
    {
        if (!SelectedItems.Any()) return;

        try
        {
            await Task.Run(() => _menuManagerService.BatchEnable(SelectedItems.ToList()));
            SelectedItems.Clear();
            await LoadMenuItemsAsync();
        }
        catch (Exception ex)
        {
            // 处理错误
        }
    }

    /// <summary>
    /// 批量禁用选中的条目
    /// </summary>
    [RelayCommand]
    private async Task BatchDisableAsync()
    {
        if (!SelectedItems.Any()) return;

        try
        {
            await Task.Run(() => _menuManagerService.BatchDisable(SelectedItems.ToList()));
            SelectedItems.Clear();
            await LoadMenuItemsAsync();
        }
        catch (Exception ex)
        {
            // 处理错误
        }
    }

    /// <summary>
    /// 添加条目
    /// </summary>
    [RelayCommand]
    private async Task AddItemAsync()
    {
        // 实现添加自定义条目的逻辑
    }

    /// <summary>
    /// 删除条目
    /// </summary>
    [RelayCommand]
    private async Task DeleteItemAsync()
    {
        // 实现删除条目的逻辑
    }

    /// <summary>
    /// 搜索文本变化处理（带防抖）
    /// </summary>
    partial void OnSearchTextChanged(string value)
    {
        _debounceCts?.Cancel();
        _debounceCts = new CancellationTokenSource(TimeSpan.FromMilliseconds(300));
    }

    /// <summary>
    /// 场景变化时重新加载
    /// </summary>
    partial void OnCurrentSceneChanged(MenuScene value)
    {
        LoadMenuItemsAsync().ConfigureAwait(false);
    }

    /// <summary>
    /// 获取筛选后的菜单项
    /// </summary>
    public IEnumerable<MenuItemEntry> GetFilteredMenuItems()
    {
        var query = MenuItems.AsEnumerable();

        switch (FilterMode)
        {
            case FilterMode.Enabled:
                query = query.Where(i => i.IsEnabled);
                break;
            case FilterMode.Disabled:
                query = query.Where(i => !i.IsEnabled);
                break;
        }

        if (!string.IsNullOrWhiteSpace(SearchText))
        {
            query = query.Where(i =>
                i.Name.Contains(SearchText, StringComparison.OrdinalIgnoreCase) ||
                i.Command.Contains(SearchText, StringComparison.OrdinalIgnoreCase));
        }

        return query;
    }
}

/// <summary>
/// 筛选模式枚举
/// </summary>
public enum FilterMode
{
    All,
    Enabled,
    Disabled
}