# ContextMaster
## Windows 右键菜单管理工具 — 方案设计文档 v1.0

---

| 项目名称 | ContextMaster — Windows 右键菜单管理工具 |
|----------|------------------------------------------|
| 文档版本 | v1.0 |
| 创建日期 | 2026-03-07 |
| 目标平台 | Windows 11（兼容 Windows 10） |
| 设计规范 | Windows 11 Fluent Design System |
| 文档状态 | 正式版 |

---

## 目录

1. [项目概述](#1-项目概述)
2. [功能规格](#2-功能规格)
3. [技术架构](#3-技术架构)
4. [UI 设计规范](#4-ui-设计规范)
5. [主要页面说明](#5-主要页面说明)
6. [非功能需求](#6-非功能需求)
7. [开发里程碑](#7-开发里程碑)

---

## 1. 项目概述

### 1.1 背景与目标

Windows 右键菜单（Context Menu）是用户日常操作中高频使用的系统功能，随着软件安装数量的增加，右键菜单条目往往变得臃肿复杂，严重影响用户体验和操作效率。

**ContextMaster** 是一款基于 Windows 11 Fluent Design System 规范设计的右键菜单管理工具，旨在为用户提供直观、安全、高效的右键菜单管理能力。

### 1.2 核心价值

- **可视化管理** — 图形界面呈现所有右键菜单条目，无需手动编辑注册表
- **分场景管理** — 支持桌面、文件、文件夹、驱动器等多种右键场景的独立配置
- **安全可逆** — 操作记录、一键撤销、配置备份与恢复，确保系统安全
- **高效操作** — 批量启用/禁用，快速搜索过滤，大幅提升管理效率

### 1.3 目标用户

- Windows 11 日常用户，希望精简右键菜单
- IT 运维人员，需要批量管理企业设备右键菜单配置
- 开发者，需要快速启用/禁用开发相关右键工具

---

## 2. 功能规格

### 2.1 右键菜单场景支持

应用需支持以下六种右键菜单场景的独立管理：

| 场景名称 | 注册表路径 | 说明 |
|----------|-----------|------|
| 桌面右键 | `HKCR\DesktopBackground\Shell` | 右键点击桌面空白区域时显示的菜单 |
| 文件右键 | `HKCR\*\shell` | 右键点击任意文件时的菜单 |
| 文件夹右键 | `HKCR\Directory\shell` | 右键点击文件夹时的菜单 |
| 驱动器右键 | `HKCR\Drive\shell` | 右键点击磁盘驱动器时的菜单 |
| 目录背景 | `HKCR\Directory\Background\shell` | 在文件夹内空白处右键时的菜单 |
| 回收站右键 | `HKCR\CLSID\{645FF040...}` | 右键点击回收站图标时的菜单 |

### 2.2 核心功能模块

#### 2.2.1 菜单条目管理

- **列表展示** — 以卡片/列表形式展示当前场景下所有菜单项，包含图标、名称、命令、状态
- **启用/禁用** — 单条目一键切换启用/禁用状态，通过注册表 `LegacyDisable` 键值控制
- **批量操作** — 支持多选后批量启用、禁用、删除
- **搜索过滤** — 实时搜索菜单项名称和命令
- **排序** — 按名称、状态、来源程序排序

#### 2.2.2 操作记录

- 自动记录所有变更操作（启用、禁用、删除、修改）
- 记录内容：操作时间、操作类型、目标条目、变更前后值
- 支持按时间范围筛选操作记录
- 单条操作一键撤销（Undo），恢复至变更前状态
- 操作记录导出为 CSV 文件

#### 2.2.3 配置备份与恢复

- 一键导出当前全部场景配置为 `.cmbackup` 文件（JSON 格式封装）
- 支持导入备份文件，预览差异后选择性恢复
- **自动备份** — 每次批量变更前自动创建快照
- **备份历史管理** — 查看、对比、删除历史备份

#### 2.2.4 自定义条目

- 新增自定义右键菜单项：支持填写名称、图标、执行命令
- 支持子菜单嵌套（最多 2 层）
- 支持条件显示（如仅对特定扩展名文件显示）

---

## 3. 技术架构

### 3.1 技术选型

| 类别 | 选型 |
|------|------|
| UI 框架 | WinUI 3（Windows App SDK）+ Fluent Design System |
| 开发语言 | C# 12 / .NET 8 |
| 注册表访问 | `Microsoft.Win32.Registry` + 自研安全封装层 |
| 数据存储 | SQLite（操作记录）+ JSON（配置备份） |
| 权限要求 | 需要管理员权限（UAC 提权） |
| 最低系统要求 | Windows 10 21H2 及以上 |

### 3.2 系统架构分层

系统采用三层架构设计：

```
┌─────────────────────────────────────────────┐
│         表示层  Presentation Layer           │
│   WinUI 3 XAML 界面 · MVVM · 响应式绑定      │
├─────────────────────────────────────────────┤
│       业务逻辑层  Business Logic Layer        │
│  菜单解析引擎 · 操作记录服务 · 备份恢复服务   │
├─────────────────────────────────────────────┤
│        数据访问层  Data Access Layer          │
│   注册表访问封装 · SQLite ORM · 文件系统操作  │
└─────────────────────────────────────────────┘
```

### 3.3 安全设计

- 所有注册表写操作前自动创建回滚点
- 注册表操作通过事务机制确保原子性
- **敏感路径保护** — 禁止修改系统关键注册表键
- 操作前弹出确认对话框（批量删除等高风险操作）

### 3.4 注册表操作原理

```
启用条目：删除 HKCR\...\<ItemKey>\LegacyDisable 值
禁用条目：写入 HKCR\...\<ItemKey>\LegacyDisable = ""（空字符串）
```

---

## 4. UI 设计规范

### 4.1 设计语言

遵循 Windows 11 Fluent Design System 规范，使用 **Mica 材质**背景、亚克力效果、圆角控件，保证与系统视觉风格的高度一致性。

### 4.2 色彩体系

#### 品牌色 / 强调色

| Token | 色值 | 使用场景 |
|-------|------|---------|
| `color/accent/primary` | `#0067C0` | 主按钮背景、激活状态指示器、链接色 |
| `color/accent/light` | `#0078D4` | 悬浮状态（Hover） |
| `color/accent/dark` | `#005A9E` | 按下状态（Pressed） |
| `color/accent/bg` | `#EFF6FC` | 选中行背景、轻量强调背景 |

#### 语义色

| Token | 色值 | 使用场景 |
|-------|------|---------|
| `color/semantic/success` | `#0F7B0F` | 已启用状态标签、成功操作提示 |
| `color/semantic/success-bg` | `#DFF6DD` | 已启用标签背景 |
| `color/semantic/danger` | `#C42B1C` | 已禁用状态标签、删除操作、错误提示 |
| `color/semantic/danger-bg` | `#FDE7E9` | 已禁用标签背景、高危操作背景 |
| `color/semantic/warning` | `#9D5D00` | 警告文字、提示信息 |
| `color/semantic/warning-bg` | `#FFF4CE` | 警告信息背景 |

#### 中性色 / 背景

| Token | 色值 | 使用场景 |
|-------|------|---------|
| `color/bg/app` | `#F3F3F3` | 应用主背景（模拟 Mica 材质） |
| `color/bg/surface` | `#FFFFFF` | 卡片、面板、对话框背景 |
| `color/bg/surface2` | `#F9F9F9` | 次级背景、输入框 |
| `color/border/default` | `#E0E0E0` | 卡片边框、分割线 |
| `color/border/subtle` | `#EBEBEB` | 轻边框、列表行分隔 |
| `color/text/primary` | `#1A1A1A` | 主要正文、标题 |
| `color/text/secondary` | `#616161` | 次要文字、描述 |
| `color/text/tertiary` | `#8A8A8A` | 占位符、辅助标签 |

### 4.3 字体系统

| Token | 规格 | 用途 |
|-------|------|------|
| `type/title-large` | Segoe UI Variable · 18px · SemiBold | 工具栏场景标题 |
| `type/title` | Segoe UI Variable · 14px · SemiBold | 卡片标题、弹窗标题 |
| `type/body-strong` | Segoe UI Variable · 13px · Medium | 条目名称、按钮文字 |
| `type/body` | Segoe UI Variable · 13px · Regular | 正文 |
| `type/caption` | Segoe UI Variable · 11px · Regular | 辅助信息、来源程序 |
| `type/caption-strong` | Segoe UI Variable · 11px · Medium | 标签文字、状态角标 |
| `type/mono` | Consolas · 11px · Regular | 注册表路径、命令字符串 |

### 4.4 间距与圆角

**间距（4px 基准栅格）**

```
spacing/4   = 4px   标签内 padding
spacing/8   = 8px   nav-item 上下 padding
spacing/12  = 12px  卡片内 padding（垂直）
spacing/14  = 14px  卡片内 padding（水平）
spacing/16  = 16px  详情面板 padding
spacing/20  = 20px  页面内容区左右边距
```

**圆角**

```
radius/sm   = 4px   按钮、输入框、标签
radius/md   = 8px   卡片、对话框、详情面板
radius/full = 100px 状态标签（Pill）、Toggle Thumb
radius/icon = 6px   条目图标容器（36×36）
```

### 4.5 界面布局结构

```
┌──────────────────────────────────────────────────────┐
│  TitleBar (H:40px)  应用图标 · 标题 · 窗口控制按钮   │
├───────────────┬──────────────────────────────────────┤
│               │  Toolbar (H:52px)                    │
│               │  场景标题 · 搜索 · 筛选 · 操作按钮   │
│  Navigation   ├─────────────────────────┬────────────┤
│  View         │                         │  Detail    │
│  (W:220px)    │  Content Area           │  Panel     │
│               │  条目列表               │  (W:240px) │
│  场景导航     │                         │  属性详情  │
│  操作记录     │                         │  注册表路径│
│  备份管理     │                         │  操作按钮  │
│  设置         │                         │            │
├───────────────┴─────────────────────────┴────────────┤
│  StatusBar (H:26px)  权限状态 · 场景 · 统计 · 上次操作│
└──────────────────────────────────────────────────────┘
```

### 4.6 关键交互设计

| 交互 | 设计说明 |
|------|---------|
| Toggle Switch | 用于单条目启用/禁用，Track 40×20px，动画过渡 200ms |
| 撤销浮条（Undo Bar） | 操作后底部弹出，5 秒自动消失，深色背景 `#323232` |
| 批量选择 | Shift/Ctrl 多选 + 顶部批量操作工具栏动态显示 |
| 操作按钮浮现 | 条目行默认 `opacity:0`，Hover 时 `opacity:1`，过渡 150ms |
| 搜索栏 | 实时过滤，防抖 300ms |
| 详情面板注册表路径 | 复制按钮点击后图标变绿勾确认，1.5s 后复原 |

---

## 5. 主要页面说明

### 5.1 主页 — 菜单管理

核心功能页面，包含以下区域：

- **场景选择器** — 左侧 NavigationView 切换不同右键场景，Badge 显示条目数量
- **工具栏** — 搜索框、分段筛选器（全部/已启用/已禁用）、排序、批量操作、新增条目按钮
- **条目列表** — 每项显示：Checkbox、图标（36×36）、名称/命令/来源、类型标签、状态标签、Toggle Switch、悬浮操作按钮
- **右侧详情面板** — 选中条目的完整属性，含注册表路径区块（路径显示、复制按钮、LegacyDisable 提示、在 Regedit 中定位）
- **空状态** — 无条目时展示引导说明

### 5.2 操作记录页

- 时间线形式展示所有历史操作
- 每条记录：时间戳、操作类型标签（启用 / 禁用 / 删除 / 新增）、目标条目名称、操作场景
- 筛选 Chip：全部 / 启用 / 禁用 / 删除
- 单条记录一键撤销，批量清除历史
- 导出为 CSV 文件

### 5.3 备份管理页

- **备份卡片列表**（GridView，minWidth 280px）
  - 自动备份（蓝色左边框）
  - 手动备份（绿色左边框）
  - 显示：创建时间、备注描述、条目数、文件大小
- **新建备份** — 手动触发，填写备注说明
- **恢复备份** — 选择历史备份 → 预览变更差异 → 确认恢复（自动先创建当前快照）
- **导出/导入** — 支持 `.cmbackup` 文件的跨设备迁移

> ⚠️ 顶部警告条：恢复备份会覆盖当前配置，建议先手动创建快照

### 5.4 设置页

分组展示设置项（每组用圆角卡片包裹）：

**常规**
- 开机自动启动（Toggle Switch）
- 最小化到系统托盘（Toggle Switch）
- 自动检查更新（Toggle Switch）

**外观**
- 主题：跟随系统 / 浅色 / 深色（ComboBox）
- 语言：简体中文 / English / 繁體中文（ComboBox）

**备份与安全**
- 自动备份（Toggle Switch）— 批量操作前自动创建快照
- 备份保留数量（ComboBox）— 10 / 20 / 50 / 不限制
- 高危操作二次确认（Toggle Switch）

**关于**
- 版本号 + 检查更新按钮

---

## 6. 非功能需求

### 6.1 性能要求

| 指标 | 目标值 |
|------|--------|
| 应用启动时间 | < 2 秒 |
| 注册表全场景扫描 | < 3 秒 |
| UI 操作响应（视觉反馈） | < 100ms |
| 内存占用（正常使用） | < 150MB |

### 6.2 可靠性

- 注册表操作失败时自动回滚，不留脏数据
- 异常退出后重启可恢复上次状态
- 备份文件包含完整性校验（SHA-256）
- 所有写操作均有事务保护

### 6.3 可访问性

- 支持键盘完整操作（Tab / Enter / 方向键）
- 支持屏幕阅读器（Microsoft Narrator）
- 最低字体大小 12pt，支持系统字体缩放
- 色觉障碍友好配色（状态同时通过颜色 + 图标 + 文字传达）
- 满足 WCAG 2.1 AA 对比度标准

### 6.4 安全性

- 所有注册表操作需要管理员权限（UAC 提权，Manifest 配置 `requireAdministrator`）
- 受保护路径列表，防止误操作系统关键键值
- 备份文件 SHA-256 校验，防止导入被篡改的备份

---

## 7. 开发里程碑

| 阶段 | 周期 | 主要交付物 | 关键验收点 |
|------|------|-----------|-----------|
| **M1** 基础框架 | 第 1–2 周 | 项目结构 + 注册表读取 + 基础 UI 框架 | 能读取并展示各场景菜单项 |
| **M2** 核心功能 | 第 3–4 周 | 启用/禁用 + 操作记录 + 搜索过滤 | 能安全启停条目，记录操作 |
| **M3** 备份恢复 | 第 5–6 周 | 备份导出导入 + 差异预览 + 自动备份 | 完整备份恢复流程通过测试 |
| **M4** 自定义扩展 | 第 7–8 周 | 新增/编辑自定义条目 + 子菜单支持 | 自定义条目能正常显示于系统右键菜单 |
| **M5** 完善发布 | 第 9–10 周 | 性能优化 + 无障碍 + 打包安装程序 | 通过完整测试，发布 v1.0 |

---

## 附录

### A. 项目文件结构

```
ContextMaster/
├── CLAUDE.md                          # Claude Code 上下文说明
├── docs/
│   ├── prototype/
│   │   └── ContextMaster-UI原型.html  # 交互式 UI 原型
│   ├── ContextMaster-方案设计文档.md  # 本文档
│   └── ContextMaster-Figma设计规范.md # Figma 组件规范
├── src/
│   ├── ContextMaster.UI/              # WinUI 3 界面层
│   │   ├── Pages/                     # MainPage / HistoryPage / BackupPage / SettingsPage
│   │   ├── Controls/                  # MenuItemCard / DetailPanel / StatusTag / ToggleSwitch
│   │   └── Resources/                 # ColorTokens / TypographyTokens / SpacingTokens
│   ├── ContextMaster.Core/            # 业务逻辑层
│   │   ├── Models/                    # MenuItemEntry / OperationRecord / BackupSnapshot
│   │   ├── Services/                  # MenuManagerService / HistoryService / BackupService
│   │   └── ViewModels/                # MainViewModel / HistoryViewModel / BackupViewModel
│   └── ContextMaster.Data/            # 数据访问层
│       ├── RegistryService.cs         # 注册表读写封装
│       └── DatabaseContext.cs         # SQLite ORM
├── tests/
│   └── ContextMaster.Tests/
└── ContextMaster.sln
```

### B. 关键依赖包

```xml
<PackageReference Include="Microsoft.WindowsAppSDK" Version="1.5.*" />
<PackageReference Include="CommunityToolkit.Mvvm" Version="8.*" />
<PackageReference Include="CommunityToolkit.WinUI.UI.Controls" Version="8.*" />
<PackageReference Include="Microsoft.Data.Sqlite" Version="8.*" />
<PackageReference Include="System.Text.Json" Version="8.*" />
```

---

*文档结束 · ContextMaster v1.0 · 2026-03-07*