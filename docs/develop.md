# ContextMaster 开发指南

## 环境要求

- Node.js >= 18.x
- pnpm >= 8.x
- Windows 11 (需要管理员权限)

## 常用命令

```bash
# 开发模式（需要管理员权限）
pnpm start

# 构建
pnpm run build
pnpm run package
pnpm run make

# 代码检查
pnpm run lint

# 测试
pnpm run test:unit        # 单元测试
pnpm run test:unit:watch  # 监听模式
pnpm run test:coverage    # 覆盖率报告
```

## 常见问题与解决方案

### 1. TypeScript 配置：rootDir 与 include 冲突

**问题现象：**

```
File 'tests/...' is not under 'rootDir' 'src'. 
'rootDir' is expected to contain all source files.
```

**原因：**

`tsconfig.json` 中 `rootDir` 设置为 `src`，但 `include` 同时包含了 `tests` 目录，导致 TypeScript 编译器报错。

**解决方案：**

为测试代码创建独立的 `tsconfig.json`：

```json
// tests/tsconfig.json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "rootDir": "..",
    "outDir": "../.vite/tests",
    "types": ["node", "vitest/globals"],
    "baseUrl": "..",
    "paths": {
      "@/*": ["src/*"],
      "@shared/*": ["src/shared/*"],
      "@main/*": ["src/main/*"]
    }
  },
  "include": ["./**/*.ts", "../src/**/*.ts"],
  "exclude": ["../node_modules", "../.vite", "../dist"]
}
```

主配置 `tsconfig.json` 排除 tests 目录：

```json
{
  "compilerOptions": {
    "rootDir": "src",
    ...
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", ".vite", "dist", "tests"]
}
```

---

### 2. Vitest Mock 类型错误

**问题现象：**

```
Property 'mockResolvedValue' does not exist on type '(...) => Promise<...>'.
Property 'mockReturnValue' does not exist on type '(...) => ...'.
```

**原因：**

Mock 对象使用 `as unknown as SomeType` 断言后，TypeScript 将方法识别为原始类型而非 Mock 类型。

**解决方案：**

从 `vitest` 导入 `MockedObject` 类型：

```typescript
import { describe, it, expect, vi, beforeEach, MockedObject } from 'vitest';

describe('MyService', () => {
  let mockRepo: MockedObject<MyRepo>;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      save: vi.fn(),
    } as MockedObject<MyRepo>;
  });

  it('should work', () => {
    mockRepo.findById.mockResolvedValue({ id: 1 }); // 现在有类型提示
  });
});
```

---

### 3. IpcResult 联合类型属性访问错误

**问题现象：**

```
Property 'error' does not exist on type 'IpcResult<any>'.
Property 'data' does not exist on type 'IpcResult<any>'.
```

**原因：**

`IpcResult` 是联合类型 `{ success: true, data: T } | { success: false, error: string }`，TypeScript 需要类型守卫来缩小类型范围。

**解决方案：**

使用类型守卫：

```typescript
const result = await wrappedHandler();

expect(result.success).toBe(false);
if (!result.success) {
  expect(result.error).toBe('Expected error');
}
```

---

### 4. Vite CJS API 弃用警告

**问题现象：**

```
The CJS build of Vite's Node API is deprecated.
```

**原因：**

Vite 正在迁移到 ESM，CJS 构建将被移除。

**解决方案：**

对于 Electron 项目，**不建议**添加 `"type": "module"`，因为：

1. Electron 主进程通常使用 CommonJS
2. 可能导致 `require is not defined` 错误

暂时忽略此警告，等待 Vite 和 Electron 完全支持 ESM。如需消除警告，可将配置文件改为 `.mjs` 扩展名：

```
vitest.config.ts → vitest.config.mts
```

---

### 5. 原生模块版本不匹配

**问题现象：**

```
Error: The module 'better-sqlite3' was compiled against a different Node.js version using
NODE_MODULE_VERSION 127. This version of Node.js requires NODE_MODULE_VERSION 130.
```

**原因：**

原生模块（如 `better-sqlite3`）是针对特定 Node.js 版本编译的。Electron 使用自己的 Node.js 版本，需要重新编译原生模块。

**解决方案：**

```bash
# 重新编译 better-sqlite3
npx @electron/rebuild -f -w better-sqlite3

# 或重新编译所有原生模块
npx @electron/rebuild -f
```

**预防措施：**

在 `package.json` 中已配置 `@electron/rebuild`，升级 Electron 或 Node.js 版本后自动触发重新编译。

---

### 6. 路径别名无法跳转

**问题现象：**

IDE 中 `@/main/...` 等路径别名无法跳转到源文件。

**原因：**

`tsconfig.json` 中未配置对应的 `paths` 映射。

**解决方案：**

确保 `tsconfig.json` 包含路径别名配置：

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@shared/*": ["src/shared/*"],
      "@main/*": ["src/main/*"],
      "@renderer/*": ["src/renderer/*"],
      "@preload/*": ["src/preload/*"]
    }
  }
}
```

测试配置 (`tests/tsconfig.json`) 也需要相同的路径映射。

---

## 项目结构

```
src/
├── shared/     # 共享类型、枚举、IPC 通道定义
├── main/       # 主进程：服务、数据层、IPC 处理器
│   ├── data/   # 数据库仓库层
│   ├── services/ # 业务服务层
│   ├── ipc/    # IPC 处理器
│   └── utils/  # 工具函数
├── preload/    # contextBridge 暴露层
└── renderer/   # 渲染进程：UI 组件、页面
```

## 代码规范

### 命名约定

| 类型 | 命名风格 | 示例 |
|------|----------|------|
| 类、接口、类型、枚举 | PascalCase | `BackupService`, `MenuItemEntry` |
| 变量、函数、方法、属性 | camelCase | `getMenuItems`, `isEnabled` |
| 常量、枚举值 | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`, `MenuScene.Desktop` |
| IPC 通道 | SCREAMING_SNAKE_CASE | `REGISTRY_GET_ITEMS` |

### 导入顺序

1. Node.js 内置模块 (`path`, `fs`, etc.)
2. 外部包 (`electron`, `better-sqlite3`)
3. 内部绝对导入 (`@shared/*`, `@main/*`)
4. 相对导入 (`./`, `../`)

### 错误处理

使用 `IpcResult<T>` 模式处理 IPC 返回值：

```typescript
// 正确
return { success: true, data: result };
return { success: false, error: 'Error message' };

// 错误处理
if (result.success) {
  // 使用 result.data
} else {
  // 处理 result.error
}
```

## 测试指南

### 运行测试

```bash
pnpm run test:unit        # 运行所有单元测试
pnpm run test:unit:watch  # 监听模式
pnpm run test:coverage    # 生成覆盖率报告
```

### 测试文件组织

```
tests/
├── unit/
│   ├── main/
│   │   ├── data/repositories/
│   │   ├── services/
│   │   ├── ipc/
│   │   └── utils/
│   └── setup.ts
└── tsconfig.json
```

### Mock 最佳实践

```typescript
// 1. 使用 vi.mock 模拟模块
vi.mock('@/main/services/SomeService');

// 2. 使用 MockedObject 类型
let mockService: MockedObject<SomeService>;

// 3. 在 beforeEach 中初始化
beforeEach(() => {
  mockService = {
    method: vi.fn(),
  } as MockedObject<SomeService>;
});

// 4. 使用 vi.mocked 包装已模拟的方法
vi.mocked(mockService.method).mockResolvedValue(data);
```
