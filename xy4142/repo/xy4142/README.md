# WASM 规则插件验收台

工厂质检工程师专用的本地 WebAssembly 规则插件验证工具。

## 概述

当产线供应商发来一堆 WebAssembly 质检规则包和样本 JSON 时，你需要确保：

- ✅ 插件不会越权读取文件系统（沙箱隔离）
- ✅ 版本依赖正确（版本兼容性检查）
- ✅ 输出字段与质检系统对接无误（Schema 校验）
- ✅ 超时和内存使用可控（资源限制）

本验收台提供了完整的验证流程：

1. **插件加载验证** - 解析 manifest，检查版本兼容性，验证权限请求
2. **沙箱执行** - 隔离环境中运行 WASM，限制超时/内存
3. **Schema 校验** - 验证输入/输出 JSON 格式
4. **批次管理** - 批量执行测试用例，跟踪进度
5. **持久化存储** - 保存验收结果，支持人工复核
6. **报告导出** - 生成 Markdown 验收报告和 JSON 审计包

## 项目结构

```
.
├── src/
│   ├── cli/
│   │   └── index.ts           # CLI 命令行入口
│   ├── core/
│   │   ├── index.ts           # 核心模块导出
│   │   ├── plugin-loader.ts   # 插件加载器
│   │   ├── sandbox-executor.ts # WASM 沙箱执行器
│   │   ├── schema-validator.ts # Schema 校验器
│   │   ├── batch-manager.ts   # 批次管理器
│   │   ├── storage.ts         # 持久化存储
│   │   └── exporter.ts        # 报告导出器
│   ├── types/
│   │   ├── index.ts           # 类型定义导出
│   │   ├── manifest.ts        # Manifest 类型
│   │   ├── schema.ts          # Schema 类型
│   │   ├── test.ts            # 测试相关类型
│   │   └── validation.ts      # 校验相关类型
│   └── utils/
│       ├── index.ts           # 工具函数导出
│       ├── logger.ts          # 日志工具
│       ├── error.ts           # 错误类型
│       └── version.ts         # 版本处理
├── examples/
│   ├── plugin/
│   │   └── manifest.json      # 示例插件定义
│   └── test-batch.json        # 示例测试批次
├── tests/
│   ├── version.test.ts        # 版本工具测试
│   └── schema-validator.test.ts # Schema 校验测试
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

## 安装

```bash
npm install
```

## 构建

```bash
npm run build
```

## 测试

```bash
npm test
```

## 命令行使用

### 1. 加载并验证插件

```bash
# 查看帮助
npx wasm-validate --help

# 加载插件
npx wasm-validate load-plugin ./examples/plugin

# 指定系统版本和允许的权限
npx wasm-validate load-plugin ./examples/plugin \
  --system-version 1.0.0 \
  --allow-capabilities clock random
```

### 2. 创建测试批次模板

```bash
npx wasm-validate create-batch "质检验收批次" \
  --plugin-id quality-inspection-v1 \
  --plugin-version 1.0.0 \
  --output ./my-batch.json
```

### 3. 执行测试批次

```bash
# 执行测试批次
npx wasm-validate execute-batch ./examples/plugin ./examples/test-batch.json

# 带选项执行
npx wasm-validate execute-batch ./examples/plugin ./examples/test-batch.json \
  --timeout 10000 \
  --memory-pages 32 \
  --retry 2 \
  --output ./results
```

### 4. 列出已保存的数据

```bash
# 列出批次
npx wasm-validate list-batches --data-dir ./data

# 列出结果
npx wasm-validate list-results --data-dir ./data
```

### 5. 导出报告

```bash
# 导出 Markdown 报告
npx wasm-validate export-report <result-id> \
  --data-dir ./data \
  --output ./report.md \
  --format md

# 导出 ZIP 审计包
npx wasm-validate export-report <result-id> \
  --output ./audit.zip \
  --format zip
```

## API 使用示例

### 插件加载

```typescript
import { loadPlugin, PluginLoadOptions } from './src/core';

const options: PluginLoadOptions = {
  systemVersion: '1.0.0',
  allowedCapabilities: ['clock', 'random']
};

