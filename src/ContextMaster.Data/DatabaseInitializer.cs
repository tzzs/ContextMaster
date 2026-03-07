namespace ContextMaster.Data;

/// <summary>
/// 数据库初始化器
/// </summary>
public static class DatabaseInitializer
{
    public static void Initialize(DatabaseContext context)
    {
        context.Database.EnsureCreated();
    }
}