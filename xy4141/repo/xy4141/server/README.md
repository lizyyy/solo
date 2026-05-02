# WASM 规则插件验收台

> 工厂质检工程师专用的本地 WebAssembly 规则插件验收平台

## 目录

- [概述](#概述)
- [核心功能](#核心功能)
- [快速开始](#快速开始)
- [验证流程](#验证流程)
- [API 文档](#api-文档)
- [Manifest 规范](#manifest-规范)
- [目录结构](#目录结构)
- [测试](#测试)

## 概述

WASM 规则插件验收台是一个专为工厂质检工程师设计的本地工具，用于验收产线供应商提供的 WebAssembly 质检规则包。解决了以下核心问题：

- **插件越权风险**: 在隔离沙箱中执行，限制文件系统访问、网络调用等危险操作
- **版本依赖问题**: 完整的版本校验和依赖管理
- **Schema 不匹配**: 严格的 JSON Schema 输入输出校验
- **性能监控**: 执行时间、内存使用、超时控制
- **人工复核**: 支持质检工程师对结果进行人工审核
- **审计导出**: 完整的 Markdown 报告和 JSON 审计包

## 核心功能

### 1. 插件加载与验证

- 解析 `manifest.json` 元数据
- 版本兼容性检查 (SemVer)
- 依赖项验证
- 权限声明审查
- WASM 魔数校验

### 2. 隔离沙箱执行

- 严格的系统调用拦截
- 禁止文件写入操作
- 禁止网络访问
- 超时控制 (默认 5 秒)
- 内存限制 (默认 64MB)

### 3. Schema 校验

- JSON Schema 输入验证
- JSON Schema 输出验证
- 期望输出对比校验
- 字段类型、格式、范围检查

### 4. 批次管理

- 创建验收批次
- 批量导入样本数据
- 逐条执行测试
- 实时进度追踪
- 执行统计报告

### 5. 人工复核

- 支持质检工程师审核每个测试结果
- 三种结论: `approved` (通过)、`rejected` (驳回)、`pending` (待定)
- 复核人签名和备注

### 6. 报告导出

- **Markdown 验收报告**: 完整的验收文档，包含所有测试结果
- **JSON 审计包**: ZIP 格式，包含元数据、样本、运行记录、复核记录、WASM 文件

## 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn

### 安装

```bash
cd server
npm install
```

### 启动服务

```bash
# 生产模式
npm start

# 开发模式 (自动重载)
npm run dev
```

服务启动后访问: `http://localhost:3000`

### 健康检查

```bash
curl http://localhost:3000/api/health
```

## 验证流程

### 完整验收流程

```
1. 导入插件
   ↓
2. 验证插件 (可选，但推荐)
   ↓
3. 创建验收批次
   ↓
4. 导入样本数据 (含期望输出)
   ↓
5. 执行批次测试
   ↓
6. 查看执行结果
   ↓
7. 人工复核 (可选)
   ↓
8. 导出验收报告
```

### 详细步骤示例

#### 步骤 1: 准备插件包

供应商需要提供:
1. `manifest.json` - 插件元数据
2. `plugin.wasm` - WebAssembly 模块

参考示例: `examples/manifest.json`

#### 步骤 2: 验证插件 (推荐)

```bash
curl -X POST http://localhost:3000/api/plugins/validate \
  -F "manifest=@examples/manifest.json" \
  -F "wasm=@path/to/your/plugin.wasm"
```

这会执行完整的验证但不会保存插件。

#### 步骤 3: 导入插件

```bash
curl -X POST http://localhost:3000/api/plugins \
  -F "manifest=@examples/manifest.json" \
  -F "wasm=@path/to/your/plugin.wasm"
```

成功后返回插件 ID，后续步骤需要使用。

#### 步骤 4: 创建验收批次

```bash
curl -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "plugin_id": "your-plugin-id-here",
    "name": "2024年5月批次验收",
    "description": "质量检查规则 v1.0.0 验收测试"
  }'
```

#### 步骤 5: 导入样本数据

使用提供的示例数据:

```bash
curl -X POST http://localhost:3000/api/batches/{batch-id}/samples/batch \
  -H "Content-Type: application/json" \
  -d @examples/samples.json
```

或者单个添加:

```bash
curl -X POST http://localhost:3000/api/batches/{batch-id}/samples \
  -H "Content-Type: application/json" \
  -d '{
    "input_data": {
      "product_id": "PRD-2024-0001",
      "dimensions": {
        "length": 100.5,
        "width": 50.0,
        "height": 25.0
      },
      "inspection_time": "2024-05-15T10:30:00Z"
    },
    "expected_output": {
      "passed": true,
      "quality_score": 95.5,
      "timestamp": "2024-05-15T10:30:01Z"
    }
  }'
```

#### 步骤 6: 执行批次测试

```bash
curl -X POST http://localhost:3000/api/batches/{batch-id}/run \
  -H "Content-Type: application/json" \
  -d '{
    "timeout_ms": 10000,
    "max_memory_mb": 128
  }'
```

这是异步操作，立即返回但测试在后台执行。

#### 步骤 7: 查看进度和结果

查看进度:
```bash
curl http://localhost:3000/api/batches/{batch-id}/progress
```

查看统计:
```bash
curl http://localhost:3000/api/batches/{batch-id}/stats
```

查看所有运行记录:
```bash
curl http://localhost:3000/api/batches/{batch-id}/runs
```

#### 步骤 8: 人工复核

```bash
curl -X POST http://localhost:3000/api/runs/{run-id}/review \
  -H "Content-Type: application/json" \
  -d '{
    "reviewer": "张工程师",
    "conclusion": "approved",
    "notes": "结果符合预期，测试通过"
  }'
```

#### 步骤 9: 导出报告

导出 Markdown 报告:
```bash
curl http://localhost:3000/api/export/{batch-id}/markdown -o report.md
```

导出 JSON 审计包 (含 WASM):
```bash
curl http://localhost:3000/api/export/{batch-id}/audit?include_wasm=true -o audit-package.zip
```

## API 文档

### 插件管理

#### GET /api/plugins
获取所有插件列表

#### GET /api/plugins/:id
获取单个插件详情

#### POST /api/plugins
导入新插件 (multipart/form-data)

**参数:**
- `manifest`: manifest.json 文件
- `wasm`: .wasm 文件

#### POST /api/plugins/validate
验证插件 (不保存)

#### DELETE /api/plugins/:id
删除插件 (必须没有关联批次)

### 批次管理

#### GET /api/batches
获取所有批次

#### GET /api/batches/:id
获取批次详情

#### POST /api/batches
创建新批次

**Body:**
```json
{
  "plugin_id": "uuid",
  "name": "批次名称",
  "description": "批次描述"
}
```

#### PUT /api/batches/:id
更新批次

#### DELETE /api/batches/:id
删除批次

### 样本管理

#### GET /api/batches/:id/samples
获取批次所有样本

#### POST /api/batches/:id/samples
添加单个样本

#### POST /api/batches/:id/samples/batch
批量添加样本

**Body:**
```json
{
  "samples": [
    {
      "input_data": { ... },
      "expected_output": { ... }
    }
  ]
}
```

### 执行控制

#### POST /api/batches/:id/run
启动批次执行 (异步)

**Body (可选):**
```json
{
  "timeout_ms": 5000,
  "max_memory_mb": 64
}
```

#### POST /api/batches/:id/cancel
取消正在执行的批次

#### GET /api/batches/:id/progress
获取执行进度

#### GET /api/batches/:id/stats
获取执行统计

#### GET /api/batches/:id/runs
获取所有运行记录

#### GET /api/runs/:id
获取单个运行记录 (含复核信息)

### 复核管理

#### POST /api/runs/:id/review
人工复核运行记录

**Body:**
```json
{
  "reviewer": "质检工程师姓名",
  "conclusion": "approved | rejected | pending",
  "notes": "复核备注"
}
```

### 导出功能

#### GET /api/export/:batchId/markdown
导出 Markdown 验收报告

#### GET /api/export/:batchId/audit
导出 JSON 审计包 (ZIP 格式)

**Query 参数:**
- `include_wasm`: 是否包含 WASM 文件 (默认 false)

### 系统监控

#### GET /api/running
获取正在运行的任务

#### GET /api/health
健康检查

## Manifest 规范

### 必需字段

| 字段 | 类型 | 描述 |
|------|------|------|
| `name` | string | 插件名称 (唯一标识) |
| `version` | string | 版本号 (SemVer 格式) |
| `entrypoint` | string | 入口函数名: `process`, `run`, `main` |

### 可选字段

| 字段 | 类型 | 描述 |
|------|------|------|
| `vendor` | string | 供应商名称 |
| `description` | string | 插件描述 |
| `permissions` | array | 权限声明 |
| `dependencies` | array | 依赖项 |
| `input_schema` | object | 输入 JSON Schema |
| `output_schema` | object | 输出 JSON Schema |
| `error_codes` | array | 错误码定义 |
| `max_memory_mb` | number | 最大内存 (默认 64) |
| `max_timeout_ms` | number | 超时时间 (默认 5000) |
| `performance_threshold_ms` | number | 性能阈值 (默认 1000) |

### 权限列表

| 权限 | 描述 | 默认允许 |
|------|------|---------|
| `read:local` | 读取本地文件 | ✅ |
| `write:local` | 写入本地文件 | ❌ |
| `network:outbound` | 网络出站连接 | ❌ |

### 示例 Manifest

```json
{
  "name": "quality-inspection-rule",
  "version": "1.0.0",
  "vendor": "QualityTech Solutions",
  "description": "产品质量自动检查规则",
  "entrypoint": "process",
  "permissions": ["read:local"],
  "dependencies": [
    {
      "name": "helper-utils",
      "version": "^2.0.0"
    }
  ],
  "input_schema": {
    "type": "object",
    "required": ["product_id", "dimensions"],
    "properties": {
      "product_id": { "type": "string" },
      "dimensions": {
        "type": "object",
        "properties": {
          "length": { "type": "number", "minimum": 0 }
        }
      }
    }
  },
  "output_schema": {
    "type": "object",
    "required": ["passed", "quality_score"],
    "properties": {
      "passed": { "type": "boolean" },
      "quality_score": { "type": "number", "minimum": 0, "maximum": 100 }
    }
  },
  "error_codes": [
    {
      "code": "Q001",
      "description": "尺寸超出公差范围",
      "category": "dimension"
    }
  ],
  "max_memory_mb": 128,
  "max_timeout_ms": 10000,
  "performance_threshold_ms": 2000
}
```

## 目录结构

```
server/
├── src/
│   ├── index.js              # 入口文件
│   ├── app.js                # Express 应用
│   ├── database.js           # 数据库连接和初始化
│   ├── models/
│   │   └── index.js          # 数据模型
│   └── services/
│       ├── schemaValidator.js  # Schema 校验服务
│       ├── pluginLoader.js     # 插件加载服务
│       ├── sandboxExecutor.js  # 沙箱执行服务
│       ├── batchRunner.js      # 批次运行服务
│       └── export.js           # 导出服务
├── tests/
│   ├── schemaValidator.test.js
│   └── pluginLoader.test.js
├── examples/
│   ├── manifest.json         # 示例 Manifest
│   └── samples.json          # 示例样本数据
├── data/                     # 运行时数据 (自动创建)
│   ├── wasm-validator.db     # SQLite 数据库
│   ├── plugins/              # 插件存储
│   └── samples/              # 样本存储
├── package.json
└── README.md
```

## 数据模型

### 实体关系

```
Plugins (1) ──→ (N) Batches (1) ──→ (N) Samples
                                      │
                                      ↓
                               Runs (N) ←──→ (1) Reviews
```

### 表结构

#### plugins
| 字段 | 类型 | 描述 |
|------|------|------|
| id | TEXT | 主键 (UUID) |
| name | TEXT | 插件名称 |
| version | TEXT | 版本号 |
| vendor | TEXT | 供应商 |
| manifest | TEXT | Manifest JSON |
| wasm_path | TEXT | WASM 文件路径 |
| input_schema | TEXT | 输入 Schema JSON |
| output_schema | TEXT | 输出 Schema JSON |
| error_codes | TEXT | 错误码 JSON |
| max_memory_mb | INTEGER | 最大内存 |
| max_timeout_ms | INTEGER | 超时时间 |
| performance_threshold_ms | INTEGER | 性能阈值 |

#### batches
| 字段 | 类型 | 描述 |
|------|------|------|
| id | TEXT | 主键 (UUID) |
| plugin_id | TEXT | 外键 - 插件 |
| name | TEXT | 批次名称 |
| sample_count | INTEGER | 样本数量 |
| status | TEXT | 状态: pending, running, completed, cancelled |

#### samples
| 字段 | 类型 | 描述 |
|------|------|------|
| id | TEXT | 主键 (UUID) |
| batch_id | TEXT | 外键 - 批次 |
| input_data | TEXT | 输入数据 JSON |
| expected_output | TEXT | 期望输出 JSON |
| order_index | INTEGER | 排序索引 |

#### runs
| 字段 | 类型 | 描述 |
|------|------|------|
| id | TEXT | 主键 (UUID) |
| batch_id | TEXT | 外键 - 批次 |
| sample_id | TEXT | 外键 - 样本 |
| plugin_id | TEXT | 外键 - 插件 |
| input_data | TEXT | 输入数据 |
| output_data | TEXT | 输出数据 |
| execution_time_ms | INTEGER | 执行时间 |
| memory_usage_mb | INTEGER | 内存使用 |
| status | TEXT | 状态: passed, failed, error, timeout |
| error_message | TEXT | 错误信息 |
| error_code | TEXT | 错误码 |
| schema_validation_passed | BOOLEAN | Schema 校验是否通过 |
| schema_errors | TEXT | Schema 错误 JSON |

#### reviews
| 字段 | 类型 | 描述 |
|------|------|------|
| id | TEXT | 主键 (UUID) |
| run_id | TEXT | 外键 - 运行 |
| reviewer | TEXT | 复核人 |
| conclusion | TEXT | 结论: approved, rejected, pending |
| notes | TEXT | 备注 |

## 测试

### 运行测试

```bash
npm test
```

### 测试覆盖

- `schemaValidator.test.js`: Schema 校验服务测试
  - Manifest 验证
  - 输入/输出 Schema 校验
  - 字段对比
  - 期望输出验证

- `pluginLoader.test.js`: 插件加载服务测试
  - 版本验证
  - 依赖验证
  - 权限验证
  - 错误码提取
  - Manifest 加载

## 状态定义

### 运行状态

| 状态 | 描述 |
|------|------|
| `pending` | 待执行 |
| `running` | 执行中 |
| `passed` | 执行成功 |
| `failed` | 执行完成但失败 |
| `error` | 执行错误 |
| `timeout` | 执行超时 |

### 批次状态

| 状态 | 描述 |
|------|------|
| `pending` | 待执行 |
| `running` | 执行中 |
| `completed` | 全部通过 |
| `completed_with_errors` | 完成但有错误 |
| `cancelled` | 已取消 |

### 复核结论

| 结论 | 描述 |
|------|------|
| `approved` | 复核通过 |
| `rejected` | 复核驳回 |
| `pending` | 待复核 |

## 安全特性

### 沙箱隔离

1. **系统调用拦截**: 所有危险的系统调用被禁止
   - 文件写入 (unlink, mkdir, rmdir, rename)
   - 文件系统访问 (stat, access)
   - 网络操作

2. **内存限制**: WASM 内存有硬限制

3. **超时控制**: 防止无限循环

4. **权限最小化**: 默认只允许读取，写入和网络被禁止

### 数据隔离

- 插件无法访问主应用内存
- 每个执行有独立的内存空间
- 输入输出通过严格的序列化/反序列化

## 常见问题

### Q: 如何准备 WASM 插件？

A: 供应商需要提供:
1. 编译好的 `.wasm` 文件
2. `manifest.json` 元数据文件

插件应导出一个入口函数 (如 `process`)，接收输入并返回输出。

### Q: 支持哪些语言编写 WASM 插件？

A: 任何能编译到 WebAssembly 的语言:
- Rust (推荐)
- C/C++
- Go
- AssemblyScript

### Q: 如何调试插件问题？

A: 查看:
1. 运行记录中的 `error_message` 和 `error_code`
2. Schema 校验错误
3. 执行时间和内存使用
4. 检查是否有越权操作被沙箱拦截

### Q: 导出的审计包包含什么？

A: ZIP 文件包含:
- `metadata.json`: 元数据
- `samples.json`: 样本数据
- `runs.json`: 运行记录
- `reviews.json`: 复核记录 (如有)
- `report.md`: Markdown 报告
- `manifest.json`: 插件 Manifest
- `plugin-{name}-{version}.wasm`: WASM 文件 (可选)

## 许可证

本项目仅供内部使用。

---

**注意**: 这是一个本地运行的工具，设计用于在安全的本地环境中验收供应商提供的 WASM 插件。所有执行都在隔离沙箱中进行，以防止恶意插件造成损害。
