using ContextMaster.Core.Models.Entities;
using ContextMaster.Core.Models.Enums;
using ContextMaster.Core.Helpers;

Console.WriteLine("=== ContextMaster 数据模型测试 ===\n");

// 测试 1: MenuScene 枚举
Console.WriteLine("测试 1: MenuScene 枚举");
Console.WriteLine("------------------------");
foreach (var scene in Enum.GetValues<MenuScene>())
{
    Console.WriteLine($"  - {scene} (值: {(int)scene})");
}
Console.WriteLine();

// 测试 2: 创建 MenuItemEntry
Console.WriteLine("测试 2: 创建 MenuItemEntry");
Console.WriteLine("-------------------------------");
var testItem = new MenuItemEntry
{
    Id = 1,
    Name = "用记事本打开",
    Command = "notepad.exe %1",
    IconPath = "notepad.exe",
    IsEnabled = true,
    Source = "Windows",
    MenuScene = MenuScene.File,
    RegistryKey = @"*\shell\OpenWithNotepad",
    Type = MenuItemType.System
};
Console.WriteLine($"  Name: {testItem.Name}");
Console.WriteLine($"  Command: {testItem.Command}");
Console.WriteLine($"  Scene: {testItem.MenuScene}");
Console.WriteLine($"  IsEnabled: {testItem.IsEnabled}");
Console.WriteLine($"  DisplayText: {testItem.DisplayText}");
Console.WriteLine();

// 测试 3: 创建 OperationRecord
Console.WriteLine("测试 3: 创建 OperationRecord");
Console.WriteLine("-----------------------------------");
var testRecord = new OperationRecord
{
    Id = 1,
    Timestamp = DateTime.Now,
    OperationType = OperationType.Disable,
    TargetEntryName = "用记事本打开",
    RegistryPath = @"HKCR\*\shell\OpenWithNotepad",
    OldValue = "true",
    NewValue = "false"
};
Console.WriteLine($"  OperationType: {testRecord.OperationType}");
Console.WriteLine($"  TargetEntryName: {testRecord.TargetEntryName}");
Console.WriteLine($"  Timestamp: {testRecord.FormattedTimestamp}");
Console.WriteLine();

// 测试 4: 创建 BackupSnapshot
Console.WriteLine("测试 4: 创建 BackupSnapshot");
Console.WriteLine("--------------------------------");
var snapshotItems = new List<MenuItemEntry> { testItem };
var jsonData = JsonHelper.Serialize(snapshotItems);
var checksum = HashHelper.ComputeSha256(jsonData);

var testSnapshot = new BackupSnapshot
{
    Id = 1,
    Name = "测试备份",
    CreationTime = DateTime.Now,
    Type = BackupType.Manual,
    MenuItemsJson = jsonData,
    Sha256Checksum = checksum
};
Console.WriteLine($"  Name: {testSnapshot.Name}");
Console.WriteLine($"  Type: {testSnapshot.Type}");
Console.WriteLine($"  CreationTime: {testSnapshot.FormattedCreationTime}");
Console.WriteLine($"  SHA256: {testSnapshot.Sha256Checksum[..16]}...");
Console.WriteLine();

// 测试 5: JSON 序列化
Console.WriteLine("测试 5: JSON 序列化");
Console.WriteLine("-----------------------");
var serialized = JsonHelper.Serialize(testItem);
Console.WriteLine($"  序列化结果 ({serialized.Length} 字符):");
Console.WriteLine($"  {serialized[..Math.Min(100, serialized.Length)]}...");
Console.WriteLine();

// 测试 6: SHA256 校验
Console.WriteLine("测试 6: SHA256 校验");
Console.WriteLine("---------------------");
var testString = "Hello ContextMaster!";
var hash = HashHelper.ComputeSha256(testString);
Console.WriteLine($"  测试字符串: '{testString}'");
Console.WriteLine($"  SHA256: {hash}");
Console.WriteLine($"  校验结果: {HashHelper.VerifySha256(testString, hash)}");
Console.WriteLine();

Console.WriteLine("=== 所有测试完成! ===");