try {
  const plugin = await loadPlugin('./path/to/plugin', options);
  console.log(`插件加载成功: ${plugin.manifest.name} v${plugin.manifest.version}`);
} catch (error) {
  console.error('插件加载失败:', error);
}
```

### Schema 校验

```typescript
import { createSchemaValidator, JSONSchema } from './src/core';

const validator = createSchemaValidator();

const inputSchema: JSONSchema = {
  type: 'object',
  required: ['productId', 'timestamp'],
  properties: {
    productId: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' }
  }
};

validator.registerSchema('input-schema', inputSchema);

const data = {
  productId: 'PROD-001',
  timestamp: '2024-01-20T08:30:00Z'
};

const result = validator.validate(data, 'input-schema');
if (result.valid) {
  console.log('✅ 数据校验通过');
} else {
  console.error('❌ 数据校验失败:', result.errors);
}
```

### 批次执行

```typescript
import { createBatchManager, loadPlugin, TestBatch } from './src/core';

// 1. 加载插件
const plugin = await loadPlugin('./path/to/plugin');

// 2. 创建批次管理器
const manager = await createBatchManager(plugin, {
  timeoutMs: 5000,
  memoryPagesMax: 16,
  validationOptions: {
    schemaValidation: true,
    outputComparison: true,
    performanceThresholds: {
      maxDurationMs: 1000,
      maxMemoryBytes: 10 * 1024 * 1024
    }
  }
});

// 3. 注册测试批次
const testBatch: TestBatch = {
  id: 'batch-001',
  name: '质检测试批次',
  description: '验证插件功能',
  pluginId: plugin.id,
  pluginVersion: plugin.manifest.version,
  createdAt: Date.now(),
  testCases: [
    {
      id: 'test-001',
      name: '正常产品测试',
      description: '验证正常产品的检测逻辑',
      input: {
        format: 'json',
        data: {
          productId: 'PROD-001',
          timestamp: '2024-01-20T08:30:00Z',
          images: [...],
          sensors: [...]
        }
      },
      expected: {
        result: 'pass',
        score: 95
      },
      tags: ['normal'],
      metadata: {}
    }
  ],
  metadata: {}
};

manager.registerBatch(testBatch);

// 4. 执行批次
const result = await manager.executeBatch(testBatch.id);

console.log(`执行结果: ${result.overallStatus}`);
console.log(`通过: ${result.summary.passed}/${result.summary.total}`);
console.log(`平均耗时: ${result.summary.performance.avgDurationMs}ms`);
```

### 持久化和人工复核

```typescript
import { createStorageManager } from './src/core';

const storage = createStorageManager({
  baseDirectory: './data'
});

// 保存结果
await storage.saveResult(validationResult);

// 创建人工复核
let review = storage.createReview(
  validationResult.id,
  '质检工程师-张三'
);

// 添加评论
review = storage.addComment(review, {
  testCaseId: 'test-001',
  checkType: 'output_match',
  comment: '测试用例001的输出符合预期，但需要供应商确认参数配置',
  author: '张三'
});

// 完成复核
review = storage.completeReview(review, {
  approved: true,
  reason: '所有测试用例通过，插件功能符合要求',
  conditions: [
    '供应商需提供详细的性能测试报告',
    '建议增加边缘测试用例'
  ],
  recommendedAction: '建议批准上线'
});

await storage.saveReview(review);
```

### 导出报告

```typescript
import { createExporter } from './src/core';

const exporter = createExporter({
  reportTitle: 'WASM 规则插件验收报告',
  companyName: '质量控制部',
  reportVersion: '1.0.0'
});

// 导出 Markdown 报告
await exporter.saveMarkdownReport(
  './report.md',
  validationResult,
  review,
  plugin.manifest
);

// 导出 ZIP 审计包
await exporter.saveAuditPackage(
  './audit.zip',
  validationResult,
  plugin.manifest,
  review
);

// 一次性导出全部
const paths = await exporter.exportAll(
  './exports',
  validationResult,
  plugin.manifest,
  review
);

