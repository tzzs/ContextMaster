# ContextMaster — Windows 右键菜单管理工具

## 技术栈
- UI 框架：WinUI 3（Windows App SDK 1.5）
- 语言：C# 12 / .NET 8
- 架构：MVVM（CommunityToolkit.Mvvm）
- 注册表：Microsoft.Win32.Registry
- 数据库：SQLite（Microsoft.Data.Sqlite）
- 备份格式：JSON（System.Text.Json）

## 关键约束
- 所有注册表写操作前必须创建回滚点
- 禁用条目通过写入 LegacyDisable 字符串值实现
- 启用条目通过删除 LegacyDisable 值实现
- 需要管理员权限（UAC 已在 manifest 配置）

## 注册表路径
- 桌面右键：HKCR\DesktopBackground\Shell
- 文件右键：HKCR\*\shell
- 文件夹右键：HKCR\Directory\shell
- 驱动器右键：HKCR\Drive\shell
- 目录背景：HKCR\Directory\Background\shell
- 回收站：HKCR\CLSID\{645FF040-5081-101B-9F08-00AA002F954E}\shell

## 代码规范
- 使用 async/await 处理所有 IO 操作
- 所有 ViewModel 继承 ObservableObject
- 错误处理使用 Result<T> 模式
```

---

### 第三步：分模块向 Claude Code 下指令

推荐按从底层到上层的顺序生成代码，每次聚焦一个模块。

**① 先生成数据模型**
```
在 ContextMaster.Core 项目中创建以下数据模型：
- MenuItemEntry：表示一个右键菜单条目，包含 Id、Name、Command、IconPath、
  IsEnabled、Source、MenuScene（枚举）、RegistryKey、Type（System/Custom）
- OperationRecord：操作历史记录，包含时间戳、操作类型枚举、目标条目名称、
  注册表路径、变更前后值
- BackupSnapshot：备份快照，包含 Id、Name、创建时间、类型（Auto/Manual）、
  条目列表的 JSON 序列化数据、SHA256 校验码
- MenuScene 枚举：Desktop / File / Folder / Drive / DirectoryBackground / RecycleBin
```

**② 生成注册表访问层**
```
在 ContextMaster.Data 中创建 RegistryService 类：
- 实现 GetMenuItems(MenuScene scene) 方法，扫描对应注册表路径返回 MenuItemEntry 列表
- 实现 SetItemEnabled(MenuItemEntry item, bool enabled) 方法：
  启用时删除 LegacyDisable 值，禁用时写入空字符串 LegacyDisable 值
- 每次写操作前调用 CreateRollbackPoint() 保存当前状态
- 失败时调用 Rollback() 还原，并抛出包含详细信息的 RegistryOperationException
- 所有操作需要管理员权限，无权限时抛出 InsufficientPermissionException
```

**③ 生成业务服务层**
```
创建以下 Service 类：
- MenuManagerService：调用 RegistryService，封装启用/禁用/批量操作逻辑，
  每次操作后写入 OperationRecord 到 SQLite
- OperationHistoryService：管理操作记录的 CRUD，支持按场景/类型/日期过滤，
  支持单条撤销（根据记录中的前值执行反向操作）
- BackupService：序列化全部场景的 MenuItemEntry 列表为 JSON，
  加 SHA256 校验码后写入 .cmbackup 文件；导入时校验后反序列化并预览差异
```

**④ 生成 ViewModel 层**
```
使用 CommunityToolkit.Mvvm 创建以下 ViewModel：
- MainViewModel：持有当前 MenuScene、条目列表 ObservableCollection、
  选中条目、搜索关键词（带防抖）、筛选模式；
  命令：ToggleItemCommand、BatchDisableCommand、AddItemCommand、DeleteItemCommand
- HistoryViewModel：操作记录列表、筛选条件、UndoOperationCommand、ClearAllCommand
- BackupViewModel：备份列表、CreateBackupCommand、RestoreBackupCommand、导出导入命令
- DetailViewModel：绑定选中 MenuItemEntry，暴露完整注册表路径计算属性
```

**⑤ 生成 WinUI 3 页面**
```
基于已有 ViewModel 创建 WinUI 3 XAML 页面：
- MainPage.xaml：左侧 NavigationView + 中间 ListView（条目卡片模板）+ 
  右侧详情面板，条目模板包含图标、名称、来源、状态标签、ToggleSwitch
- HistoryPage.xaml：ListView 时间线样式，每项含类型标签、名称、时间、撤销按钮
- BackupPage.xaml：GridView 卡片布局，区分自动/手动备份
- SettingsPage.xaml：StackPanel 分组设置项，使用 ToggleSwitch 和 ComboBox
- 底部 InfoBar 组件用于显示可撤销操作提示（5秒后自动消失）

## 视觉参考
HTML 原型位于 /docs/prototype/ContextMaster-UI原型.html
开发时以此为视觉基准，所有颜色、间距、圆角均从中提取。

## 设计 Token（直接来自原型 CSS Variables）

### 颜色
--accent:        #0067C0   /* 主按钮、选中态、激活指示器 */
--accent-hover:  #005A9E
--accent-bg:     #EFF6FC   /* 选中行背景 */
--success:       #0F7B0F   /* 已启用标签 */
--success-bg:    #DFF6DD
--danger:        #C42B1C   /* 已禁用标签、删除操作 */
--danger-bg:     #FDE7E9
--warning:       #9D5D00
--warning-bg:    #FFF4CE
--bg:            #F3F3F3   /* 应用主背景（Mica） */
--surface:       #FFFFFF   /* 卡片、面板 */
--surface2:      #F9F9F9   /* 次级背景 */
--border:        #E0E0E0
--border2:       #EBEBEB
--text:          #1A1A1A
--text2:         #616161
--text3:         #8A8A8A
--radius:        8px
--radius-sm:     4px
--nav-w:         220px

### 字体
主字体：Segoe UI Variable（WinUI 3 默认）
代码/路径字体：Consolas
字号：正文 13px / 辅助 11px / 标题 18px / 大标题 24px

## 布局结构
TitleBar:   H=40px，Mica 背景，含应用图标+标题+窗口控制按钮
NavigationView (左侧):  W=220px，分两组导航项（场景 / 管理）
Main Content:   flex:1，含 Toolbar(H≈52px) + ContentArea + DetailPanel(W=240px)
StatusBar:  H=26px，accent 色背景

## 页面清单
1. MainPage        — 菜单管理（核心页，含场景切换）
2. HistoryPage     — 操作记录
3. BackupPage      — 备份管理
4. SettingsPage    — 设置

## 关键组件（含完整状态）
- MenuItemCard：Default / Hover / Selected / Disabled
- ToggleSwitch：On(#0067C0) / Off(#BDBDBD)，Thumb 14×14px，Track 40×20px
- Tag：Enabled(绿) / Disabled(红) / System(灰) / Custom(紫)
- UndoSnackbar：固定底部居中，深色背景，5s 自动消失
- DetailPanel：注册表路径块含复制按钮 + LegacyDisable 警告条
- Checkbox：16×16px，选中时 accent 填充
- Segmented Control：三段筛选（全部/已启用/已禁用）

## 技术栈
- WinUI 3 (Windows App SDK 1.5)
- C# 12 / .NET 8
- MVVM：CommunityToolkit.Mvvm
- 架构：三层（UI / Service / Data）

## 参考文档
- 完整方案设计：见 docs/ContextMaster-方案设计文档.md
- UI 原型：见 docs/prototype/ContextMaster-UI原型.html
- 设计规范：见 docs/ContextMaster-Figma设计规范.md