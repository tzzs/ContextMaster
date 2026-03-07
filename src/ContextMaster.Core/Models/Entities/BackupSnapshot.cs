using System.ComponentModel.DataAnnotations;
using ContextMaster.Core.Models.Enums;
using CommunityToolkit.Mvvm.ComponentModel;
using System.Text.Json.Serialization;

namespace ContextMaster.Core.Models.Entities;

/// <summary>
/// 表示备份快照
/// </summary>
public partial class BackupSnapshot : ObservableObject
{
    [Key]
    public int Id { get; set; }

    [Required]
    public string Name { get; set; } = string.Empty;

    public DateTime CreationTime { get; set; } = DateTime.Now;

    public BackupType Type { get; set; } = BackupType.Manual;

    [Required]
    public string MenuItemsJson { get; set; } = string.Empty;

    [Required]
    public string Sha256Checksum { get; set; } = string.Empty;

    [JsonIgnore]
    public string FormattedCreationTime => CreationTime.ToString("yyyy-MM-dd HH:mm:ss");
}

/// <summary>
/// 备份类型枚举
/// </summary>
public enum BackupType
{
    Auto,
    Manual
}