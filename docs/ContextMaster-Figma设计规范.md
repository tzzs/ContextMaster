# ContextMaster — Figma 组件与设计规范文档 v1.0

---

| 设计系统基础 | Windows 11 Fluent Design System |
|-------------|----------------------------------|
| 主色调 | `#0067C0`（Windows Accent Blue） |
| 圆角系统 | 4px / 8px / 12px |
| 字体族 | Segoe UI Variable (Win11) / Noto Sans SC (备用) |
| 间距基准 | 4px 栅格 |
| 文档版本 | v1.0 · 2026-03-07 |

---

## 目录

1. [色彩系统](#1-色彩系统-color-system)
2. [字体系统](#2-字体系统-typography)
3. [间距与圆角](#3-间距-spacing--圆角-radius)
4. [核心组件规范](#4-核心组件规范-components)
5. [页面布局规范](#5-页面布局规范-layout)
6. [Figma 文件组织建议](#6-figma-文件组织建议)

---

## 1. 色彩系统 Color System

### 1.1 品牌色 / 强调色

| Color Token | HEX | 使用场景 |
|-------------|-----|---------|
| `color/accent/primary` | `#0067C0` | 主按钮背景、激活状态指示器、链接色 |
| `color/accent/light` | `#0078D4` | 悬浮状态（Hover） |
| `color/accent/dark` | `#005A9E` | 按下状态（Pressed） |
| `color/accent/bg` | `#EFF6FC` | 选中行背景、轻量强调背景 |

### 1.2 语义色

| Color Token | HEX | 使用场景 |
|-------------|-----|---------|
| `color/semantic/success` | `#0F7B0F` | 已启用状态标签、成功操作提示 |
| `color/semantic/success-bg` | `#DFF6DD` | 已启用标签背景 |
| `color/semantic/danger` | `#C42B1C` | 已禁用状态标签、删除操作、错误提示 |
| `color/semantic/danger-bg` | `#FDE7E9` | 已禁用标签背景、高危操作背景 |
| `color/semantic/warning` | `#9D5D00` | 警告文字、提示信息 |
| `color/semantic/warning-bg` | `#FFF4CE` | 警告信息背景 |
| `color/semantic/info` | `#0067C0` | 信息提示（复用主色） |

### 1.3 中性色 / 背景

| Color Token | HEX | 使用场景 |
|-------------|-----|---------|
| `color/bg/app` | `#F3F3F3` | 应用主背景（模拟 Mica 材质） |
| `color/bg/surface` | `#FFFFFF` | 卡片、面板、对话框背景 |
| `color/bg/surface2` | `#F9F9F9` | 次级背景、输入框、设置行交替色 |
| `color/border/default` | `#E0E0E0` | 卡片边框、分割线 |
| `color/border/subtle` | `#EBEBEB` | 轻边框、列表行分隔 |
| `color/text/primary` | `#1A1A1A` | 主要正文、标题 |
| `color/text/secondary` | `#616161` | 次要文字、描述 |
| `color/text/tertiary` | `#8A8A8A` | 占位符、辅助标签 |

> **Figma 操作建议**：在 Figma Variables 面板中按 `Brand / Semantic / Neutral` 三个 Collection 分组创建，并开启 Light / Dark 模式切换，为深色主题预留扩展空间。

---

## 2. 字体系统 Typography

### 2.1 字体族

- **主字体**：`Segoe UI Variable`（Windows 11 原生，Figma 中使用 `Segoe UI` 作为替代）
- **中文字体**：`Microsoft YaHei UI`（UI 版本，hinting 更优）
- **等宽字体**：`Consolas`（注册表路径、命令字符串专用）

### 2.2 字号层级

| Token | 字体 / 字号 | 字重 | 用途 |
|-------|------------|------|------|
| `type/display` | Segoe UI Variable / 24px | SemiBold 600 | 页面标题、空状态大标题 |
| `type/title-large` | Segoe UI Variable / 18px | SemiBold 600 | 工具栏场景标题 |
| `type/title` | Segoe UI Variable / 14px | SemiBold 600 | 卡片标题、弹窗标题 |
| `type/body-strong` | Segoe UI Variable / 13px | Medium 500 | 条目名称（强调）、按钮文字 |
| `type/body` | Segoe UI Variable / 13px | Regular 400 | 正文、条目名称 |
| `type/caption-strong` | Segoe UI Variable / 11px | Medium 500 | 标签文字、状态角标 |
| `type/caption` | Segoe UI Variable / 11px | Regular 400 | 辅助信息、来源程序、注册表路径标签 |
| `type/mono` | Consolas / 11px | Regular 400 | 注册表路径、命令字符串、代码 |

> **Figma 操作建议**：在 Text Styles 面板中按上表逐一创建，命名格式与 Token 保持一致，方便与代码侧 Token 映射。

---

## 3. 间距 Spacing & 圆角 Radius

### 3.1 间距系统（4px 基准栅格）

| Token | 值 | 使用场景 |
|-------|----|---------|
| `spacing/2` | `2px` | 图标与文字间微间距 |
| `spacing/4` | `4px` | 标签内 padding、角标间距 |
| `spacing/6` | `6px` | 按钮内图标间距、条目行内元素间距 |
| `spacing/8` | `8px` | 内容块基础 padding、nav-item 上下 padding |
| `spacing/12` | `12px` | 卡片内 padding（垂直）、工具栏间距 |
| `spacing/14` | `14px` | 卡片内 padding（水平） |
| `spacing/16` | `16px` | 内容区水平边距、详情面板 padding |
| `spacing/20` | `20px` | 页面内容区左右边距 |
| `spacing/24` | `24px` | 区块间距、分组间距 |
| `spacing/32` | `32px` | 大区块间距 |

### 3.2 圆角系统

| Token | 值 | 使用组件 |
|-------|----|---------|
| `radius/sm` | `4px` | 按钮（Secondary）、输入框、Tag、图标按钮 |
| `radius/md` | `8px` | 卡片（Card）、对话框、工具栏下拉菜单、详情面板 |
| `radius/lg` | `12px` | 通知卡片、大型弹窗 |
| `radius/full` | `100px` | 状态标签（Tag pill）、徽标（Badge）、Toggle Thumb |
| `radius/icon` | `6px` | 条目图标容器（36×36） |

> **Figma 操作建议**：在 Variables 面板 Number Collection 中创建 `Spacing` 和 `Radius` 两个分组，将上表数值逐一录入，绑定到组件的 Corner Radius 和 Padding 属性。

---

## 4. 核心组件规范 Components

### 4.1 按钮 Button

| 变体 Variant | 尺寸 / 样式 | 交互状态 | 使用场景 |
|-------------|------------|---------|---------|
| `Primary` | H:32px · Pad:0 14px · `radius/sm` · bg:`accent/primary` · color:`#FFF` · `type/body-strong` | Default / Hover(`accent/light`) / Pressed(`accent/dark`) / Disabled(opacity 40%) | 主操作：新增条目、确认恢复备份 |
| `Secondary` | H:32px · Pad:0 14px · `radius/sm` · bg:`surface` · border:1px `border/default` · color:`text/primary` | Default / Hover(bg:`surface2`) / Pressed(bg:`#EBEBEB`) / Disabled | 次要操作：导出、编辑、取消 |
| `Ghost` | H:32px · Pad:0 12px · `radius/sm` · bg:`transparent` · color:`text/secondary` | Default / Hover(bg:`rgba(0,0,0,6%)`) / Pressed | 工具栏轻操作、导航辅助按钮 |
| `Danger` | H:32px · Pad:0 14px · `radius/sm` · bg:`danger-bg` · border:1px `rgba(danger,20%)` · color:`danger` | Default / Hover(bg:`danger` · color:`#FFF`) / Pressed | 删除操作、高危批量操作 |
| `IconButton` | W:28px H:28px · `radius/sm` · bg:`transparent` · color:`text/tertiary` | Default / Hover(bg:`rgba(0,0,0,7%)`) / Danger-Hover(bg:`danger-bg` · color:`danger`) | 条目行悬浮操作（编辑、删除） |

**Figma 组件结构建议**：

```
Button
  ├── Primary
  │     ├── Default
  │     ├── Hover
  │     ├── Pressed
  │     └── Disabled
  ├── Secondary / Ghost / Danger（同上层级）
  └── IconButton
        ├── Default
        ├── Hover
        └── Danger-Hover
```

---

### 4.2 Toggle Switch（启用/禁用开关）

复用 Windows 11 ToggleSwitch 控件视觉规范，在 Figma 中建立 **2×2 变体组件**（On/Off × Enabled/Disabled）。

| 属性 | 值 | 说明 |
|------|-----|------|
| Track W×H | `40px × 20px` | |
| Track Radius | `radius/full`（10px） | |
| Track (On) | fill: `accent/primary` | 已启用状态 |
| Track (Off) | fill: `#BDBDBD` | 已禁用状态 |
| Thumb W×H | `14px × 14px` | |
| Thumb Radius | `radius/full` | |
| Thumb fill | `#FFFFFF` | shadow: `0 1px 3px rgba(0,0,0,0.20)` |
| Thumb (On) X | `23px`（left） | 过渡: left 200ms ease |
| Thumb (Off) X | `3px`（left） | 过渡: left 200ms ease |
| 整体 Padding | `3px`（上下） | |

---

### 4.3 条目卡片 MenuItemCard

列表页核心复用单元，建立包含所有变体的 Figma 组件（**状态 × 类型 × 选中**）。

**结构（从左到右）：**

```
┌──────────────────────────────────────────────────────────────────┐
│ [□] [Icon 36×36] [名称 / 命令行 / 来源]  [Tag类型][Tag状态][Toggle] [···] │
└──────────────────────────────────────────────────────────────────┘
```

| 属性 | 值 | 说明 |
|------|-----|------|
| 高度 | 最小 60px（自适应） | 内边距 `spacing/12` `spacing/14` |
| 背景 | `color/bg/surface` | |
| 边框 | `1px color/border/subtle · radius/md` | |
| 悬浮态 | border: `color/border/default` · shadow: `0 2px 8px rgba(0,0,0,8%)` | |
| 选中态 | border: `accent/primary` × 2px stroke · bg: `accent/bg` | |
| 禁用行 Opacity | `60%` | 整体透明度降低 |
| 图标区 | `36×36px · radius/icon · bg:surface2 · border:subtle` | |
| 名称文字 | `type/body-strong · color/text/primary` | 溢出省略 |
| 命令文字 | `type/mono · color/text/tertiary` | 溢出省略 |
| 来源文字 | `type/caption · color/text/tertiary` | |
| 状态 Tag | `H:20px · radius/full` · 参见 Tag 规范 | |
| 操作按钮区 | 默认 `opacity:0` · 悬浮 `opacity:1` · 过渡 150ms | |

**Figma 变体矩阵：**

```
MenuItemCard
  ├── State=Default   × Type=System  × Selected=False
  ├── State=Default   × Type=System  × Selected=True
  ├── State=Default   × Type=Custom  × Selected=False
  ├── State=Hover     × ...
  ├── State=Disabled  × ...
  └── ...（共 12 个变体）
```

---

### 4.4 状态标签 Tag

| 变体 | 样式 | 使用场景 |
|------|------|---------|
| `Enabled` | bg:`success-bg` · color:`success` · `type/caption-strong` | 已启用状态 |
| `Disabled` | bg:`danger-bg` · color:`danger` · `type/caption-strong` | 已禁用状态 |
| `System` | bg:`#EEF0F3` · color:`#505050` · `type/caption-strong` | 系统内置条目 |
| `Custom` | bg:`#F3EFFE` · color:`#7B4BBA` · `type/caption-strong` | 用户自定义条目 |
| `Auto` | bg:`accent-bg` · color:`accent` · `type/caption-strong` | 自动备份标识 |
| `Manual` | bg:`success-bg` · color:`success` · `type/caption-strong` | 手动备份标识 |

**公共属性：** H:20px · Pad: 2px 8px · `radius/full`

---

### 4.5 撤销浮条 Undo Snackbar

| 属性 | 值 | 说明 |
|------|-----|------|
| 宽度 | 最大 480px · 自适应内容 | |
| 高度 | `40px` | |
| 背景 | `#323232` | 深色浮层，与浅色背景形成对比 |
| 圆角 | `radius/md` | |
| 阴影 | `0 4px 16px rgba(0,0,0,12%)` | |
| 位置 | fixed · bottom `32px` · 水平居中 | |
| 出现动画 | translateY `+80px → 0` + opacity `0 → 1` · 300ms `cubic-bezier(.4,0,.2,1)` | |
| 消失时机 | 操作后 5 秒自动消失，或用户点击撤销 / 关闭 | |
| 撤销按钮 | color:`#4FC3F7` · `type/body-strong` | |
| 关闭按钮 | color:`rgba(255,255,255,60%)` · 16px | |

---

### 4.6 注册表路径区块 RegPathBlock（详情面板专用）

条目详情面板内注册表信息展示区，包含路径显示 + 复制按钮 + 禁用提示。

| 元素 | 规格 | 说明 |
|------|------|------|
| Section Label | `type/caption-strong` · color:`accent` · uppercase · letter-spacing:0.5px | 带注册表图标前缀 |
| 路径容器 | bg:`surface2` · border:`subtle` · `radius/sm` · padding:`6px 8px` | |
| 路径文字 | `type/mono` · color:`text/primary` · word-break:break-all · line-height:1.6 | |
| 复制按钮 | `20×20px` · 绝对定位右上角 · 悬浮显示 accent 色 | 点击后图标变绿勾，1.5s 复原 |
| 命令子键路径 | 同上，color:`text/tertiary` 区分层级 | |
| LegacyDisable 提示 | bg:`danger-bg` · border:`danger(20%)` · `radius/sm` · padding:`7px 9px` | 仅禁用态 Visible |
| Regedit 按钮 | H:`26px` · border:`subtle` · `radius/sm` · `type/caption` · 悬浮 accent 主题 | |

---

### 4.7 Checkbox

| 属性 | 值 |
|------|-----|
| 尺寸 | `16×16px` |
| 边框 | `1.5px color/border/default` · `radius/sm`（3px） |
| 选中背景 | `accent/primary` |
| 选中图标 | 白色勾 `10×10px` |
| 过渡 | all 120ms |

---

### 4.8 筛选 Chip（Segmented / Filter）

| 状态 | 样式 |
|------|------|
| Default | bg:`surface` · border:1px `border/default` · color:`text/secondary` · `radius/full` · H:26px · Pad:3px 10px |
| Active | bg:`accent/primary` · border:`accent/primary` · color:`#FFFFFF` |
| Hover（非 Active） | border:`accent/primary` · color:`accent/primary` |

---

## 5. 页面布局规范 Layout

### 5.1 整体布局结构

```
┌──────────────────────────────────────────────────────────────────────┐
│  TitleBar  H:40px  bg:rgba(243,243,243,85%)  backdrop-blur:20px      │
├──────────────────┬───────────────────────────────────────────────────┤
│                  │  Toolbar  H:52px  border-bottom:subtle            │
│  NavigationView  ├───────────────────────────────────┬───────────────┤
│  W:220px         │                                   │  DetailPanel  │
│  bg:rgba(248,    │  Content Area                     │  W:240px      │
│  248,248,80%)    │  padding: spacing/16 spacing/20   │  bg:surface   │
│  backdrop-       │                                   │  border-left: │
│  blur:20px       │                                   │  subtle       │
│                  │                                   │               │
├──────────────────┴───────────────────────────────────┴───────────────┤
│  StatusBar  H:26px  bg:accent/primary  color:rgba(255,255,255,90%)   │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.2 各区域规格

| 区域 | 尺寸 | 说明 |
|------|------|------|
| 应用窗口 | 最小 `960×600px` | 可缩放，响应式适配 |
| 标题栏 | H:`40px` · bg:`rgba(243,243,243,85%)` · blur:`20px` | 拖拽区 + Windows 控制按钮（46×32px × 3） |
| 左侧导航 | W:`220px` · bg:`rgba(248,248,248,80%)` · blur:`20px` | NavigationView 模式 |
| 主内容区 | flex:1 · 内边距 `spacing/16 spacing/20` | |
| 工具栏 | H:`52px` · bg:`rgba(243,243,243,90%)` · border-bottom:`subtle` | 标题 + 操作区 |
| 右侧详情面板 | W:`240px` · bg:`surface` · border-left:`subtle` | 选中条目属性 |
| 底部状态栏 | H:`26px` · bg:`accent/primary` · color:`rgba(255,255,255,90%)` | `type/caption` |

### 5.3 NavigationView 内部结构

```
NavigationView (W:220px)
  ├── 顶部搜索框 (H:34px, margin:12px 8px 8px)
  │     ├── 搜索图标 (14×14px, color:text/tertiary)
  │     └── 输入框 (border:subtle, radius:md, focus→accent border)
  │
  ├── Section Label "菜单场景" (font:type/caption-strong, uppercase)
  ├── NavItem × 6 (H:32px, padding:7px 12px, gap:10px)
  │     ├── 图标 (16×16px, fill:currentColor)
  │     ├── 文字 (type/body)
  │     └── Badge (bg:accent, color:#FFF, radius:full, font:10px)
  │
  ├── Divider (1px border/subtle, margin:8px 16px)
  │
  ├── Section Label "管理"
  ├── NavItem × 3（操作记录 / 备份管理 / 设置）
  │
  └── 底部状态区 (margin-top:auto, border-top:subtle, padding:8px)
        ├── 权限状态点 (8×8px, color:#0F7B0F)
        └── 版本号 (type/caption, color:text/tertiary)
```

**NavItem 激活态：**
- bg: `accent/bg`
- color: `accent/primary`
- font-weight: `500`
- 左侧激活指示线：`3×18px`，bg:`accent/primary`，`radius: 0 2px 2px 0`，绝对定位 left:-1px

---

## 6. Figma 文件组织建议

### 6.1 页面结构（推荐）

```
ContextMaster.fig
  ├── 🎨  Design System      色板 / 字体 / 图标 / 基础元素
  ├── 🧩  Components         所有原子 & 分子级组件（含 Variants）
  ├── 🖥  Screens / Main      菜单管理主页（各场景 Frame）
  ├── 📋  Screens / History   操作记录页
  ├── 💾  Screens / Backup    备份管理页
  ├── ⚙️  Screens / Settings  设置页
  ├── 🔲  Screens / Dialogs   对话框 / 确认弹窗 / 撤销浮条
  └── 🔀  Prototype Flow      交互原型连线（用于演示）
```

### 6.2 组件命名规范

**原子组件（Atoms）**

```
Button/Primary
Button/Secondary
Button/Ghost
Button/Danger
Button/IconButton
Tag/Enabled
Tag/Disabled
Tag/System
Tag/Custom
Tag/Auto
Tag/Manual
Checkbox/Unchecked
Checkbox/Checked
ToggleSwitch/On
ToggleSwitch/Off
Chip/Default
Chip/Active
```

**分子组件（Molecules）**

```
MenuItemCard/Default
MenuItemCard/Hover
MenuItemCard/Selected
MenuItemCard/Disabled
RegPathBlock/Enabled
RegPathBlock/Disabled
HistoryItem/Enable
HistoryItem/Disable
HistoryItem/Delete
HistoryItem/Add
BackupCard/Auto
BackupCard/Manual
UndoSnackbar
```

**有机体（Organisms）**

```
DetailPanel
NavigationView
Toolbar/Main
Toolbar/History
Toolbar/Backup
StatusBar
```

**页面（Pages）**

```
Page/MenuManager
Page/History
Page/Backup
Page/Settings
```

### 6.3 Variables 配置建议

**Color Collection**

```
Brand/
  accent-primary:   #0067C0
  accent-light:     #0078D4
  accent-dark:      #005A9E
  accent-bg:        #EFF6FC

Semantic/
  success:          #0F7B0F
  success-bg:       #DFF6DD
  danger:           #C42B1C
  danger-bg:        #FDE7E9
  warning:          #9D5D00
  warning-bg:       #FFF4CE

Neutral/
  bg-app:           #F3F3F3
  bg-surface:       #FFFFFF
  bg-surface2:      #F9F9F9
  border-default:   #E0E0E0
  border-subtle:    #EBEBEB
  text-primary:     #1A1A1A
  text-secondary:   #616161
  text-tertiary:    #8A8A8A
```

**Number Collection**

```
Spacing/
  2: 2    4: 4    6: 6    8: 8
  12: 12  14: 14  16: 16  20: 20
  24: 24  32: 32

Radius/
  sm: 4   md: 8   lg: 12  icon: 6  full: 100
```

**模式切换（Modes）**

- 创建 `Light` / `Dark` 两个 Mode
- Dark Mode 下各色值参考 Windows 11 深色主题对应值
- 所有组件使用 Variable 绑定，切换 Mode 即可全局预览深色效果

### 6.4 图标规范

- 使用 **Fluent System Icons**（Microsoft 官方 Figma 社区资源）
- 尺寸：`16×16px`（导航图标）/ `14×14px`（按钮内图标）/ `13×13px`（操作按钮）
- 颜色：通过 `fill: currentColor` 继承父元素颜色，绑定 Color Variable

---

## 附录：组件与 HTML 原型对照表

| Figma 组件 | HTML 原型 CSS 类 | 核心样式参考 |
|-----------|----------------|------------|
| `MenuItemCard` | `.item-card` | `border-radius:8px · padding:12px 14px` |
| `MenuItemCard/Selected` | `.item-card.selected` | `border:accent 2px · bg:accent-bg` |
| `MenuItemCard/Disabled` | `.item-card.disabled-row` | `opacity:0.6` |
| `Tag/Enabled` | `.tag.tag-enabled` | `bg:#DFF6DD · color:#0F7B0F` |
| `Tag/Disabled` | `.tag.tag-disabled` | `bg:#FDE7E9 · color:#C42B1C` |
| `ToggleSwitch/On` | `.toggle-switch.on` | `bg:#0067C0` |
| `ToggleSwitch/Off` | `.toggle-switch.off` | `bg:#BDBDBD` |
| `UndoSnackbar` | `.undo-bar` | `bg:#323232 · bottom:32px` |
| `RegPathBlock` | `showDetail()` 内 HTML | `mono font · copy button · danger warning` |
| `NavItem/Active` | `.nav-item.active` | `bg:accent-bg · left 3px indicator` |
| `StatusBar` | `.statusbar` | `bg:accent · H:26px` |
| `Chip/Active` | `.chip.active` | `bg:accent · color:#FFF` |

---

*文档结束 · ContextMaster Figma 设计规范 v1.0 · 2026-03-07*