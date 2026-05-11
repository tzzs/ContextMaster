# ContextMaster — Windows 右键菜单管理工具

## 技术栈
- 框架：Electron 33.x + electron-forge + Vite
- 语言：TypeScript（严格模式）
- 包管理器：pnpm
- 数据库：better-sqlite3（同步 API，WAL 模式）
- 注册表访问：PowerShell 桥接（读写 HKCR）
- Win32 FFI：koffi（调用 `shlwapi.dll` / `kernel32.dll`）
- IPC：contextBridge + 类型化 IPC 频道

## 常用命令

```bash
pnpm install            # 安装依赖
pnpm start              # 开发模式（需管理员身份运行）
pnpm run make           # 打包 Squirrel 安装包 → out/
pnpm run lint           # ESLint 检查
pnpm run test:unit      # 运行所有单元测试
pnpm run test:unit -- -t "test name"   # 运行单个测试
pnpm run test:unit:watch  # watch 模式
pnpm run test:unit:ui     # Vitest UI
pnpm run test:coverage    # 单元测试 + 覆盖率
pnpm run test:e2e         # Playwright E2E 测试
pnpm run test:e2e:ui      # Playwright UI 模式
```

> better-sqlite3 为 native 模块，切换 Node/Electron 版本后需 `npx electron-rebuild`

## 架构分层

```
src/
├── shared/          → 类型/枚举/IPC 频道常量（主+渲染进程共用）
├── main/
│   ├── services/    → PowerShellBridge → RegistryService → MenuManagerService
│   │                  ShellExtNameResolver（名称解析）
│   │                  Win32Shell（koffi FFI：SHLoadIndirectString）
│   │                  SystemInfoService（OS/菜单风格检测）
│   │                  OperationHistoryService → BackupService
│   ├── data/        → Database.ts（better-sqlite3）+ Repository 层
│   └── ipc/         → 四个 handler 文件（registry/history/backup/system）
├── preload/         → contextBridge 暴露 window.api
└── renderer/        → index.html + main.ts + 四个 page 模块
```

## 服务组合根

`src/main/index.ts:initServices()` 中手动 DI 构建服务链：

```
Win32Shell（koffi）
  └─→ ShellExtNameResolver（名称解析，四级级联策略）
        ↓
Database
  ├── OperationRecordRepo ──→ OperationHistoryService ──┐
  └── BackupSnapshotRepo ──→ BackupService              │
                                  ↓                      │
PowerShellBridge → SystemInfoService                    │
PowerShellBridge → RegistryService → MenuManagerService ←┘
```

启动顺序：`initLogger()` → `initServices()` → `createWindow()`

## 关键约束

- 所有注册表写操作前必须创建回滚点（`RegistryService.createRollbackPoint`）
- **Classic Shell** 条目：通过写入 `LegacyDisable` 字符串值禁用，删除该值启用
- **Shell 扩展（COM）** 条目：通过重命名键名（加/去 `-` 前缀）实现启用/禁用
- Shell 扩展条目类型通过 `registryKey` 是否包含 `shellex\ContextMenuHandlers` 来判定
- PowerShell 执行有两种模式：
  - `execute()` — 直接执行（管理员身份下使用）
  - `executeElevated()` — 通过临时 `.ps1` 文件 + `Start-Process -Verb RunAs` 提权，结果写临时 JSON 文件
- `wrapHandler` 统一捕获异常返回 `IpcResult<T>`，IPC 边界类型由 preload 层保证
- renderer page 模块通过 `(window as any)._mainPage` 等挂载函数供 HTML inline onclick 调用

## Shell 扩展名称解析（本分支重构）

名称解析已从 `PowerShellBridge` 拆出为独立服务：

- **`Win32Shell`**：koffi FFI 封装，调用 `shlwapi.dll!SHLoadIndirectString` 解析 `@DLL,-ID` 格式字符串，并通过 `kernel32.dll!GetUserDefaultUILanguage` 检测 UI 语言
- **`ShellExtNameResolver`**：四级级联策略解析 Shell 扩展显示名：
  1. `directName` 间接格式 → `resolveIndirect`
  2. `LocalizedString` / `FriendlyTypeName` → `resolveIndirect`（Phase A）
  3. CLSID 默认值（Phase B）
  4. 处理程序键名（兜底）
