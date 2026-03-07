namespace ContextMaster.Data.Exceptions;

/// <summary>
/// 注册表操作异常
/// 当注册表操作失败时抛出，包含详细的错误信息
/// </summary>
public class RegistryOperationException : Exception
{
    public string RegistryPath { get; }
    public string OperationType { get; }

    public RegistryOperationException(string message, string registryPath, string operationType)
        : base(message)
    {
        RegistryPath = registryPath;
        OperationType = operationType;
    }

    public RegistryOperationException(string message, string registryPath, string operationType, Exception innerException)
        : base(message, innerException)
    {
        RegistryPath = registryPath;
        OperationType = operationType;
    }
}