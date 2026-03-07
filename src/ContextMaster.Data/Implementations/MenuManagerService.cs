using ContextMaster.Core.Models.Entities;
using ContextMaster.Core.Models.Enums;
using ContextMaster.Core.Services;
using ContextMaster.Data;
using ContextMaster.Data.Exceptions;

namespace ContextMaster.Data.Implementations;

/// <summary>
/// 菜单管理服务实现
/// 负责菜单条目的启用、禁用、批量操作，并记录操作历史
/// </summary>
public class MenuManagerService : IMenuManagerService
{
    private readonly RegistryService _registryService;
    private readonly IOperationHistoryService _historyService;

    public MenuManagerService(RegistryService registryService, IOperationHistoryService historyService)
    {
        _registryService = registryService;
        _historyService = historyService;
    }

    /// <summary>
    /// 获取指定场景的菜单项
    /// </summary>
    public List<MenuItemEntry> GetMenuItems(MenuScene scene)
    {
        return _registryService.GetMenuItems(scene);
    }

    /// <summary>
    /// 启用菜单项
    /// </summary>
    public void EnableItem(MenuItemEntry item)
    {
        if (item.IsEnabled)
        {
            return;
        }

        try
        {
            _registryService.SetItemEnabled(item, true);
            item.IsEnabled = true;

            _historyService.RecordOperation(
                OperationType.Enable,
                item.Name,
                item.RegistryKey,
                "false",
                "true");
        }
        catch (InsufficientPermissionException ex)
        {
            throw;
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"无法启用菜单项 '{item.Name}': {ex.Message}", ex);
        }
    }

    /// <summary>
    /// 禁用菜单项
    /// </summary>
    public void DisableItem(MenuItemEntry item)
    {
        if (!item.IsEnabled)
        {
            return;
        }

        try
        {
            _registryService.SetItemEnabled(item, false);
            item.IsEnabled = false;

            _historyService.RecordOperation(
                OperationType.Disable,
                item.Name,
                item.RegistryKey,
                "true",
                "false");
        }
        catch (InsufficientPermissionException ex)
        {
            throw;
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"无法禁用菜单项 '{item.Name}': {ex.Message}", ex);
        }
    }

    /// <summary>
    /// 切换条目的启用/禁用状态
    /// </summary>
    public void ToggleItem(MenuItemEntry item)
    {
        if (item.IsEnabled)
        {
            DisableItem(item);
        }
        else
        {
            EnableItem(item);
        }
    }

    /// <summary>
    /// 批量启用菜单项
    /// </summary>
    public void BatchEnable(List<MenuItemEntry> items)
    {
        var itemsToEnable = items.Where(i => !i.IsEnabled).ToList();
        if (!itemsToEnable.Any())
        {
            return;
        }

        try
        {
            _registryService.CreateRollbackPoint(itemsToEnable);
            foreach (var item in itemsToEnable)
            {
                EnableItem(item);
            }
            _registryService.CommitTransaction();
        }
        catch (Exception ex)
        {
            _registryService.Rollback();
            throw new InvalidOperationException("批量启用操作失败，已回滚到原始状态", ex);
        }
    }

    /// <summary>
    /// 批量禁用菜单项
    /// </summary>
    public void BatchDisable(List<MenuItemEntry> items)
    {
        var itemsToDisable = items.Where(i => i.IsEnabled).ToList();
        if (!itemsToDisable.Any())
        {
            return;
        }

        try
        {
            _registryService.CreateRollbackPoint(itemsToDisable);
            foreach (var item in itemsToDisable)
            {
                DisableItem(item);
            }
            _registryService.CommitTransaction();
        }
        catch (Exception ex)
        {
            _registryService.Rollback();
            throw new InvalidOperationException("批量禁用操作失败，已回滚到原始状态", ex);
        }
    }
}