# Changelog

## [1.1.0](https://github.com/tzzs/ContextMaster/compare/v1.0.0...v1.1.0) (2026-05-10)


### ✨ 新功能

* implement UAC elevation for registry modifications ([f0b66ba](https://github.com/tzzs/ContextMaster/commit/f0b66bab2f85a83b01bf2a35f1ef54f59a8fdc8e))
* implement UAC elevation for registry modifications ([26ea92c](https://github.com/tzzs/ContextMaster/commit/26ea92cfd14a41851c2a6bb0c3d4786f7fbda98b))
* Shell 扩展显示名解析通用化重构（Level 2 第五轮优化） ([#2](https://github.com/tzzs/ContextMaster/issues/2)) ([8120d88](https://github.com/tzzs/ContextMaster/commit/8120d888f4e3eae2e5d144f1e2c516f3a21f2b95))
* **test:** 完成测试框架搭建和CI/CD配置 ([#4](https://github.com/tzzs/ContextMaster/issues/4)) ([6d6c9b0](https://github.com/tzzs/ContextMaster/commit/6d6c9b0a98138916aa6aa30d3d3e4918f263a47b))
* **utils:** add shared escapeHtml utility function ([31dcec9](https://github.com/tzzs/ContextMaster/commit/31dcec9fe6a2fd8833c22282acad365da984c770))
* **utils:** add shared escapeHtml utility function ([8e80b42](https://github.com/tzzs/ContextMaster/commit/8e80b422ea00bfce22dcb2d9ae4ca9419cf1cbcc))
* 添加 Electron 重构版本并修复注册表读取 Bug ([0df523f](https://github.com/tzzs/ContextMaster/commit/0df523f3fa54cc5f17be596ed385644956a11b7b))
* 添加 PowerShell 脚本工具 ([31dcec9](https://github.com/tzzs/ContextMaster/commit/31dcec9fe6a2fd8833c22282acad365da984c770))
* 添加 PowerShell 脚本工具 ([8e80b42](https://github.com/tzzs/ContextMaster/commit/8e80b422ea00bfce22dcb2d9ae4ca9419cf1cbcc))
* 添加 PowerShell 脚本工具 ([230be4b](https://github.com/tzzs/ContextMaster/commit/230be4b9e868cb5bc482ced14ccb1b3ee794cafe))
* 添加 PowerShell 脚本工具 ([4de6362](https://github.com/tzzs/ContextMaster/commit/4de6362cf885b702e56298ab8a591757133ea51a))
* 添加全局搜索功能，优化界面布局 ([d78d4df](https://github.com/tzzs/ContextMaster/commit/d78d4df496e4ec9ea6c0c8fd3674f8e497cd2fdd))
* 添加日志文件夹打开功能，改进管理员状态交互 ([9f686f5](https://github.com/tzzs/ContextMaster/commit/9f686f5ee72b419008b936763b8f28b956efdadd))
* 移除左下角管理员状态提示，优化状态栏样式，补充关于页信息 ([22a7bb1](https://github.com/tzzs/ContextMaster/commit/22a7bb165819bda577700f7b962c9676da3c1b74))


### 🐛 Bug 修复

* **UI:** 修复构建与运行问题 ([53b15a9](https://github.com/tzzs/ContextMaster/commit/53b15a95eee00f91444882fc5e83e4cda943e05d))
* 修复 PowerShell 启用/禁用菜单项时 JSON 解析失败 ([9ef6656](https://github.com/tzzs/ContextMaster/commit/9ef6656b57200a704e736be8ca5f704b562e1a5d))
* 修复 PowerShell 启用/禁用菜单项时 JSON 解析失败的问题 ([af59df1](https://github.com/tzzs/ContextMaster/commit/af59df1cfc4d346f8c3638c9a6c31acad61ff945))


### ♻️ 重构

* **ipc:** wrap all handlers with logging and error handling ([230be4b](https://github.com/tzzs/ContextMaster/commit/230be4b9e868cb5bc482ced14ccb1b3ee794cafe))
* **scripts:** update worktree creation and permissions settings ([2945e63](https://github.com/tzzs/ContextMaster/commit/2945e63814e11602255b9384dd614b0eb9215cb7))
