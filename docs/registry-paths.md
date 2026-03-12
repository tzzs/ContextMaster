# ContextMaster 注册表扫描路径文档

本文档整理了 ContextMaster 应用扫描和管理的所有 Windows 右键菜单注册表位置。

## 目录

- [概述](#概述)
- [MenuScene 枚举](#menuscene-枚举)
- [Classic Shell 路径](#classic-shell-路径)
- [Shell Extension 路径](#shell-extension-路径)
- [完整路径列表](#完整路径列表)
- [PowerShell 脚本中的使用](#powershell-脚本中的使用)
- [相关代码文件](#相关代码文件)

## 概述

ContextMaster 通过扫描 Windows 注册表中的特定位置来发现和管理右键菜单项。这些位置分为两类：

1. **Classic Shell**：传统的命令行菜单项，存储在 `HKCR\...\shell` 路径下
2. **Shell Extensions**：COM 组件实现的上下文菜单处理器，存储在 `HKCR\...\shellex\ContextMenuHandlers` 路径下

## MenuScene 枚举

应用在 `src/shared/enums.ts` 中定义了 7 种场景：

```typescript
export enum MenuScene {
  Desktop = 'Desktop',
  File = 'File',
  Folder = 'Folder',
  Drive = 'Drive',
  DirectoryBackground = 'DirectoryBackground',
  RecycleBin = 'RecycleBin',
}
```

## Classic Shell 路径

### 注册表路径定义

文件：`src/main/services/RegistryService.ts` (第 7-14 行)

```typescript
const SCENE_REGISTRY_PATHS: Record<MenuScene, string> = {
  [MenuScene.Desktop]:            'DesktopBackground\\Shell',
  [MenuScene.File]:               '*\\shell',
  [MenuScene.Folder]:             'Directory\\shell',
  [MenuScene.Drive]:              'Drive\\shell',
  [MenuScene.DirectoryBackground]:'Directory\\Background\\shell',
  [MenuScene.RecycleBin]:         'CLSID\\{645FF040-5081-101B-9F08-00AA002F954E}\\shell',
};
```

### 路径说明

| 场景 | 注册表路径 (HKCR 子路径) | 说明 |
|------|------------------------|------|
| **Desktop** | `DesktopBackground\Shell` | 桌面背景右键菜单 |
| **File** | `*\shell` | 文件右键菜单（所有文件类型） |
| **Folder** | `Directory\shell` | 文件夹右键菜单 |
| **Drive** | `Drive\shell` | 磁盘驱动器右键菜单 |
| **DirectoryBackground** | `Directory\Background\shell` | 文件夹背景（空白处）右键菜单 |
| **RecycleBin** | `CLSID\{645FF040-5081-101B-9F08-00AA002F954E}\shell` | 回收站右键菜单 |

### 完整注册表路径示例

以 `HKEY_CLASSES_ROOT` (HKCR) 为根：

```
HKEY_CLASSES_ROOT\DesktopBackground\Shell
HKEY_CLASSES_ROOT\*\shell
HKEY_CLASSES_ROOT\Directory\shell
HKEY_CLASSES_ROOT\Drive\shell
HKEY_CLASSES_ROOT\Directory\Background\shell
HKEY_CLASSES_ROOT\CLSID\{645FF040-5081-101B-9F08-00AA002F954E}\shell
```

## Shell Extension 路径

### 注册表路径定义

文件：`src/main/services/RegistryService.ts` (第 17-24 行)

```typescript
const SCENE_SHELLEX_PATHS: Record<MenuScene, string> = {
  [MenuScene.Desktop]:            'DesktopBackground\\shellex\\ContextMenuHandlers',
  [MenuScene.File]:               '*\\shellex\\ContextMenuHandlers',
  [MenuScene.Folder]:             'Directory\\shellex\\ContextMenuHandlers',
  [MenuScene.Drive]:              'Drive\\shellex\\ContextMenuHandlers',
  [MenuScene.DirectoryBackground]:'Directory\\Background\\shellex\\ContextMenuHandlers',
  [MenuScene.RecycleBin]:         'CLSID\\{645FF040-5081-101B-9F08-00AA002F954E}\\shellex\\ContextMenuHandlers',
};
```

### 路径说明

| 场景 | Shell Extension 路径 (HKCR 子路径) |
|------|-----------------------------------|
| **Desktop** | `DesktopBackground\shellex\ContextMenuHandlers` |
| **File** | `*\shellex\ContextMenuHandlers` |
| **Folder** | `Directory\shellex\ContextMenuHandlers` |
| **Drive** | `Drive\shellex\ContextMenuHandlers` |
| **DirectoryBackground** | `Directory\Background\shellex\ContextMenuHandlers` |
| **RecycleBin** | `CLSID\{645FF040-5081-101B-9F08-00AA002F954E}\shellex\ContextMenuHandlers` |

### 完整注册表路径示例

```
HKEY_CLASSES_ROOT\DesktopBackground\shellex\ContextMenuHandlers
HKEY_CLASSES_ROOT\*\shellex\ContextMenuHandlers
HKEY_CLASSES_ROOT\Directory\shellex\ContextMenuHandlers
HKEY_CLASSES_ROOT\Drive\shellex\ContextMenuHandlers
HKEY_CLASSES_ROOT\Directory\Background\shellex\ContextMenuHandlers
HKEY_CLASSES_ROOT\CLSID\{645FF040-5081-101B-9F08-00AA002F954E}\shellex\ContextMenuHandlers
```

## 完整路径列表

### 按场景分类

#### 1. Desktop（桌面背景）

| 类型 | 路径 |
|------|------|
| Classic Shell | `HKCR\DesktopBackground\Shell` |
| Shell Extension | `HKCR\DesktopBackground\shellex\ContextMenuHandlers` |

#### 2. File（文件）

| 类型 | 路径 |
|------|------|
| Classic Shell | `HKCR\*\shell` |
| Shell Extension | `HKCR\*\shellex\ContextMenuHandlers` |

#### 3. Folder（文件夹）

| 类型 | 路径 |
|------|------|
| Classic Shell | `HKCR\Directory\shell` |
| Shell Extension | `HKCR\Directory\shellex\ContextMenuHandlers` |

#### 4. Drive（磁盘驱动器）

| 类型 | 路径 |
|------|------|
| Classic Shell | `HKCR\Drive\shell` |
| Shell Extension | `HKCR\Drive\shellex\ContextMenuHandlers` |

#### 5. DirectoryBackground（文件夹背景）

| 类型 | 路径 |
|------|------|
| Classic Shell | `HKCR\Directory\Background\shell` |
| Shell Extension | `HKCR\Directory\Background\shellex\ContextMenuHandlers` |

#### 6. RecycleBin（回收站）

| 类型 | 路径 |
|------|------|
| Classic Shell | `HKCR\CLSID\{645FF040-5081-101B-9F08-00AA002F954E}\shell` |
| Shell Extension | `HKCR\CLSID\{645FF040-5081-101B-9F08-00AA002F954E}\shellex\ContextMenuHandlers` |

## PowerShell 脚本中的使用

在 PowerShell 脚本中，通过创建 PSDrive 映射来访问 HKCR：

```powershell
# 创建 HKCR PSDrive
New-PSDrive -Name HKCR -PSProvider Registry -Root HKEY_CLASSES_ROOT -ErrorAction SilentlyContinue | Out-Null

# 示例：访问 Desktop Shell 路径
$basePath = 'HKCR:\DesktopBackground\Shell'

# 示例：访问 File Shell Extension 路径  
$shellexPath = 'HKCR:\*\shellex\ContextMenuHandlers'
```

### 键值操作

#### Classic Shell - 启用/禁用逻辑
- **启用**：删除 `LegacyDisable` 值
- **禁用**：创建 `LegacyDisable` 字符串值（值为空）

```powershell
# 禁用菜单项
Set-ItemProperty -LiteralPath $keyPath -Name 'LegacyDisable' -Value '' -Type String -Force

# 启用菜单项
Remove-ItemProperty -LiteralPath $keyPath -Name 'LegacyDisable' -Force
```

#### Shell Extensions - 启用/禁用逻辑
通过重命名键名实现：
- **启用**：将 `-Name` 重命名为 `Name`
- **禁用**：将 `Name` 重命名为 `-Name`

```powershell
# 示例：禁用 Shell Extension
Rename-Item -LiteralPath 'HKCR:\...\ContextMenuHandlers\MyExt' -NewName '-MyExt' -Force

# 示例：启用 Shell Extension  
Rename-Item -LiteralPath 'HKCR:\...\ContextMenuHandlers\-MyExt' -NewName 'MyExt' -Force
```

## 相关代码文件

| 文件路径 | 说明 |
|---------|------|
| `src/shared/enums.ts` | MenuScene 枚举定义 |
| `src/main/services/RegistryService.ts` | SCENE_REGISTRY_PATHS 和 SCENE_SHELLEX_PATHS 定义 |
| `src/main/services/PowerShellBridge.ts` | PowerShell 脚本生成（buildSetEnabledScript, buildShellExtToggleScript） |
| `src/main/services/MenuManagerService.ts` | 菜单管理逻辑 |
| `src/renderer/pages/mainPage.ts` | UI 显示完整路径 |

## 注意事项

1. **权限要求**：所有注册表修改操作需要管理员权限，通过 `executeElevated()` 方法触发 UAC 提权
2. **路径格式**：
   - 代码中使用相对路径（如 `DesktopBackground\Shell`）
   - 完整路径为 `HKEY_CLASSES_ROOT\[相对路径]`
   - PowerShell 脚本中使用 `HKCR:\` 作为根路径
3. **回收站 CLSID**：`{645FF040-5081-101B-9F08-00AA002F954E}` 是 Windows 回收站的固定 CLSID
4. **错误处理**：注册表操作失败时会抛出异常，包含具体的注册表键路径信息

## 附录：完整路径速查表

### 完整 HKCR 路径

```
# Classic Shell 路径
HKEY_CLASSES_ROOT\DesktopBackground\Shell
HKEY_CLASSES_ROOT\*\shell
HKEY_CLASSES_ROOT\Directory\shell
HKEY_CLASSES_ROOT\Drive\shell
HKEY_CLASSES_ROOT\Directory\Background\shell
HKEY_CLASSES_ROOT\CLSID\{645FF040-5081-101B-9F08-00AA002F954E}\shell

# Shell Extension 路径
HKEY_CLASSES_ROOT\DesktopBackground\shellex\ContextMenuHandlers
HKEY_CLASSES_ROOT\*\shellex\ContextMenuHandlers
HKEY_CLASSES_ROOT\Directory\shellex\ContextMenuHandlers
HKEY_CLASSES_ROOT\Drive\shellex\ContextMenuHandlers
HKEY_CLASSES_ROOT\Directory\Background\shellex\ContextMenuHandlers
HKEY_CLASSES_ROOT\CLSID\{645FF040-5081-101B-9F08-00AA002F954E}\shellex\ContextMenuHandlers
```

---

*文档生成时间：2025年*
*适用版本：ContextMaster 1.0.0*
