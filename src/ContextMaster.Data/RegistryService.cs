using Microsoft.Win32;
using ContextMaster.Core.Models.Entities;
using ContextMaster.Core.Models.Enums;
using ContextMaster.Data.Exceptions;
using System.Security.Principal;

namespace ContextMaster.Data;

/// <summary>
/// 注册表操作服务类
/// 负责读取和修改 Windows 右键菜单相关的注册表项
/// </summary>
public class RegistryService
{
    private readonly Dictionary<MenuScene, string> _sceneRegistryPaths = new Dictionary<MenuScene, string>
    {
        { MenuScene.Desktop, @"DesktopBackground\Shell" },
        { MenuScene.File, @"*\shell" },
        { MenuScene.Folder, @"Directory\shell" },
        { MenuScene.Drive, @"Drive\shell" },
        { MenuScene.DirectoryBackground, @"Directory\Background\shell" },
        { MenuScene.RecycleBin, @"CLSID\{645FF040-5081-101B-9F08-00AA002F954E}\shell" }
    };

    private readonly Dictionary<string, bool?> _rollbackData = new Dictionary<string, bool?>();
    private bool _inTransaction = false;

    /// <summary>
    /// 检查是否有管理员权限
    /// </summary>
    public bool HasAdministratorPrivileges()
    {
        using var identity = WindowsIdentity.GetCurrent();
        var principal = new WindowsPrincipal(identity);
        return principal.IsInRole(WindowsBuiltInRole.Administrator);
    }

    /// <summary>
    /// 验证管理员权限，如果没有则抛出异常
    /// </summary>
    private void EnsureAdministratorPrivileges()
    {
        if (!HasAdministratorPrivileges())
        {
            throw new InsufficientPermissionException("此操作需要管理员权限，请以管理员身份运行应用程序");
        }
    }

    /// <summary>
    /// 创建回滚点，保存当前状态
    /// </summary>
    public void CreateRollbackPoint(IEnumerable<MenuItemEntry> items)
    {
        _rollbackData.Clear();
        foreach (var item in items)
        {
            _rollbackData[item.RegistryKey] = item.IsEnabled;
        }
        _inTransaction = true;
    }

    /// <summary>
    /// 回滚到之前保存的状态
    /// </summary>
    public void Rollback()
    {
        if (!_inTransaction)
        {
            throw new InvalidOperationException("没有活动的事务，无法回滚");
        }

        try
        {
            foreach (var kvp in _rollbackData)
            {
                if (kvp.Value.HasValue)
                {
                    SetItemEnabledInternal(kvp.Key, kvp.Value.Value);
                }
            }
        }
        finally
        {
            _inTransaction = false;
            _rollbackData.Clear();
        }
    }

    /// <summary>
    /// 结束事务，清除回滚数据
    /// </summary>
    public void CommitTransaction()
    {
        _inTransaction = false;
        _rollbackData.Clear();
    }

    /// <summary>
    /// 获取指定场景下的所有菜单项
    /// </summary>
    public List<MenuItemEntry> GetMenuItems(MenuScene scene)
    {
        var items = new List<MenuItemEntry>();
        var basePath = _sceneRegistryPaths[scene];

        try
        {
            using var rootKey = Registry.ClassesRoot.OpenSubKey(basePath, false);
            if (rootKey != null)
            {
                foreach (var subKeyName in rootKey.GetSubKeyNames())
                {
                    using var subKey = rootKey.OpenSubKey(subKeyName, false);
                    if (subKey != null)
                    {
                        var item = CreateMenuItemEntry(scene, basePath, subKey, subKeyName);
                        if (item != null)
                        {
                            items.Add(item);
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            throw new RegistryOperationException(
                $"读取注册表失败: {ex.Message}",
                basePath,
                "GetMenuItems",
                ex);
        }

        return items;
    }

    /// <summary>
    /// 启用或禁用菜单项
    /// </summary>
    public void SetItemEnabled(MenuItemEntry item, bool enabled)
    {
        EnsureAdministratorPrivileges();

        try
        {
            SetItemEnabledInternal(item.RegistryKey, enabled);
        }
        catch (Exception ex)
        {
            if (_inTransaction)
            {
                Rollback();
            }
            throw new RegistryOperationException(
                $"修改菜单项状态失败: {ex.Message}",
                item.RegistryKey,
                enabled ? "Enable" : "Disable",
                ex);
        }
    }

    /// <summary>
    /// 内部方法：设置菜单项状态
    /// </summary>
    private void SetItemEnabledInternal(string registryKey, bool enabled)
    {
        using var itemKey = Registry.ClassesRoot.OpenSubKey(registryKey, true);
        if (itemKey == null)
        {
            throw new RegistryOperationException(
                "无法找到注册表项",
                registryKey,
                "SetItemEnabled");
        }

        if (enabled)
        {
            // 启用：删除 LegacyDisable 值
            if (itemKey.GetValue("LegacyDisable") != null)
            {
                itemKey.DeleteValue("LegacyDisable");
            }
        }
        else
        {
            // 禁用：写入空字符串 LegacyDisable 值
            itemKey.SetValue("LegacyDisable", "", RegistryValueKind.String);
        }
    }

    private MenuItemEntry? CreateMenuItemEntry(MenuScene scene, string basePath, RegistryKey subKey, string subKeyName)
    {
        var name = (string?)subKey.GetValue(null) ?? subKeyName;
        var command = GetCommandValue(subKey);
        var iconPath = (string?)subKey.GetValue("Icon");
        var isEnabled = subKey.GetValue("LegacyDisable") == null;
        var registryKey = Path.Combine(basePath, subKeyName);

        return new MenuItemEntry
        {
            Name = name,
            Command = command,
            IconPath = iconPath,
            IsEnabled = isEnabled,
            Source = DetermineSource(subKey),
            MenuScene = scene,
            RegistryKey = registryKey,
            Type = DetermineType(subKeyName)
        };
    }

    private string GetCommandValue(RegistryKey subKey)
    {
        using var commandKey = subKey.OpenSubKey("command", false);
        if (commandKey != null)
        {
            return (string?)commandKey.GetValue(null) ?? string.Empty;
        }
        return string.Empty;
    }

    private string DetermineSource(RegistryKey subKey)
    {
        return string.Empty;
    }

    private MenuItemType DetermineType(string subKeyName)
    {
        return MenuItemType.System;
    }

    /// <summary>
    /// 获取场景对应的完整注册表路径
    /// </summary>
    public string GetSceneRegistryPath(MenuScene scene)
    {
        return _sceneRegistryPaths[scene];
    }
}