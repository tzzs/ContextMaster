using Microsoft.EntityFrameworkCore;
using ContextMaster.Core.Models.Entities;

namespace ContextMaster.Data;

/// <summary>
/// 应用程序数据库上下文
/// </summary>
public class DatabaseContext : DbContext
{
    public string DbPath { get; }

    public DbSet<MenuItemEntry> MenuItemEntries { get; set; } = null!;
    public DbSet<OperationRecord> OperationRecords { get; set; } = null!;
    public DbSet<BackupSnapshot> BackupSnapshots { get; set; } = null!;

    public DatabaseContext()
    {
        var folder = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var dbFolder = Path.Combine(folder, "ContextMaster");

        if (!Directory.Exists(dbFolder))
            Directory.CreateDirectory(dbFolder);

        DbPath = Path.Combine(dbFolder, "contextmaster.db");
    }

    protected override void OnConfiguring(DbContextOptionsBuilder options)
        => options.UseSqlite($"Data Source={DbPath}");

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // 配置 MenuItemEntry
        modelBuilder.Entity<MenuItemEntry>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedOnAdd();
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Command).IsRequired().HasMaxLength(500);
            entity.Property(e => e.IconPath).HasMaxLength(500);
            entity.Property(e => e.Source).IsRequired().HasMaxLength(200);
            entity.Property(e => e.RegistryKey).IsRequired().HasMaxLength(1000);
            entity.HasIndex(e => new { e.Name, e.MenuScene }).IsUnique();
        });

        // 配置 OperationRecord
        modelBuilder.Entity<OperationRecord>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedOnAdd();
            entity.Property(e => e.Timestamp).IsRequired();
            entity.Property(e => e.OperationType).IsRequired();
            entity.Property(e => e.TargetEntryName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.RegistryPath).IsRequired().HasMaxLength(1000);
            entity.Property(e => e.OldValue).HasMaxLength(2000);
            entity.Property(e => e.NewValue).HasMaxLength(2000);
            entity.HasIndex(e => e.Timestamp);
        });

        // 配置 BackupSnapshot
        modelBuilder.Entity<BackupSnapshot>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedOnAdd();
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.CreationTime).IsRequired();
            entity.Property(e => e.Type).IsRequired();
            entity.Property(e => e.MenuItemsJson).IsRequired();
            entity.Property(e => e.Sha256Checksum).IsRequired().HasMaxLength(64);
            entity.HasIndex(e => e.CreationTime);
        });
    }
}