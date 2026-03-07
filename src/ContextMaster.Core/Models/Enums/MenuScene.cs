namespace ContextMaster.Core.Models.Enums;

/// <summary>
/// 菜单场景枚举
/// 表示右键菜单出现的上下文环境
/// </summary>
public enum MenuScene
{
    /// <summary>
    /// 桌面
    /// 右键点击桌面空白区域时显示的菜单
    /// 注册表路径：HKCR\DesktopBackground\Shell
    /// </summary>
    Desktop,

    /// <summary>
    /// 文件
    /// 右键点击任意文件时的菜单
    /// 注册表路径：HKCR\*\shell
    /// </summary>
    File,

    /// <summary>
    /// 文件夹
    /// 右键点击文件夹时的菜单
    /// 注册表路径：HKCR\Directory\shell
    /// </summary>
    Folder,

    /// <summary>
    /// 驱动器
    /// 右键点击磁盘驱动器时的菜单
    /// 注册表路径：HKCR\Drive\shell
    /// </summary>
    Drive,

    /// <summary>
    /// 目录背景
    /// 在文件夹内空白处右键时的菜单
    /// 注册表路径：HKCR\Directory\Background\shell
    /// </summary>
    DirectoryBackground,

    /// <summary>
    /// 回收站
    /// 右键点击回收站图标时的菜单
    /// 注册表路径：HKCR\CLSID\{645FF040-5081-101B-9F08-00AA002F954E}\shell
    /// </summary>
    RecycleBin
}