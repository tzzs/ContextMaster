using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using ContextMaster.Core.Models.Entities;
using ContextMaster.Core.Models.Enums;

namespace ContextMaster.Core.ViewModels;

/// <summary>
/// 详情面板 ViewModel
/// </summary>
public partial class DetailViewModel : ObservableObject
{
    [ObservableProperty]
    private MenuItemEntry? _selectedItem;

    [ObservableProperty]
    private bool _isCopied = false;

    public DetailViewModel()
    {
    }

    /// <summary>
    /// 完整的注册表路径
    /// </summary>
    public string FullRegistryPath
    {
        get
        {
            if (SelectedItem == null) return string.Empty;
            return Path.Combine("HKEY_CLASSES_ROOT", SelectedItem.RegistryKey);
        }
    }

    /// <summary>
    /// 是否显示 LegacyDisable 警告
    /// </summary>
    public bool ShowLegacyDisableWarning
    {
        get
        {
            return SelectedItem != null && !SelectedItem.IsEnabled;
        }
    }

    /// <summary>
    /// 复制注册表路径到剪贴板
    /// </summary>
    [RelayCommand]
    private async Task CopyRegistryPathAsync()
    {
        if (SelectedItem == null) return;

        // 在 WinUI 3 中应该使用 Windows.ApplicationModel.DataTransfer.Clipboard
        // 这里先简单标记为已复制
        IsCopied = true;
        await Task.Delay(1500);
        IsCopied = false;
    }

    /// <summary>
    /// 在注册表编辑器中打开
    /// </summary>
    [RelayCommand]
    private async Task OpenInRegeditAsync()
    {
        if (SelectedItem == null) return;

        try
        {
            // 在 WinUI 3 中可以使用 Launcher 启动 regedit
            // 这里先保留空实现
        }
        catch (Exception ex)
        {
            // 处理异常
        }
    }

    partial void OnSelectedItemChanged(MenuItemEntry? value)
    {
        OnPropertyChanged(nameof(FullRegistryPath));
        OnPropertyChanged(nameof(ShowLegacyDisableWarning));
    }
}