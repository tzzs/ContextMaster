# Microsoft Store 发布指南

本文档详细说明了如何将 ContextMaster 发布到 Microsoft Store。

## 目录

- [前置准备](#前置准备)
- [步骤 1：注册 Microsoft 开发者账户](#步骤-1注册-microsoft-开发者账户)
- [步骤 2：在 Partner Center 创建应用](#步骤-2在-partner-center-创建应用)
- [步骤 3：配置项目](#步骤-3配置项目)
- [步骤 4：创建应用图标](#步骤-4创建应用图标)
- [步骤 5：构建 MSIX 包](#步骤-5构建-msix-包)
- [步骤 6：准备 Store 资源](#步骤-6准备-store-资源)
- [步骤 7：提交到 Store](#步骤-7提交到-store)
- [常见问题](#常见问题)

---

## 前置准备

### 系统要求
- Windows 10 版本 1607（周年更新）或更高版本
- Windows 10 SDK（下载：https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/）
- Node.js 18+
- pnpm（项目已配置）

### 技术栈
- Electron 33.x
- TypeScript
- Electron Forge
- @electron-forge/maker-appx

---

## 步骤 1：注册 Microsoft 开发者账户

1. 访问 https://developer.microsoft.com/en-us/microsoft-store/register/
2. 点击「立即注册」
3. 使用 Microsoft 账户登录
4. 填写开发者信息
5. 支付 $19 一次性注册费用
6. 完成账户验证

**注意**：账户审批可能需要 1-2 个工作日。

---

## 步骤 2：在 Partner Center 创建应用

### 2.1 创建新应用
1. 登录 https://partner.microsoft.com/dashboard
2. 点击「创建新应用」
3. 输入应用名称：`ContextMaster`
4. 检查名称可用性
5. 选择应用类型：`桌面应用(MSIX)`
6. 点击「创建」

### 2.2 获取关键信息
创建应用后，记录以下信息：

| 信息项 | 位置 | 示例 |
|--------|------|------|
| **Package Identity Name** | 应用管理 → 产品管理 → 产品标识 | `12345Publisher.ContextMaster` |
| **Publisher ID** | 账户设置 → 开发者设置 → 发布者标识 | `CN=12345678-1234-1234-1234-1234567890AB` |
| **Publisher Display Name** | 账户设置 → 发布者信息 | `Your Company Name` |

---

## 步骤 3：配置项目

### 3.1 更新配置文件

拿到 Publisher ID 后，更新以下文件：

#### 3.1.1 更新 `assets/Package.appxmanifest`

```xml
<Identity
  Name="12345Publisher.ContextMaster"  <!-- 替换为你的 Package Identity Name -->
  Publisher="CN=12345678-1234-1234-1234-1234567890AB"  <!-- 替换为你的 Publisher ID -->
  Version="1.0.0.0" />

<Properties>
  <PublisherDisplayName>Your Company Name</PublisherDisplayName>  <!-- 替换为你的 Publisher Display Name -->
</Properties>
```

#### 3.1.2 更新 `forge.config.ts`

```typescript
new MakerAppX({
  publisher: 'CN=12345678-1234-1234-1234-1234567890AB',  // 替换为你的 Publisher ID
  // ... 其他配置
}),
```

### 3.2 安装依赖（已完成）
```bash
pnpm install --save-dev @electron-forge/maker-appx
```

---

## 步骤 4：创建应用图标

### 4.1 需要的图标尺寸

| 文件 | 尺寸 | 格式 | 用途 |
|------|------|------|------|
| `icon.ico` | 16x16, 32x32, 48x48, 256x256 | ICO | 应用图标 |
| `StoreLogo.png` | 50x50 | PNG | Store 列表 |
| `Square44x44Logo.png` | 44x44 | PNG | 任务栏 |
| `Square71x71Logo.png` | 71x71 | PNG | 小磁贴 |
| `Square150x150Logo.png` | 150x150 | PNG | 中等磁贴 |
| `Square310x310Logo.png` | 310x310 | PNG | 大磁贴 |
| `Wide310x150Logo.png` | 310x150 | PNG | 宽磁贴 |
| `SplashScreen.png` | 620x300 | PNG | 启动画面 |

### 4.2 图标创建工具推荐
- **在线工具**：
  - https://convertico.com/ - PNG 转 ICO
  - https://resizeimage.net/ - 调整图片尺寸
  - https://www.favicon-generator.org/ - 生成多尺寸图标
- **设计工具**：
  - Figma - https://www.figma.com/
  - GIMP - https://www.gimp.org/（免费）
  - Adobe Photoshop

### 4.3 放置位置
将所有图标文件放入 `assets/store-icons/` 目录。

---

## 步骤 5：构建 MSIX 包

### 5.1 前置检查
- 确保已安装 Windows 10 SDK
- 确认 `assets/store-icons/` 目录中有所有必需的图标
- 确认已更新 `Package.appxmanifest` 和 `forge.config.ts` 中的 Publisher ID

### 5.2 构建命令

```bash
# 1. 先构建应用
pnpm run build

# 2. 打包应用
pnpm run package

# 3. 生成 MSIX 包
pnpm run make
```

### 5.3 输出位置
MSIX 包将生成在：
```
out/make/appx/ContextMaster-1.0.0.0-x64.appx
```

### 5.4 本地测试
```powershell
# 使用 PowerShell 安装测试包
Add-AppxPackage -Path "out\make\appx\ContextMaster-1.0.0.0-x64.appx"

# 卸载测试包
Get-AppxPackage *ContextMaster* | Remove-AppxPackage
```

### 5.5 使用 Windows App Certification Kit (WACK) 测试
1. 打开「Windows 应用认证工具包」
2. 选择「验证 Windows 应用商店应用」
3. 选择生成的 .appx 文件
4. 运行测试并修复所有失败项

---

## 步骤 6：准备 Store 资源

### 6.1 Store 列表内容

#### 中文（简体）
- **应用名称**：ContextMaster
- **简短描述**（最多 100 字符）：Windows 右键菜单管理工具
- **完整描述**：
  ```
  ContextMaster 是一个专为 Windows 系统设计的右键菜单管理工具，帮助用户可视化管理和定制系统右键菜单，提升操作效率。

  🎯 核心功能
  • 可视化管理：直观查看和编辑所有右键菜单条目
  • 多场景支持：涵盖桌面、文件、文件夹、驱动器等多种右键菜单场景
  • 安全操作：所有修改前自动创建回滚点，确保系统安全
  • 操作历史：记录所有修改操作，支持撤销功能
  • 备份恢复：支持菜单配置的备份和导入

  📋 支持的右键菜单场景
  • 桌面右键
  • 文件右键
  • 文件夹右键
  • 驱动器右键
  • 目录背景
  • 回收站

  ⚠️ 注意事项
  • 应用需要管理员权限才能修改注册表
  • 建议在修改前先创建备份
  ```

- **功能列表**（每行一个功能）：
  - 可视化管理右键菜单
  - 支持多种右键菜单场景
  - 自动创建回滚点
  - 操作历史记录与撤销
  - 配置备份与恢复
  - 全局搜索功能

#### 英文
- **App name**：ContextMaster
- **Short description**：Windows Context Menu Manager
- **Full description**：
  ```
  ContextMaster is a Windows context menu management tool designed to help users visually manage and customize system context menus, improving operational efficiency.

  🎯 Core Features
  • Visual management: Intuitively view and edit all context menu items
  • Multi-scenario support: Covers desktop, files, folders, drives, and more
  • Safe operations: Automatic rollback points before any modifications
  • Operation history: Record all changes with undo support
  • Backup & restore: Support menu configuration backup and import

  📋 Supported Context Menu Scenarios
  • Desktop right-click
  • File right-click
  • Folder right-click
  • Drive right-click
  • Directory background
  • Recycle Bin

  ⚠️ Notes
  • Administrator privileges required to modify the registry
  • Recommend creating a backup before making changes
  ```

### 6.2 屏幕截图
- 至少需要 1 张截图，建议 3-5 张
- 尺寸：1366x768（推荐）或 1920x1080
- 格式：PNG
- 内容：
  1. 主界面截图
  2. 菜单管理功能截图
  3. 操作历史截图
  4. 备份管理截图

### 6.3 其他资源
- **隐私政策 URL**：创建一个简单的页面说明不收集用户数据
  - 可以使用 GitHub Pages 或托管在你的网站上
- **支持信息**：GitHub Issues 链接或邮箱
- **版权信息**：`Copyright (c) 2024 Your Name`

---

## 步骤 7：提交到 Store

### 7.1 上传包
1. 在 Partner Center 进入应用管理
2. 点击「程序包」→「上传程序包」
3. 上传生成的 `.appx` 文件
4. 等待包验证通过

### 7.2 填写商店列表
1. 进入「商店列表」
2. 选择语言（中文（简体）和 English）
3. 填写描述、功能列表等
4. 上传屏幕截图
5. 上传应用徽标
6. 填写隐私政策 URL 和支持信息

### 7.3 配置属性
1. 进入「属性」
2. 选择类别：`开发者工具` 或 `实用工具`
3. 填写定价（免费）
4. 配置市场选择（全球或特定国家/地区）

### 7.4 受限功能说明
由于我们使用了 `runFullTrust` 受限功能，需要在「提交选项」→「受限功能」中说明：

> 此应用使用 runFullTrust 功能是为了能够访问和修改 Windows 注册表，从而管理系统右键菜单。这是应用的核心功能，需要完全信任权限才能正常工作。

### 7.5 提交认证
1. 检查所有信息是否填写完整
2. 点击「提交到 Store」
3. 等待认证（通常需要 24-72 小时）

---

## 常见问题

### Q1: 构建 MSIX 时提示找不到 Windows SDK
**A**: 确保已安装 Windows 10 SDK，并在 `forge.config.ts` 中正确配置 `windowsKit` 路径。

### Q2: runFullTrust 功能会被批准吗？
**A**: 只要在提交选项中清楚说明用途（访问注册表管理右键菜单），通常会被批准。

### Q3: 应用需要管理员权限，会影响 Store 发布吗？
**A**: 不会，只要应用正确处理权限提升（我们已实现），就可以正常发布。

### Q4: 认证失败怎么办？
**A**: 查看认证报告，根据反馈修复问题后重新提交。常见问题包括：
- 缺少必需的图标尺寸
- 应用崩溃或无响应
- 隐私政策缺失
- 受限功能说明不充分

### Q5: 如何更新应用？
**A**: 
1. 更新 `package.json` 中的版本号
2. 更新 `Package.appxmanifest` 中的版本号
3. 重新构建 MSIX 包
4. 在 Partner Center 创建新提交并上传新包

---

## 参考链接

- [Microsoft Partner Center 文档](https://learn.microsoft.com/en-us/windows/uwp/publish/)
- [Electron Windows Store 文档](https://www.electronforge.io/config/makers/appx)
- [Package.appxmanifest 参考](https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/appx-package-manifest)
- [Windows App Certification Kit](https://learn.microsoft.com/en-us/windows/uwp/debug-test-perf/windows-app-certification-kit)

---

## 快速检查清单

- [ ] 注册 Microsoft 开发者账户
- [ ] 在 Partner Center 创建应用并获取 Publisher ID
- [ ] 更新 `Package.appxmanifest` 中的 Publisher ID 和 Package Name
- [ ] 更新 `forge.config.ts` 中的 Publisher ID
- [ ] 创建所有必需尺寸的应用图标
- [ ] 准备 Store 列表内容（描述、截图等）
- [ ] 创建隐私政策页面
- [ ] 构建 MSIX 包
- [ ] 本地测试安装和功能
- [ ] 使用 WACK 测试
- [ ] 在 Partner Center 上传包并填写列表
- [ ] 提交认证

祝发布顺利！🎉