console.log(`报告路径: ${paths.reportPath}`);
console.log(`审计包路径: ${paths.auditPath}`);
```

## 核心功能说明

### 1. 插件加载验证

**功能特性：**
- 解析 manifest.json
- 验证语义化版本格式
- 检查版本兼容性
- 验证权限请求是否被允许
- 检测 WASM 文件魔数和版本

**安全特性：**
- 拒绝请求未授权权限的插件
- 限制 WASM 文件大小
- 验证 WASM 模块格式

### 2. 沙箱执行器

**安全隔离：**
- 每个执行创建独立的内存实例
- 拒绝未授权的能力访问（文件读写、网络、时钟等）
- 监控内存增长
- 超时中断

**能力权限：**
| 能力 | 说明 | 默认状态 |
|------|------|----------|
| `file_read` | 文件读取 | ❌ 禁止 |
| `file_write` | 文件写入 | ❌ 禁止 |
| `network` | 网络访问 | ❌ 禁止 |
| `clock` | 时间获取 | ⚠️ 可配置 |
| `random` | 随机数生成 | ⚠️ 可配置 |
| `environment` | 环境变量 | ❌ 禁止 |

**资源限制：**
- **超时限制**: 可配置（默认 5000ms）
- **内存限制**: 基于内存页数（默认 16 页 = 1MB）
- **执行次数**: 可配置最大执行次数

### 3. Schema 校验

**验证功能：**
- JSON Schema Draft-07 兼容
- 严格模式（不允许额外字段）
- 自定义格式验证
- 版本约束检查

**内置格式：**
- `uuid` - UUID 格式
- `iso-date` - ISO 8601 日期时间
- `semver` - 语义化版本

### 4. 批次管理

**执行流程：**
1. 输入 Schema 校验
2. 沙箱执行
3. 输出 Schema 校验
4. 版本兼容性检查
5. 输出值对比
6. 性能阈值检查

**性能监控：**
- 执行时间
- 内存使用（峰值）
- 自动重试机制

### 5. 人工复核

**复核流程：**
1. 创建复核记录
2. 添加评论（可关联测试用例）
3. 完成复核并给出结论

**复核状态：**
- `pending` - 待复核
- `in_progress` - 复核中
- `completed` - 已完成

### 6. 报告导出

**Markdown 报告包含：**
- 基本信息（插件、批次、时间）
- 验收汇总（通过率、警告数、错误数）
- 性能指标统计
- 各类检查统计
- 测试用例详情
- 人工复核结论（如有）
- 插件信息

**ZIP 审计包包含：**
- `manifest.json` - 审计包元数据
- `validation-result.json` - 完整验收结果
- `plugin-manifest.json` - 插件定义
- `human-review.json` - 人工复核（如有）
- `report.md` - Markdown 报告

## 插件 Manifest 格式说明

供应商提供的插件包必须包含 `manifest.json` 文件，格式如下：

```json
{
  "id": "quality-inspection-v1",
  "name": "产品质检规则插件",
  "version": "1.0.0",
  "description": "用于工厂生产线产品质量检测",
  "author": "供应商A - 技术团队",
  "vendor": "供应商A",
  "pluginType": "quality",
  "wasm": {
    "entrypoint": "plugin.wasm",
    "memoryPages": 4,
    "features": ["bulk-memory"]
  },
  "dependencies": [
    {
      "name": "quality-engine",
      "version": ">=1.0.0",
      "required": true,
      "type": "runtime"
    }
  ],
  "interfaces": {
    "input": {
      "format": "json",
      "schema": {
        "type": "object",
        "required": ["productId", "timestamp"],
        "properties": {...}
      }
    },
    "output": {
      "format": "json",
      "schema": {
        "type": "object",
        "required": ["result", "score"],
        "properties": {...}
      }
    }
  },
  "capabilities": [],
  "constraints": {
    "timeoutMs": 5000,
    "memoryPagesMax": 16,
    "memoryBytesMax": 1048576
  },
  "metadata": {...}
}
```

**必需字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 插件唯一标识 |
| `name` | string | 插件名称 |
| `version` | string | 语义化版本号 |
| `pluginType` | enum | 插件类型：inspection/measurement/classification/quality/custom |
| `wasm.entrypoint` | string | WASM 文件名 |
| `interfaces.input` | object | 输入接口定义 |
| `interfaces.output` | object | 输出接口定义 |
| `constraints.timeoutMs` | number | 最大执行时间（毫秒） |
| `constraints.memoryPagesMax` | number | 最大内存页数 |

## 验证流程

### 完整验证流程

```
┌─────────────────────────────────────────────────────────────┐
│                      1. 插件加载验证                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐    ┌─────────────┐    ┌───────────────────┐  │
│  │ 解析    │───▶│ 版本格式   │───▶│ 版本兼容性检查   │  │
│  │ manifest│    │ 验证       │    │ (主版本匹配)      │  │
│  └──────────┘    └─────────────┘    └───────────────────┘  │
│                                               │              │
│                                               ▼              │
│  ┌───────────────────┐    ┌─────────────────────────────┐  │
│  │ WASM 文件验证     │◀───│ 能力权限检查 (禁止越权)    │  │
│  │ 魔数/版本/大小     │    │                            │  │
│  └───────────────────┘    └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    2. 批次执行 (逐条测试用例)                 │
├─────────────────────────────────────────────────────────────┤
│  对每个测试用例执行:                                          │
│                                                              │
│  ┌────────────────┐                                          │
│  │ 输入Schema校验 │──────────────┐                           │
│  └────────────────┘              │                           │
│          │                       │                           │
│          ▼                       │                           │
│  ┌────────────────┐              │                           │
│  │ 沙箱执行       │◀───────┐    │                           │
│  │ ┌────────────┐ │        │    │                           │
│  │ │ 超时监控   │ │        │    │                           │
│  │ │ 内存监控   │ │        │    │                           │
│  │ │ 权限隔离   │ │        │    │                           │
│  │ └────────────┘ │        │    │                           │
│  └────────────────┘        │    │                           │
│          │                 │    │                           │
│          ▼                 │    │                           │
│  ┌────────────────┐        │    │                           │
│  │ 输出Schema校验 │────────┼────┘ 失败则继续下一个或终止   │
│  └────────────────┘        │                                │
│          │                 │                                │
│          ▼                 │                                │
│  ┌────────────────┐        │                                │
│  │ 版本兼容检查   │────────┤                                │
│  └────────────────┘        │                                │
│          │                 │                                │
│          ▼                 │                                │
│  ┌────────────────┐        │                                │
│  │ 输出值对比     │────────┤                                │
│  │ (与期望值比较) │        │                                │
│  └────────────────┘        │                                │
│          │                 │                                │
│          ▼                 │                                │
│  ┌────────────────┐        │                                │
│  │ 性能阈值检查   │────────┘                                │
│  │ (时间/内存)    │                                          │
│  └────────────────┘                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      3. 结果持久化                            │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 保存 BatchValidationResult (所有测试结果)            │  │
│  │  - 测试用例执行结果                                   │  │
│  │  - 各项检查结果 (schema/版本/输出/性能)              │  │
│  │  - 性能统计 (平均/最大时间, 平均/最大内存)           │  │
│  └──────────────────────────────────────────────────────┘  │
│                              │                               │
│                              ▼                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 人工复核 (可选)                                       │  │
│  │  - 工程师添加评论                                     │  │
│  │  - 关联特定测试用例/检查项                            │  │
│  │  - 最终结论 (批准/不批准)                             │  │
│  │  - 附带条件和建议                                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      4. 报告导出                              │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Markdown 报告                                         │  │
│  │  - 基本信息 (插件/批次/时间)                          │  │
│  │  - 验收汇总 (通过率/警告/错误)                        │  │
│  │  - 性能指标统计                                       │  │
│  │  - 各类检查统计                                       │  │
│  │  - 测试用例详情                                       │  │
│  │  - 人工复核结论 (如有)                                │  │
│  │  - 插件信息                                           │  │
│  └──────────────────────────────────────────────────────┘  │
│                              │                               │
│                              ▼                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ JSON/ZIP 审计包                                       │  │
│  │  - manifest.json (审计包元数据)                       │  │
│  │  - validation-result.json (完整验收结果)             │  │
│  │  - plugin-manifest.json (插件定义)                   │  │
│  │  - human-review.json (人工复核, 如有)                │  │
│  │  - report.md (Markdown 报告)                         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 安全考虑

