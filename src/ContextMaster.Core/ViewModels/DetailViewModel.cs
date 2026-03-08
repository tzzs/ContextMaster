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

    /// <summary>
    /// 复制文本到剪贴板的委托
    /// </summary>
    public Func<string, Task>? CopyToClipboardAction { get; set; }

    /// <summary>
    /// 在注册表编辑器中打开的委托
    /// </summary>
    public Func<string, Task>? OpenInRegistryAction { get; set; }

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
        if (SelectedItem == null || CopyToClipboardAction == null) return;

        try
        {
            await CopyToClipboardAction(FullRegistryPath);
            IsCopied = true;
            await Task.Delay(1500);
            IsCopied = false;
        }
        catch (Exception ex)
        {
            // 处理异常
            System.Diagnostics.Debug.WriteLine($"复制到剪贴板失败: {ex.Message}");
        }
    }

    /// <summary>
    /// 在注册表编辑器中打开
    /// </summary>
    [RelayCommand]
    private async Task OpenInRegeditAsync()
    {
        if (SelectedItem == null || OpenInRegistryAction == null) return;

        try
        {
            await OpenInRegistryAction(FullRegistryPath);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"打开注册表编辑器失败: {ex.Message}");
        }
    }

    partial void OnSelectedItemChanged(MenuItemEntry? value)
    {
        OnPropertyChanged(nameof(FullRegistryPath));
        OnPropertyChanged(nameof(ShowLegacyDisableWarning));
    }
}