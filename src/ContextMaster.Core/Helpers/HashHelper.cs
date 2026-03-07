using System.Security.Cryptography;
using System.Text;

namespace ContextMaster.Core.Helpers;

/// <summary>
/// 哈希计算辅助类
/// </summary>
public static class HashHelper
{
    /// <summary>
    /// 计算字符串的 SHA256 校验码
    /// </summary>
    public static string ComputeSha256(string input)
    {
        var bytes = Encoding.UTF8.GetBytes(input);
        return ComputeSha256(bytes);
    }

    /// <summary>
    /// 计算字节数组的 SHA256 校验码
    /// </summary>
    public static string ComputeSha256(byte[] data)
    {
        using (var sha256 = SHA256.Create())
        {
            var hashBytes = sha256.ComputeHash(data);

            var builder = new StringBuilder();
            foreach (var b in hashBytes)
            {
                builder.Append(b.ToString("x2"));
            }

            return builder.ToString();
        }
    }

    /// <summary>
    /// 验证字符串与校验码是否匹配
    /// </summary>
    public static bool VerifySha256(string input, string checksum)
    {
        return ComputeSha256(input).Equals(checksum, StringComparison.OrdinalIgnoreCase);
    }
}