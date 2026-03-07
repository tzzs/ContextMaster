using System.ComponentModel.DataAnnotations;
using ContextMaster.Core.Models.Enums;
using CommunityToolkit.Mvvm.ComponentModel;
using System.Text.Json.Serialization;

namespace ContextMaster.Core.Models.Entities;

/// <summary>
/// 表示右键菜单条目配置
/// </summary>
public partial class MenuItemEntry : ObservableObject
{
    [Key]
    public int Id { get; set; }

    [Required]
    public string Name { get; set; } = string.Empty;

    [Required]
    public string Command { get; set; } = string.Empty;

    public string? IconPath { get; set; }

    public bool IsEnabled { get; set; } = true;

    [Required]
    public string Source { get; set; } = string.Empty;

    public MenuScene MenuScene { get; set; }

    [Required]
    public string RegistryKey { get; set; } = string.Empty;

    public MenuItemType Type { get; set; } = MenuItemType.Custom;

    [JsonIgnore]
    public string DisplayText => $"{Name} ({MenuScene})";
}

/// <summary>
/// 菜单条目类型枚举
/// </summary>
public enum MenuItemType
{
    System,
    Custom
}