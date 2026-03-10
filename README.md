# ContextMaster - Windows 右键菜单管理工具

## 项目介绍

ContextMaster 是一个专为 Windows 系统设计的右键菜单管理工具，帮助用户可视化管理和定制系统右键菜单，提升操作效率。

- **可视化管理**：直观查看和编辑所有右键菜单条目
- **多场景支持**：涵盖桌面、文件、文件夹、驱动器等多种右键菜单场景
- **安全操作**：所有修改前自动创建回滚点，确保系统安全
- **操作历史**：记录所有修改操作，支持撤销功能
- **备份恢复**：支持菜单配置的备份和导入

## 技术栈

- **框架**：Electron 33.x + electron-forge + Vite
- **语言**：TypeScript（严格模式）
- **数据库**：better-sqlite3（同步 API，WAL 模式）
- **注册表访问**：PowerShell 桥接（读写 HKCR）
- **IPC**：contextBridge + 类型化 IPC 频道

## 系统要求

- Windows 10/11 (64位)
- Node.js 18.0 或更高版本
- 管理员权限（运行时需要）

## 安装与运行

### 开发模式

```bash
# 克隆仓库
git clone <repository-url>
cd ContextMaster

# 安装依赖
npm install

# 运行开发模式（需管理员身份）
npm start
```

### 打包安装

```bash
# 打包应用
npm run make

# 安装包将生成在 out/ 目录
```

## 功能特性

### 核心功能

1. **菜单管理**：查看、启用/禁用、删除右键菜单项
2. **全局搜索**：跨场景搜索菜单项
3. **操作历史**：查看和撤销历史操作
4. **备份管理**：创建和导入菜单配置备份
5. **系统设置**：配置应用行为和查看日志

### 支持的右键菜单场景

- 桌面右键
- 文件右键
- 文件夹右键
- 驱动器右键
- 目录背景
- 回收站

## 架构设计

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

## 使用指南

1. **启动应用**：以管理员身份运行 ContextMaster
2. **选择场景**：在左侧导航栏选择要管理的右键菜单场景
3. **管理条目**：
   - 点击条目查看详细信息
   - 使用开关启用/禁用条目
   - 使用删除按钮移除不需要的条目
4. **搜索功能**：在顶部搜索框输入关键词进行全局搜索
5. **查看历史**：在导航栏选择「操作记录」查看历史操作
6. **备份配置**：在导航栏选择「备份管理」创建或导入备份

## 注意事项

- **权限要求**：应用需要管理员权限才能修改注册表
- **安全操作**：所有修改前会自动创建回滚点，确保系统安全
- **Native 模块**：better-sqlite3 为 native 模块，切换 Node/Electron 版本后需执行 `npx electron-rebuild`

## 配置与日志

- **日志文件**：存储于应用数据目录下的 logs 文件夹，保留最近 7 天
- **配置文件**：应用配置存储在本地数据库中

## 开发说明

### 代码规范

- 使用 async/await 处理所有 IO 操作
- 错误处理使用 Result<T> 模式
- renderer page 模块通过 `(window as any)._mainPage` 等挂载供 HTML inline onclick 调用

### 构建命令

```bash
npm start        # 开发模式
npm run build    # 构建应用
npm run package  # 打包应用
npm run make     # 生成安装包
npm run lint     # 代码检查
```

## 参考文档

- **UI 原型**：docs/prototype/ContextMaster-UI原型.html
- **完整方案设计**：docs/ContextMaster-方案设计文档.md
- **设计规范**：docs/ContextMaster-Figma设计规范.md

## 许可证

[MIT License](LICENSE)

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目！
