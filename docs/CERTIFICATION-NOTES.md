# Microsoft Store Certification Notes - ContextMaster

## Application Overview

ContextMaster is a Windows context menu management tool that allows users to visually manage and customize Windows right-click menu entries through a user-friendly interface.

## Important Testing Information

### 1. Administrator Privileges Requirement

**IMPORTANT**: This application requires administrator privileges to function properly.

**Why we need it**:
- The application needs to read and write to the Windows Registry to manage context menu entries
- Specifically, it accesses keys under `HKEY_CLASSES_ROOT` (HKCR) and `HKEY_LOCAL_MACHINE` (HKLM)

**How to test**:
1. Launch the application normally - it will display a dialog asking for administrator privileges
2. Click "Restart as Administrator" or manually right-click and select "Run as administrator"
3. The application will then function normally

### 2. Restricted Capability Justification

**Capability used**: `runFullTrust`

**Justification**:
This application uses the `runFullTrust` restricted capability because it needs direct access to the Windows Registry to manage context menu entries. This is the core functionality of the application and cannot be achieved with partial trust permissions.

The application only modifies registry keys related to Windows context menus and does not make any other system changes.

### 3. What the Application Does

**Primary functions**:
- **View context menu entries**: Reads registry keys to display all context menu items
- **Enable/disable entries**: Toggles the `LegacyDisable` string value to enable/disable menu items
- **Delete entries**: Removes unwanted context menu entries from the registry
- **Backup & restore**: Creates and restores backups of menu configurations
- **Operation history**: Tracks all changes with undo support