### 沙箱隔离

本验收台使用以下安全机制隔离 WASM 插件：

1. **内存隔离**
   - 每个执行创建独立的 `WebAssembly.Memory` 实例
   - 限制最大内存页数
   - 监控内存增长尝试

2. **能力控制**
   - 默认禁止所有系统访问能力
   - 显式配置允许的能力
   - 访问时抛出异常

3. **资源限制**
   - 执行超时自动中断
   - 内存超限检测
   - 执行次数限制

### 权限策略

**默认策略（最严格）：**
```
allowedCapabilities = []
```
插件无法访问任何系统能力，只能进行纯计算。

**宽松策略（需要确认）：**
```
allowedCapabilities = ['clock', 'random']
```
允许时间和随机数访问，适合需要时间戳或随机化的算法。

**高度信任策略（不推荐）：**
```
allowedCapabilities = ['file_read', 'file_write', 'network', 'clock', 'random', 'environment']
```
完全开放权限，只适用于经过严格审计的插件。

## 常见问题

### Q: 插件加载失败提示 "Invalid WASM module"

**A:** 检查 WASM 文件是否为有效格式：
1. 确保文件是合法的 WebAssembly 模块（以 `\0asm` 魔数开头）
2. 检查版本字节是否为 `0x01 0x00 0x00 0x00`
3. 确认文件没有损坏

