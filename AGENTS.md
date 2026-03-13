# 代理指南 - ContextMaster

## 构建与运行命令

```bash
# 开发模式（需要管理员权限）
npm start

# 构建
npm run build
npm run package
npm run make

# 代码检查
npm run lint

# 测试（Vitest + Playwright）
npm test                              # 运行所有测试
npm run test:unit                     # 运行单元测试一次
npm run test:unit:watch               # 以监视模式运行单元测试
npm run test:unit:ui                  # 打开 Vitest UI 界面
npm run test:coverage                 # 运行测试并生成覆盖率报告
npm run test:e2e                      # 运行 Playwright 端到端测试
npm run test:e2e:ui                   # 打开 Playwright UI 模式

# 重建原生模块（Node/Electron 版本变更后）
npx electron-rebuild
```

## 代码风格指南

### TypeScript
- 启用严格模式
- 使用 `type` 定义对象形状，使用 `interface` 定义可扩展的契约
- 公共方法优先使用显式返回类型
- 使用 `readonly` 定义不可变属性
- 启用 `noImplicitAny` 和 `strictNullChecks`

### 导入顺序（按以下顺序分组）
1. Node 内置模块（`path`、`fs` 等）
2. 外部包（`electron`、`better-sqlite3`）
3. 内部绝对路径导入（`@shared/*`、`@main/*`）
4. 相对路径导入（`./`、`../`）

### 命名规范
- `PascalCase`：类、接口、类型、枚举
- `camelCase`：变量、函数、方法、属性
- `UPPER_SNAKE_CASE`：常量、枚举值
- 私有字段：使用 `private` 修饰符，不加 `_` 前缀
- IPC 通道：在 `shared/ipc-channels.ts` 中使用 `SCREAMING_SNAKE_CASE`

### 错误处理
- 使用 `IpcResult<T>` 模式作为 IPC 返回值：`{ success: true, data: T } | { success: false, error: string }`
- 使用 `wrapHandler()` 包装 IPC 处理器（参见 `main/utils/ipcWrapper.ts`）
- 使用 `electron-log` 进行日志记录；切勿记录敏感信息
- 优先使用 `try/catch` 并提供具体的错误信息

### 注册表操作
- 所有注册表写入操作必须先创建回滚点
- 通过 `LegacyDisable` 字符串值禁用条目
- 通过删除 `LegacyDisable` 值启用条目
- 需要管理员权限（已配置 UAC 清单）

### 数据库（better-sqlite3）
- 启用 WAL 模式
- 使用同步 API（数据库操作是阻塞的）
- 在 `main/data/repositories/` 中使用仓库模式

### 测试
- 单元测试：使用 Vitest，配合 `happy-dom` 进行 DOM 模拟
- 端到端测试：使用 Playwright 进行集成测试
- 测试文件：`tests/unit/**/*.test.ts` 或 `tests/unit/**/*.spec.ts`
- 覆盖率：使用 V8 提供程序，输出文本、JSON 和 HTML 报告

### 架构
```
src/
├── shared/     # 类型、枚举、IPC 通道常量
├── main/       # 主进程：服务、数据、IPC 处理器
├── preload/    # contextBridge 暴露
└── renderer/   # 渲染进程：页面、API 桥接
```

## 关键文件
- `src/shared/ipc-channels.ts`：IPC 通道定义
- `src/shared/types.ts`：核心类型定义
- `src/main/utils/ipcWrapper.ts`：IPC 处理器包装器
- `forge.config.ts`：Electron Forge 配置
- `vitest.config.ts`：Vitest 测试配置
