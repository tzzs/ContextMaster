namespace ContextMaster.Data.Exceptions;

/// <summary>
/// 权限不足异常
/// 当操作需要管理员权限但当前没有时抛出
/// </summary>
public class InsufficientPermissionException : Exception
{
    public InsufficientPermissionException() : base("操作需要管理员权限")
    {
    }

    public InsufficientPermissionException(string message) : base(message)
    {
    }

    public InsufficientPermissionException(string message, Exception innerException) : base(message, innerException)
    {
    }
}