- **`SystemInfoService`**：检测 OS 版本（Win10/Win11，基于 build number ≥ 22000）及当前菜单风格（`classic` / `win11-new`）
- 标准谓词（open/edit/print/runas 等）通过内置翻译表按 UI 语言转换，无需注册表查询

## 注册表路径

| 场景 | Classic Shell | ShellEx ContextMenuHandlers |
|------|--------------|---------------------------|
| 桌面 | `HKCR\DesktopBackground\Shell` | `DesktopBackground\shellex\ContextMenuHandlers` |
| 文件 | `HKCR\*\shell` | `*\shellex\ContextMenuHandlers` |
| 文件夹 | `HKCR\Directory\shell` | `Directory\shellex\ContextMenuHandlers` |
| 驱动器 | `HKCR\Drive\shell` | `Drive\shellex\ContextMenuHandlers` |
| 目录背景 | `HKCR\Directory\Background\shell` | `Directory\Background\shellex\ContextMenuHandlers` |
| 回收站 | `HKCR\CLSID\{645FF040-5081-101B-9F08-00AA002F954E}\shell` | 同上 + `\shellex\ContextMenuHandlers` |

## IPC 模式

```
renderer → window.api.getMenuItems(scene)            [preload/index.ts]
                ↓ ipcRenderer.invoke
main    → ipcMain.handle('registry:getItems', ...)   [main/ipc/registry.ts]
                ↓ wrapHandler
          menuManager.getMenuItems(scene)             [main/services/MenuManagerService.ts]
                ↓
返回 IpcResult<MenuItemEntry[]>
```

## 单元测试

- 测试目录：`tests/unit/` — 镜像 `src/` 结构
- 运行器：Vitest（`globals: true`, `environment: 'node'`）
- 全局 mock：`tests/unit/setup.ts` 预 mock 了 `electron`, `electron-log`, `better-sqlite3`
- 路径别名：`@` → `src/`, `@main` → `src/main/`, `@shared` → `src/shared/` 等

## 设计 Token

```
--accent:        #0067C0   /* 主按钮、选中态、激活指示器 */
--accent-hover:  #005A9E
--accent-bg:     #EFF6FC   /* 选中行背景 */
--success:       #0F7B0F   /* 已启用标签 */
--success-bg:    #DFF6DD
--danger:        #C42B1C   /* 已禁用标签、删除操作 */
--danger-bg:     #FDE7E9
--warning:       #9D5D00
--warning-bg:    #FFF4CE
--bg:            #F3F3F3   /* 应用主背景 */
--surface:       #FFFFFF   /* 卡片、面板 */
--surface2:      #F9F9F9
--border:        #E0E0E0
--text:          #1A1A1A
--text2:         #616161
--text3:         #8A8A8A
--radius:        8px
--radius-sm:     4px
--nav-w:         220px
```

字体：Segoe UI Variable（正文 13px / 辅助 11px / 标题 18px / 大标题 24px），代码/路径：Consolas

## 布局结构

- TitleBar：H=40px，含应用图标+标题+窗口控制按钮
- NavigationView（左侧）：W=220px，分两组（场景 / 管理）
- Main Content：含 Toolbar(H≈52px) + ContentArea + DetailPanel(W=240px)
- StatusBar：H=26px，accent 色背景

## 页面清单

1. MainPage    — 菜单管理（核心页，含场景切换）
2. HistoryPage — 操作记录
3. BackupPage  — 备份管理
4. SettingsPage — 设置

## 参考文档

- UI 原型：`docs/prototype/ContextMaster-UI原型.html`
- 完整方案设计：`docs/ContextMaster-方案设计文档.md`
- 设计规范：`docs/ContextMaster-Figma设计规范.md`
