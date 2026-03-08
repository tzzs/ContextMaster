using ContextMaster.UI.Helpers;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;

namespace ContextMaster.UI.Pages;

public sealed partial class SettingsPage : Page
{
    public SettingsPage()
    {
        InitializeComponent();
        Loaded += SettingsPage_Loaded;
    }

    private void SettingsPage_Loaded(object sender, RoutedEventArgs e)
    {
        UpdateAdminStatus();
    }

    private void UpdateAdminStatus()
    {
        bool isAdmin = PlatformHelper.IsRunningAsAdministrator();

        if (isAdmin)
        {
            AdminStatusText.Text = "已获得管理员权限";
            AdminStatusDetail.Text = "可以修改系统注册表";
            AdminStatusIndicator.Background = (Brush)Application.Current.Resources["SuccessBrush"];
            RestartAsAdminButton.IsEnabled = false;
            RestartAsAdminButton.Content = "已以管理员身份运行";
            RestartAsAdminButton.Background = (Brush)Application.Current.Resources["Surface2Brush"];
            RestartAsAdminButton.Foreground = (Brush)Application.Current.Resources["TextSecondaryBrush"];
        }
        else
        {
            AdminStatusText.Text = "需要管理员权限";
            AdminStatusDetail.Text = "部分功能可能受限";
            AdminStatusIndicator.Background = (Brush)Application.Current.Resources["WarningBrush"];
            RestartAsAdminButton.IsEnabled = true;
            RestartAsAdminButton.Content = "以管理员身份重启";
            RestartAsAdminButton.Background = (Brush)Application.Current.Resources["AccentPrimaryBrush"];
            RestartAsAdminButton.Foreground = (Brush)Application.Current.Resources["WhiteBrush"];
        }
    }

    private async void RestartAsAdminButton_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            PlatformHelper.RestartAsAdministrator();
        }
        catch (Exception ex)
        {
            var dialog = new ContentDialog
            {
                Title = "无法获取管理员权限",
                Content = $"重启失败：{ex.Message}",
                CloseButtonText = "确定",
                XamlRoot = this.XamlRoot
            };
            await dialog.ShowAsync();
        }
    }
}
