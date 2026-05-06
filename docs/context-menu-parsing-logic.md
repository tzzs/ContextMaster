# ContextMaster 右键菜单解析完整逻辑

## 目录
1. [架构概览](#架构概览)
2. [完整数据流](#完整数据流)
3. [核心模块详解](#核心模块详解)
4. [缓存机制](#缓存机制)
5. [启用/禁用逻辑](#启用禁用逻辑)

---

## 架构概览

ContextMaster 的右键菜单解析采用分层架构，从 UI 到底层注册表操作分为 6 个主要层次：

```
┌─────────────────────────────────────────────────────────┐
│                   Renderer Layer (UI)                    │
│              mainPage.ts - 用户交互                    │
└──────────────────────────┬──────────────────────────────┘
                           │ IPC
┌──────────────────────────▼──────────────────────────────┐
│               IPC Handlers (registry.ts)                   │
│           Electron IPC 通信层                                │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│          MenuManagerService.ts - 菜单管理服务          │
│           业务逻辑、缓存控制、事务管理                    │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│          RegistryService.ts - 注册表服务               │
│       Classic Shell + Shell Ext 解析、缓存               │
└──────────────────────────┬──────────────────────────────┘
                           │
        ┌──────────────────┴──────────────────┐
        │                                     │
┌───────▼────────┐                    ┌───────▼────────┐
│PowerShell  │                    │ShellExtName  │
│ Bridge.ts   │                    │ Resolver.ts │
│ PowerShell  │                    │ 名称解析器   │
│ 脚本执行   │                    │             │
└────────────┘                    └────────────┘
        │                                     │
┌───────▼───────────────────────────────────┐
│      Win32Shell.ts - Windows API      │
│      SHLoadIndirectString              │
└───────────────────────────────────────┘
```

---

## 完整数据流

### 1. 用户请求菜单列表的完整流程

```
用户点击场景导航
    ↓
[Renderer: loadScene(scene)
    ↓
检查 Renderer 缓存 (2分钟 TTL)
    ↓
[IPC]: REGISTRY_GET_ITEMS
    ↓
[MenuManagerService]: getMenuItems()
    ↓
检查 MenuManager 缓存 (5分钟 TTL) / in-flight 去重
    ↓
[RegistryService]: getMenuItems()
    ↓
检查 RegistryCache
    ↓
┌───────────────────────────────────────┐
│ 并行执行 PowerShell 脚本：          │
│ 1. buildGetItemsScript()            │
│    - Classic Shell 条目              │
│ 2. buildGetShellExtItemsScript()   │
│    - Shell Ext 条目                │
└───────────────────────────────────────┘
    ↓
┌───────────────────────────────────────┐
│ [PowerShellBridge]: execute()        │
│ - 信号量控制并发 (max 3)             │
│ - 执行 PowerShell.exe/pwsh.exe       │
│ - 解析 JSON 返回                   │
└───────────────────────────────────────┘
    ↓
┌───────────────────────────────────────┐
│ [ShellExtNameResolver]:          │
│ - resolveClassicName()          │
│ - resolveExtName()            │
│   (多级回退链解析显示名称)    │
└───────────────────────────────────────┘
    ↓
[RegistryService]: 清理显示名称 (移除快捷键、括号等)
    ↓
写入各级缓存
    ↓
返回 MenuItemEntry[]
    ↓
[Renderer]: 渲染列表
```

### 2. 详细步骤说明

#### 步骤 1: Renderer 发起请求 (`mainPage.ts`)

```typescript
// 用户点击导航 → loadScene(scene)
// 1. 检查 Renderer 本地缓存 (2分钟 TTL)
// 2. 缓存命中 → 直接显示 + 后台刷新 (剩余 <30s 时)
// 3. 缓存未命中 → 调用 window.api.getMenuItems(scene)
```

#### 步骤 2: IPC 通信 (`registry.ts`)

```typescript
// IPC 通道: REGISTRY_GET_ITEMS
// 包装: wrapHandler() 统一错误处理
// 调用: menuManager.getMenuItems(scene, false, 'high')
```

#### 步骤 3: MenuManagerService (`MenuManagerService.ts`)

```typescript
// 1. 检查自身缓存 (5分钟 TTL)
// 2. 检查 in-flight 请求 (避免重复请求)
// 3. 调用 registry.getMenuItems()
// 4. 写入缓存
```

#### 步骤 4: RegistryService (`RegistryService.ts`)

```typescript
// 1. 检查 RegistryCache
// 2. 构建 PowerShell 脚本
// 3. 并行执行两个脚本:
//    - Classic Shell: HKCR\<scene>\shell
//    - Shell Ext: HKCR\<scene>\shellex\ContextMenuHandlers
// 4. 解析返回的原始数据
// 5. 通过 ShellExtNameResolver 解析显示名称
// 6. 清理显示名称 (移除 &(X)、&X、括号等
// 7. 写入 RegistryCache
```

#### 步骤 5: PowerShell 脚本执行 (`PowerShellBridge.ts`)

```typescript
// 信号量: 最多 3 个并发 PowerShell 进程
// 优先级队列: high 优先级插队
// 超时: 30秒
// 提权: executeElevated() 用于写入操作
```

---

## 核心模块详解

### 1. RegistryService - 注册表服务

**文件**: `src/main/services/RegistryService.ts`

**职责**:
- 协调 Classic Shell 和 Shell Ext 条目读取
- 名称解析协调
- 缓存管理
- 启用/禁用操作
- 事务回滚

**注册表路径映射**:

```typescript
const SCENE_REG_ROOTS = {
  Desktop:            'HKCR\\DesktopBackground\\Shell',
  File:               'HKCR\\*\\shell',
  Folder:             'HKCR\\Directory\\shell',
  Drive:              'HKCR\\Drive\\shell',
  DirectoryBackground:'HKCR\\Directory\\Background\\shell',
  RecycleBin:         'HKCR\\CLSID\\{645FF040-5081-101B-9F08-00AA002F954E}\\shell',
};

const SCENE_SHELLEX_PATHS = {
  Desktop:            'HKCR\\DesktopBackground\\shellex\\ContextMenuHandlers',
  // ... 同上面一样
};
```

### 2. PowerShellBridge - PowerShell 桥接

**文件**: `src/main/services/PowerShellBridge.ts`

**职责**:
- 构建 PowerShell 脚本
- 执行脚本并解析 JSON
- 并发控制 (信号量)
- 提权执行 (UAC)

**关键脚本**:

#### buildGetItemsScript - 获取 Classic Shell 条目
```powershell
# 读取 HKCR\<scene>\shell
# 采集:
#   - subKeyName (子键名)
#   - MUIVerb (多语言动词)
#   - (默认值)
#   - LocalizedDisplayName
#   - Icon
#   - LegacyDisable (是否禁用)
#   - command (命令子键默认值)
```

#### buildGetShellExtItemsScript - 获取 Shell Ext 条目
```powershell
# 读取 HKCR\<scene>\shellex\ContextMenuHandlers
# 采集:
#   - handlerKeyName (处理程序键名
#   - defaultVal (默认值 = CLSID)
#   - CLSID\{clsid} 的:
#     - LocalizedString
#     - MUIVerb
#     - (默认值)
#     - InprocServer32 (DLL路径)
#   - DLL FileDescription (通过 .NET FileVersionInfo)
#   - sibling shell key 的 MUIVerb
```

### 3. ShellExtNameResolver - 名称解析器

**文件**: `src/main/services/ShellExtNameResolver.ts`

**职责**:
- 解析 Classic Shell 显示名称
- 解析 Shell Ext 显示名称 (多级回退链)
- 标准动词翻译 (open → 打开, edit → 编辑, etc.)
- 通用名称过滤

#### Classic Shell 名称解析优先级:
```
1. rawMUIVerb (@间接字符串 → SHLoadIndirectString
2. rawDefault (默认值)
3. rawLocalizedDisplayName (@间接字符串 → SHLoadIndirectString)
4. 标准动词翻译 (subKeyName)
5. subKeyName (兜底)
```

#### Shell Ext 名称解析优先级 (多级回退链):

```
Level 0: directName (@间接字符串
Level 1-indirect: CLSID.LocalizedString (@间接)
Level 1.3-indirect: sibling shell key MUIVerb (@间接)
Level 1.5-indirect: CLSID.MUIVerb (@间接)
Level 1.7: CommandStore 索引 (Windows 内置命令)
Level 1-plain: CLSID.LocalizedString (明文)
Level 1.3-plain: sibling shell key MUIVerb (明文)
Level 1.5-plain: CLSID.MUIVerb (明文)
Level 2: CLSID 默认值
Level 2.5: DLL FileDescription
Level 3: directName (明文)
标准动词翻译 (cleanName)
Fallback: cleanName (键名)
```

### 4. Win32Shell - Windows API 封装

**文件**: `src/main/services/Win32Shell.ts`

**职责**:
- 调用 `SHLoadIndirectString` (shlwapi.dll)
- 解析 @dll,-id 格式的间接字符串
- 解析 ms-resource: 格式
- 获取用户 UI 语言

```typescript
// 示例:
// "@shell32.dll,-51234 → "打开"
// "ms-resource:Windows.System.UserProfile.ProfileTileDisplayName" → "你的账户"
```

---

## 缓存机制

### 三级缓存架构

```
1. Renderer Cache (mainPage.ts)
   ├─ TTL: 2 分钟
   ├─ stale-while-revalidate
   └─ 剩余 <30s 时后台刷新

2. MenuManager Cache (MenuManagerService.ts)
   ├─ TTL: 5 分钟
   └─ in-flight 去重

3. Registry Cache (RegistryService.ts)
   └─ 无 TTL，显式失效
```

### 缓存失效时机

```
- 单个条目切换 → invalidateCache(scene)
- 批量操作 → invalidateAllCache()
- 应用启动 → 无缓存，首次加载
```

---

## 启用/禁用逻辑

### Classic Shell 条目

```
启用:
  - 删除 LegacyDisable 字符串值
  - 注册表键保持不变

禁用:
  - 设置 LegacyDisable 字符串值 (空字符串)
  - 注册表键保持不变
```

### Shell Ext 条目

```
启用:
  - 重命名键: "-Name" → "Name"

禁用:
  - 重命名键: "Name" → "-Name"
```

### 事务与回滚

```typescript
// 批量操作前: createRollbackPoint()
// 记录所有条目原始状态
// 失败时: rollback() → 恢复所有条目
// 成功时: commitTransaction()
```

---

## 数据结构

### MenuItemEntry - 菜单条目

```typescript
interface MenuItemEntry {
  id: number;                    // 自增 ID
  name: string;                  // 显示名称
  command: string;              // 命令 / CLSID
  iconPath: string | null;       // 图标路径
  isEnabled: boolean;           // 是否启用
  source: string;               // 来源 (Shell Ext 处理程序名
  menuScene: MenuScene;        // 所属场景
  registryKey: string;           // 注册表相对路径
  type: MenuItemType;           // System / Custom / ShellExt
  dllPath?: string | null;     // Shell Ext DLL 路径
}
```

### MenuItemType - 条目类型

```typescript
enum MenuItemType {
  System,    // 系统内置 (无 command)
  Custom,   // 自定义 (有 command)
  ShellExt, // Shell 扩展 (COM)
}
```

---

## 关键代码位置

| 功能 | 文件 | 行号 |
|------|------|------|
| Classic Shell 读取 | RegistryService.ts | 57-145 |
| Shell Ext 读取 | RegistryService.ts | 106-126 |
| 名称解析 (Classic) | ShellExtNameResolver.ts | 153-178 |
| 名称解析 (ShellExt) | ShellExtNameResolver.ts | 181-319 |
| PS 脚本构建 | PowerShellBridge.ts | 168-319 |
| IPC 处理器 | registry.ts | 9-54 |
| UI 渲染 | mainPage.ts | 123-195 |

---

## 性能优化

1. **并发控制**: PowerShellBridge 信号量 (max 3)
2. **缓存分层**: 三级缓存，TTL 递减
3. **并行读取**: Classic + ShellExt 并行执行
4. **Stale-while-revalidate**: Renderer 缓存命中后台刷新
5. **预加载**: 启动时后台 preloadAllScenes()
6. **去重**: in-flight 请求避免重复加载

---

## 错误处理

1. **单条失败不影响整体 (per-item try/catch
2. **PowerShell 失败返回空数组 []
3. **名称解析失败回退到键名
4. **事务回滚机制
5. **IPC 统一错误包装 IpcResult<T>
