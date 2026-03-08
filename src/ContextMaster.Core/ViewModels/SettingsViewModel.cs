using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace ContextMaster.Core.ViewModels;

/// <summary>
/// 设置页面 ViewModel
/// </summary>
public partial class SettingsViewModel : ObservableObject
{
    /// <summary>
    /// 是否以管理员身份运行
    /// </summary>
    [ObservableProperty]
    private bool _isRunningAsAdministrator;

    /// <summary>
    /// 重启应用程序的委托
    /// </summary>
    public Action? RestartAction { get; set; }

    /// <summary>
    /// 检查是否以管理员身份运行的方法
    /// </summary>
    public Func<bool>? CheckAdminAction { get; set; }

    public SettingsViewModel()
    {
        // 初始化时检查权限状态
        if (CheckAdminAction != null)
        {
            IsRunningAsAdministrator = CheckAdminAction();
        }
    }

    /// <summary>
    /// 刷新权限状态
    /// </summary>
    public void RefreshAdminStatus()
    {
        if (CheckAdminAction != null)
        {
            IsRunningAsAdministrator = CheckAdminAction();
        }
    }

    /// <summary>
    /// 以管理员身份重启命令
    /// </summary>
    [RelayCommand]
    private void RestartAsAdministrator()
    {
        if (RestartAction != null)
        {
            RestartAction();
        }
    }

    /// <summary>
    /// 是否需要重启（即当前没有以管理员身份运行）
    /// </summary>
    public bool NeedRestartAsAdmin => !IsRunningAsAdministrator;
}