### Q: 如何允许插件访问时钟？

**A:** 使用 `--allow-capabilities` 参数：
```bash
npx wasm-validate load-plugin ./plugin \
  --allow-capabilities clock random
```

或在代码中：
```typescript
const plugin = await loadPlugin('./plugin', {
  allowedCapabilities: ['clock', 'random']
});
```

### Q: 如何验证插件不会访问文件系统？

**A:** 本验收台的沙箱执行器会：
1. 检查 manifest 中的 `capabilities` 字段
2. 如果请求 `file_read` 或 `file_write`，默认拒绝
3. 即使请求被允许，执行时也会记录警告

验证流程：
```bash
# 加载插件时会显示权限状态
npx wasm-validate load-plugin ./plugin
```

### Q: 性能阈值如何配置？

**A:** 通过 `validationOptions.performanceThresholds` 配置：

```typescript
const manager = await createBatchManager(plugin, {
  validationOptions: {
    performanceThresholds: {
      maxDurationMs: 1000,    // 单条执行最大 1 秒
      maxMemoryBytes: 5 * 1024 * 1024  // 最大 5MB 内存
    }
  }
});
```

### Q: 报告导出支持哪些格式？

**A:** 支持三种格式：

1. **Markdown** (`--format md`)
   - 适合人工阅读
   - 可直接打印或转换为 PDF

2. **JSON** (`--format json`)
   - 适合程序解析
   - 可导入其他系统

3. **ZIP** (`--format zip`)
   - 完整审计包
   - 包含所有相关文件和报告

## 开发

### 项目构建

```bash
# 编译 TypeScript
npm run build

# 开发模式（直接运行 TypeScript）
npm run dev -- <command>

# 例如：
npm run dev -- load-plugin ./examples/plugin
```

### 添加新测试

在 `tests/` 目录创建测试文件，使用 Jest 框架：

```typescript
import { yourFunction } from '../src/your-module';

describe('Your Module', () => {
  it('should do something', () => {
    expect(yourFunction()).toEqual(expected);
  });
});
```

运行测试：
```bash
npm test

# 监控模式
npm run test:watch
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。

---

**注意**：本验收台旨在提供安全的 WASM 插件验证环境。对于生产环境，请确保：
1. 仅加载经过审计的插件
2. 限制所有不必要的能力权限
3. 定期更新验证规则
4. 保存完整的审计记录
