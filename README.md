# ContextMaster - Windows 右键菜单管理工具

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-33.x-blue.svg)](https://www.electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)

[English](#english) | [中文](#中文)

---

## English

### Project Introduction

ContextMaster is a Windows context menu management tool designed to help users visually manage and customize system right-click menus, improving operational efficiency.

- **Visual Management**: Intuitively view and edit all context menu items
- **Multi-scenario Support**: Covers desktop, files, folders, drives, and more
- **Safe Operations**: Automatic rollback points before any modifications
- **Operation History**: Record all changes with undo support
- **Backup & Restore**: Support menu configuration backup and import

### Tech Stack

- **Framework**: Electron 33.x + electron-forge + Vite
- **Language**: TypeScript (strict mode)
- **Database**: better-sqlite3 (sync API, WAL mode)
- **Registry Access**: PowerShell bridge (read/write HKCR)
- **IPC**: contextBridge + typed IPC channels

### System Requirements

- Windows 10/11 (64-bit)
- Node.js 18.0 or higher
- Administrator privileges (required for runtime)

### Installation & Running

#### Development Mode

```bash
# Clone the repository
git clone <repository-url>
cd ContextMaster

# Install dependencies
pnpm install

# Run in development mode (requires administrator)
pnpm start
```

#### Packaging & Installation

```bash
# Package the application
pnpm run make

# Package will be generated in the out/ directory
```

#### Microsoft Store Build

```bash
# Build MSIX package for Microsoft Store
pnpm run make:appx
```

### Features

#### Core Features

1. **Menu Management**: View, enable/disable, delete context menu items
2. **Global Search**: Search menu items across scenarios
3. **Operation History**: View and undo historical operations
4. **Backup Management**: Create and import menu configuration backups
5. **System Settings**: Configure application behavior and view logs

#### Supported Context Menu Scenarios

- Desktop right-click
- File right-click
- Folder right-click
- Drive right-click
- Directory background
- Recycle Bin

### Architecture

```
src/
├── shared/          → Types/Enums/IPC channel constants (shared by main + renderer)
├── main/
│   ├── services/    → PowerShellBridge → RegistryService → MenuManagerService
│   │                  OperationHistoryService → BackupService
│   ├── data/        → Database.ts (better-sqlite3) + Repository layer
│   └── ipc/         → Four handler files (registry/history/backup/system)
├── preload/         → contextBridge exposes window.api
└── renderer/        → index.html + main.ts + four page modules
```

### Usage Guide

1. **Launch the app**: Run ContextMaster as administrator
2. **Select scenario**: Choose the context menu scenario to manage in the left navigation
3. **Manage items**:
   - Click an item to view details
   - Use the toggle to enable/disable items
   - Use the delete button to remove unwanted items
4. **Search**: Enter keywords in the top search box for global search
5. **View history**: Select "Operation History" in the navigation to view past operations
6. **Backup config**: Select "Backup Management" in the navigation to create or import backups

### Notes

- **Permission Requirement**: The app requires administrator privileges to modify the registry
- **Safe Operations**: Rollback points are automatically created before any modifications to ensure system safety
- **Native Module**: better-sqlite3 is a native module, run `npx electron-rebuild` after switching Node/Electron versions

### Configuration & Logs

- **Log files**: Stored in the logs folder under the app data directory, retaining the last 7 days
- **Config files**: App configuration is stored in the local database

### Development

#### Code Standards

- Use async/await for all IO operations
- Error handling uses Result<T> pattern
- Renderer page modules are mounted via `(window as any)._mainPage` etc. for HTML inline onclick calls

#### Build Commands

```bash
pnpm start        # Development mode
pnpm run build    # Build the app
pnpm run package  # Package the app
pnpm run make     # Generate installer
pnpm run make:appx # Generate MSIX package for Store
pnpm run lint     # Code linting
pnpm test         # Run all tests
```

### Reference Documentation

- **Microsoft Store Guide**: [docs/MICROSOFT-STORE.md](docs/MICROSOFT-STORE.md)
- **Privacy Policy**: [docs/PRIVACY-POLICY.md](docs/PRIVACY-POLICY.md)
- **Certification Notes**: [docs/CERTIFICATION-NOTES.md](docs/CERTIFICATION-NOTES.md)
- **UI Prototype**: docs/prototype/ContextMaster-UI原型.html
- **Complete Design**: docs/ContextMaster-方案设计文档.md
- **Design Spec**: docs/ContextMaster-Figma设计规范.md

### License

[MIT License](LICENSE)

### Contributing

Issues and Pull Requests are welcome!

---

## 中文

### 项目介绍

ContextMaster 是一个专为 Windows 系统设计的右键菜单管理工具，帮助用户可视化管理和定制系统右键菜单，提升操作效率。

- **可视化管理**：直观查看和编辑所有右键菜单条目
- **多场景支持**：涵盖桌面、文件、文件夹、驱动器等多种右键菜单场景
- **安全操作**：所有修改前自动创建回滚点，确保系统安全
- **操作历史**：记录所有修改操作，支持撤销功能
- **备份恢复**：支持菜单配置的备份和导入

### 技术栈

- **框架**：Electron 33.x + electron-forge + Vite
- **语言**：TypeScript（严格模式）
- **数据库**：better-sqlite3（同步 API，WAL 模式）
- **注册表访问**：PowerShell 桥接（读写 HKCR）
- **IPC**：contextBridge + 类型化 IPC 频道

### 系统要求

- Windows 10/11 (64位)
- Node.js 18.0 或更高版本
- 管理员权限（运行时需要）

### 安装与运行

#### 开发模式

```bash
# 克隆仓库
git clone <repository-url>
cd ContextMaster

# 安装依赖
pnpm install

# 运行开发模式（需管理员身份）
pnpm start
```

#### 打包安装

```bash
# 打包应用
pnpm run make

# 安装包将生成在 out/ 目录
```

#### Microsoft Store 构建

```bash
# 构建 Microsoft Store 的 MSIX 包
pnpm run make:appx
```

### 功能特性

#### 核心功能

1. **菜单管理**：查看、启用/禁用、删除右键菜单项
2. **全局搜索**：跨场景搜索菜单项
3. **操作历史**：查看和撤销历史操作
4. **备份管理**：创建和导入菜单配置备份
5. **系统设置**：配置应用行为和查看日志

#### 支持的右键菜单场景

- 桌面右键
- 文件右键
- 文件夹右键
- 驱动器右键
- 目录背景
- 回收站

### 架构设计

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

### 使用指南

1. **启动应用**：以管理员身份运行 ContextMaster
2. **选择场景**：在左侧导航栏选择要管理的右键菜单场景
3. **管理条目**：
   - 点击条目查看详细信息
   - 使用开关启用/禁用条目
   - 使用删除按钮移除不需要的条目
4. **搜索功能**：在顶部搜索框输入关键词进行全局搜索
5. **查看历史**：在导航栏选择「操作记录」查看历史操作
6. **备份配置**：在导航栏选择「备份管理」创建或导入备份

### 注意事项

- **权限要求**：应用需要管理员权限才能修改注册表
- **安全操作**：所有修改前会自动创建回滚点，确保系统安全
- **Native 模块**：better-sqlite3 为 native 模块，切换 Node/Electron 版本后需执行 `npx electron-rebuild`

### 配置与日志

- **日志文件**：存储于应用数据目录下的 logs 文件夹，保留最近 7 天
- **配置文件**：应用配置存储在本地数据库中

### 开发说明

#### 代码规范

- 使用 async/await 处理所有 IO 操作
- 错误处理使用 Result<T> 模式
- renderer page 模块通过 `(window as any)._mainPage` 等挂载供 HTML inline onclick 调用

#### 构建命令

```bash
pnpm start        # 开发模式
pnpm run build    # 构建应用
pnpm run package  # 打包应用
pnpm run make     # 生成安装包
pnpm run make:appx # 生成 Store 的 MSIX 包
pnpm run lint     # 代码检查
pnpm test         # 运行所有测试
```

### 参考文档

- **Microsoft Store 发布指南**：[docs/MICROSOFT-STORE.md](docs/MICROSOFT-STORE.md)
- **隐私政策**：[docs/PRIVACY-POLICY.md](docs/PRIVACY-POLICY.md)
- **认证说明**：[docs/CERTIFICATION-NOTES.md](docs/CERTIFICATION-NOTES.md)
- **UI 原型**：docs/prototype/ContextMaster-UI原型.html
- **完整方案设计**：docs/ContextMaster-方案设计文档.md
- **设计规范**：docs/ContextMaster-Figma设计规范.md

### 许可证

[MIT License](LICENSE)

### 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目！
