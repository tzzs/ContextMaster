using System.Diagnostics;
using Windows.ApplicationModel.DataTransfer;
using Windows.System;

namespace ContextMaster.UI.Helpers;

/// <summary>
/// 平台相关的辅助功能
/// 提供访问Windows系统API的静态方法
/// </summary>
public static class PlatformHelper
{
    /// <summary>
    /// 复制文本到剪贴板
    /// </summary>
    /// <param name="text">要复制的文本</param>
    public static async Task CopyToClipboardAsync(string text)
    {
        var dataPackage = new DataPackage
        {
            RequestedOperation = DataPackageOperation.Copy
        };
        dataPackage.SetText(text);
        Clipboard.SetContent(dataPackage);
        // 在 WinUI 3 中，Clipboard 没有 FlushAsync 方法，直接返回
    }

    /// <summary>
    /// 在注册表编辑器中打开指定路径
    /// </summary>
    /// <param name="registryPath">完整的注册表路径（如：HKEY_CLASSES_ROOT\*\shell）</param>
    public static async Task OpenInRegistryEditorAsync(string registryPath)
    {
        try
        {
            // 注册表编辑器命令格式: regedit.exe /e "" "HKCR\*"
            // 或者直接打开并导航到路径
            var uri = new Uri($"ms-settings:");
            var options = new LauncherOptions
            {
                DisplayApplicationPicker = false
            };

            // 使用regedit打开指定路径的最简单方法是使用命令行参数
            var processStartInfo = new ProcessStartInfo
            {
                FileName = "regedit.exe",
                Arguments = $"/e \"\" \"{registryPath}\"",
                UseShellExecute = true,
                Verb = "open"
            };

            Process.Start(processStartInfo);
        }
        catch (Exception ex)
        {
            // 处理异常
            System.Diagnostics.Debug.WriteLine($"打开注册表编辑器失败: {ex.Message}");
        }
    }

    /// <summary>
    /// 检查当前进程是否以管理员身份运行
    /// </summary>
    public static bool IsRunningAsAdministrator()
    {
        using var identity = System.Security.Principal.WindowsIdentity.GetCurrent();
        var principal = new System.Security.Principal.WindowsPrincipal(identity);
        return principal.IsInRole(System.Security.Principal.WindowsBuiltInRole.Administrator);
    }

    /// <summary>
    /// 以管理员身份重启应用程序
    /// </summary>
    public static void RestartAsAdministrator()
    {
        var exePath = Process.GetCurrentProcess().MainModule?.FileName;
        if (exePath == null) return;

        var startInfo = new ProcessStartInfo
        {
            FileName = exePath,
            Verb = "runas",
            UseShellExecute = true
        };

        Process.Start(startInfo);
        // 退出当前进程
        Environment.Exit(0);
    }
}