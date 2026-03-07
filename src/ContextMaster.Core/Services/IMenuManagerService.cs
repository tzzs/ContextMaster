using ContextMaster.Core.Models.Entities;
using ContextMaster.Core.Models.Enums;

namespace ContextMaster.Core.Services;

/// <summary>
/// 菜单管理服务接口
/// </summary>
public interface IMenuManagerService
{
    List<MenuItemEntry> GetMenuItems(MenuScene scene);
    void EnableItem(MenuItemEntry item);
    void DisableItem(MenuItemEntry item);
    void ToggleItem(MenuItemEntry item);
    void BatchEnable(List<MenuItemEntry> items);
    void BatchDisable(List<MenuItemEntry> items);
}