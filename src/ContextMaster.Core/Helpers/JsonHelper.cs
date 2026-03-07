using System.Text.Json;
using System.Text.Json.Serialization;

namespace ContextMaster.Core.Helpers;

/// <summary>
/// JSON 序列化辅助类
/// </summary>
public static class JsonHelper
{
    public static readonly JsonSerializerOptions DefaultOptions = new JsonSerializerOptions
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = true,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        Converters = { new JsonStringEnumConverter() }
    };

    /// <summary>
    /// 将对象序列化为 JSON 字符串
    /// </summary>
    public static string Serialize<T>(T obj)
    {
        return JsonSerializer.Serialize(obj, DefaultOptions);
    }

    /// <summary>
    /// 将 JSON 字符串反序列化为对象
    /// </summary>
    public static T? Deserialize<T>(string json)
    {
        return JsonSerializer.Deserialize<T>(json, DefaultOptions);
    }

    /// <summary>
    /// 格式化 JSON 字符串
    /// </summary>
    public static string PrettifyJson(string json)
    {
        var obj = JsonSerializer.Deserialize<object>(json);
        return JsonSerializer.Serialize(obj, DefaultOptions);
    }
}