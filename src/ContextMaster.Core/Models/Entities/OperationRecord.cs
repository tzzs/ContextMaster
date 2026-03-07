using System.ComponentModel.DataAnnotations;
using ContextMaster.Core.Models.Enums;
using CommunityToolkit.Mvvm.ComponentModel;
using System.Text.Json.Serialization;

namespace ContextMaster.Core.Models.Entities;

/// <summary>
/// 表示操作历史记录
/// </summary>
public partial class OperationRecord : ObservableObject
{
    [Key]
    public int Id { get; set; }

    public DateTime Timestamp { get; set; } = DateTime.Now;

    public OperationType OperationType { get; set; }

    [Required]
    public string TargetEntryName { get; set; } = string.Empty;

    [Required]
    public string RegistryPath { get; set; } = string.Empty;

    public string? OldValue { get; set; }

    public string? NewValue { get; set; }

    [JsonIgnore]
    public string FormattedTimestamp => Timestamp.ToString("yyyy-MM-dd HH:mm:ss");
}

/// <summary>
/// 操作类型枚举
/// </summary>
public enum OperationType
{
    Create,
    Update,
    Delete,
    Enable,
    Disable,
    Backup,
    Restore
}