**Registry paths accessed**:
- `HKEY_CLASSES_ROOT\*\shell\`
- `HKEY_CLASSES_ROOT\*\shellex\ContextMenuHandlers\`
- `HKEY_CLASSES_ROOT\Directory\shell\`
- `HKEY_CLASSES_ROOT\Directory\shellex\ContextMenuHandlers\`
- `HKEY_CLASSES_ROOT\Directory\Background\shell\`
- `HKEY_CLASSES_ROOT\Directory\Background\shellex\ContextMenuHandlers\`
- `HKEY_CLASSES_ROOT\Drive\shell\`
- `HKEY_CLASSES_ROOT\Drive\shellex\ContextMenuHandlers\`
- `HKEY_CLASSES_ROOT\Folder\shell\`
- `HKEY_CLASSES_ROOT\Folder\shellex\ContextMenuHandlers\`

### 4. Safety Features

The application includes several safety features to prevent system damage:

- **Automatic rollback points**: Before any modification, the app creates a backup of the affected registry keys
- **Operation history**: All changes are logged and can be undone
- **Backup system**: Users can create full backups before making changes
- **Local only**: All data stays on the user's device - no data is transmitted anywhere

### 5. Data Storage

**Local database**: SQLite database stored at:
`%APPDATA%\ContextMaster\contextmaster.db`

**Log files**: Stored at:
`%APPDATA%\ContextMaster\logs\`

**No network communication**: This application does not make any network requests or transmit any data.

### 6. Testing Steps

**Basic functionality test**:
1. Run the application as administrator
2. Navigate through different context menu scenarios (Desktop, Files, Folders, Drives)
3. View menu entries - they should display correctly
4. Toggle an entry's switch - it should become disabled/enabled
5. Check the "Operation History" page - your change should be listed
6. Try undoing the operation - the entry should return to its previous state
7. Create a backup from the "Backup Management" page
8. Restore the backup you just created

**No test accounts needed**: This application does not require any user accounts or authentication.

### 7. Dependencies

**Third-party dependencies**:
- Electron 33.x (framework)
- better-sqlite3 (local database)
- electron-log (logging)

**No external services**: The application does not depend on any external services or APIs.

### 8. Background Behavior

**No background audio**: This application does not play any audio.

**No background processes**: The application does not run any background processes when closed.

**Startup behavior**: The application does not configure itself to start automatically with Windows.

### 9. Known Issues

There are no known issues at the time of submission.

### 10. Contact Information

For any questions during certification, please reach out via GitHub Issues.

---

---

# Microsoft Store 认证说明 - ContextMaster

## 应用概述

ContextMaster 是一个 Windows 右键菜单管理工具，允许用户通过友好的界面可视化管理和自定义 Windows 右键菜单项。

## 重要测试信息

### 1. 管理员权限要求

**重要**：此应用需要管理员权限才能正常运行。

**为什么需要管理员权限**：
- 应用程序需要读写 Windows 注册表来管理右键菜单项
- 具体来说，它访问 `HKEY_CLASSES_ROOT` (HKCR) 和 `HKEY_LOCAL_MACHINE` (HKLM) 下的项

**如何测试**：
1. 正常启动应用程序 - 它会显示一个对话框要求管理员权限
2. 点击"以管理员身份重启"或手动右键选择"以管理员身份运行"
3. 应用程序将正常运行

### 2. 受限功能说明

**使用的功能**：`runFullTrust`

**说明**：
此应用使用 `runFullTrust` 受限功能，因为它需要直接访问 Windows 注册表来管理右键菜单项。这是应用的核心功能，无法通过部分信任权限实现。

应用仅修改与 Windows 右键菜单相关的注册表项，不进行任何其他系统更改。

### 3. 应用功能

**主要功能**：
- **查看右键菜单项**：读取注册表项以显示所有右键菜单项
- **启用/禁用条目**：切换 `LegacyDisable` 字符串值来启用/禁用菜单项
- **删除条目**：从注册表中删除不需要的右键菜单项
- **备份和恢复**：创建和恢复菜单配置的备份
- **操作历史**：跟踪所有更改并支持撤销

**访问的注册表路径**：
- `HKEY_CLASSES_ROOT\*\shell\`
- `HKEY_CLASSES_ROOT\*\shellex\ContextMenuHandlers\`
- `HKEY_CLASSES_ROOT\Directory\shell\`
- `HKEY_CLASSES_ROOT\Directory\shellex\ContextMenuHandlers\`
- `HKEY_CLASSES_ROOT\Directory\Background\shell\`
- `HKEY_CLASSES_ROOT\Directory\Background\shellex\ContextMenuHandlers\`
- `HKEY_CLASSES_ROOT\Drive\shell\`
- `HKEY_CLASSES_ROOT\Drive\shellex\ContextMenuHandlers\`
- `HKEY_CLASSES_ROOT\Folder\shell\`
- `HKEY_CLASSES_ROOT\Folder\shellex\ContextMenuHandlers\`

### 4. 安全功能

应用程序包含多项安全功能以防止系统损坏：

- **自动回滚点**：在任何修改之前，应用会创建受影响注册表项的备份
- **操作历史**：所有更改都被记录并可以撤销
- **备份系统**：用户可以在进行更改之前创建完整备份
- **仅本地**：所有数据保留在用户设备上 - 不传输任何数据

### 5. 数据存储

**本地数据库**：SQLite 数据库存储位置：
`%APPDATA%\ContextMaster\contextmaster.db`

**日志文件**：存储位置：
`%APPDATA%\ContextMaster\logs\`

**无网络通信**：此应用程序不进行任何网络请求或传输任何数据。

### 6. 测试步骤

**基本功能测试**：
1. 以管理员身份运行应用程序
2. 浏览不同的右键菜单场景（桌面、文件、文件夹、驱动器）
3. 查看菜单项 - 它们应该正确显示
4. 切换某个条目的开关 - 它应该变为禁用/启用
5. 检查"操作历史"页面 - 你的更改应该已列出
6. 尝试撤销操作 - 条目应该恢复到之前的状态
7. 从"备份管理"页面创建备份
8. 恢复你刚创建的备份

**无需测试账户**：此应用程序不需要任何用户账户或身份验证。

### 7. 依赖项

**第三方依赖**：
- Electron 33.x（框架）
- better-sqlite3（本地数据库）
- electron-log（日志记录）

**无外部服务**：应用程序不依赖任何外部服务或 API。

### 8. 后台行为

**无后台音频**：此应用程序不播放任何音频。

**无后台进程**：应用程序关闭时不运行任何后台进程。

**启动行为**：应用程序不会配置为随 Windows 自动启动。

### 9. 已知问题

提交时没有已知问题。

### 10. 联系信息

如果在认证期间有任何问题，请通过 GitHub Issues 联系我们。
