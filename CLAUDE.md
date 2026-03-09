# ContextMaster — Windows 右键菜单管理工具

## 技术栈
- 框架：Electron 33.x + electron-forge + Vite
- 语言：TypeScript（严格模式）
- 数据库：better-sqlite3（同步 API，WAL 模式）
- 注册表访问：PowerShell 桥接（读写 HKCR）
- IPC：contextBridge + 类型化 IPC 频道

## 架构分层

```
src/
├── shared/          → 类型/枚举/IPC 频道常量（主+渲染进程共用）
├── main/
│   ├── services/    → PowerShellBridge → RegistryService → MenuManagerService
│   │                  OperationHistoryService → BackupService
│   ├── data/        → Database.ts（better-sqlite3）+ Repository 层
│   └── ipc/         → 四个 handler 文件（registry/history/backup/system）
├── preload/         → contextBridge 暴露 window.api
└── renderer/        → index.html + main.ts + 四个 page 模块
```

## 关键约束
- 所有注册表写操作前必须创建回滚点
- 禁用条目通过写入 LegacyDisable 字符串值实现
- 启用条目通过删除 LegacyDisable 值实现
- 需要管理员权限（UAC manifest 已在 assets/app.manifest 配置）
- `wrapHandler` 使用 `any` 签名，IPC 边界类型由 preload 层保证

## 注册表路径
- 桌面右键：HKCR\DesktopBackground\Shell
- 文件右键：HKCR\*\shell
- 文件夹右键：HKCR\Directory\shell
- 驱动器右键：HKCR\Drive\shell
- 目录背景：HKCR\Directory\Background\shell
- 回收站：HKCR\CLSID\{645FF040-5081-101B-9F08-00AA002F954E}\shell

## 代码规范
- 使用 async/await 处理所有 IO 操作
- 错误处理使用 Result<T> 模式
- renderer page 模块通过 `(window as any)._mainPage` 等挂载供 HTML inline onclick 调用

## 运行方式
```bash
npm start        # 开发模式（需管理员身份运行）
npm run make     # 打包安装包
```

> 注意：better-sqlite3 为 native 模块，切换 Node/Electron 版本后需 `npx electron-rebuild`

## 设计 Token

### 颜色
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

### 字体
- 主字体：Segoe UI Variable
- 代码/路径：Consolas
- 字号：正文 13px / 辅助 11px / 标题 18px / 大标题 24px

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
- UI 原型：docs/prototype/ContextMaster-UI原型.html
- 完整方案设计：docs/ContextMaster-方案设计文档.md
- 设计规范：docs/ContextMaster-Figma设计规范.md
