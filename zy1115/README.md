# Schema Drift Checker

一个本地命令行工具，用于检查前端 mock、测试 fixture、抓包响应和 OpenAPI 文档之间的 schema 漂移问题。

## 背景

在小团队开发管理后台项目时，经常遇到以下问题：

- 接口文档写的是 `amountCents`，mock 里还是 `amount`
- 文档说 `status` 只有 `pending/paid`，抓包里多了 `refunded`
- 分页字段有的叫 `pageSize`，有的叫 `limit`
- 时间、金额、nullable、必填字段定义不一致

这些问题往往到联调时才发现，影响开发效率。`schema-drift` 工具可以在联调前自动检查这些问题。

## 功能特性

- **多数据源支持**：OpenAPI (json/yaml)、mock 目录、fixtures.json、captured-responses.jsonl
- **全面检查**：字段类型、枚举值、nullable、必填字段、分页结构、金额/时间格式
- **问题分类**：破坏性变更、mock 未同步、抓包新字段、文档缺失等
- **多格式导出**：终端摘要、Markdown、HTML、JSON
- **友好提示**：问题定位（文件/行号/JSON 路径）、修复建议
- **异常处理**：优雅处理各种异常输入

## 安装

```bash
# 克隆项目后安装依赖
npm install

# 全局链接（可选，方便在任意目录使用）
npm link
```

## 命令列表

| 命令 | 说明 |
|------|------|
| `scan` | 扫描并统计所有数据源中的 API 端点 |
| `check` | 全面检查所有数据源之间的 schema 漂移 |
| `compare` | 比较两个特定数据源之间的差异 |
| `export` | 导出检查报告为指定格式 |

## 命令详解

### scan 命令

扫描并统计所有数据源中的 API 端点。

```bash
schema-drift scan [options]
```

**选项：**
- `-o, --openapi <path>`: OpenAPI 文档路径
- `-m, --mock <dir>`: Mock 数据目录
- `-f, --fixture <path>`: Fixture JSON 文件路径
- `-c, --captured <path>`: Captured responses JSONL 文件路径
- `--ignore <path>`: 忽略规则 JSON 文件路径

**示例：**
```bash
schema-drift scan -o openapi.json -m ./mocks
schema-drift scan -o openapi.yaml -f fixtures.json -c captured.jsonl
```

### check 命令

全面检查所有数据源之间的 schema 漂移问题。

```bash
schema-drift check [options]
```

**选项：**
- `-o, --openapi <path>`: OpenAPI 文档路径
- `-m, --mock <dir>`: Mock 数据目录
- `-f, --fixture <path>`: Fixture JSON 文件路径
- `-c, --captured <path>`: Captured responses JSONL 文件路径
- `--ignore <path>`: 忽略规则 JSON 文件路径
- `--output <format>`: 输出格式: console, json, markdown, html (默认: console)
- `--out-file <path>`: 输出文件路径

**示例：**
```bash
# 基本检查
schema-drift check -o openapi.json -m ./mocks -f fixtures.json

# 导出报告
schema-drift check -o openapi.json -m ./mocks --output markdown --out-file report.md
schema-drift check -o openapi.json -m ./mocks --output html --out-file report.html
```

### compare 命令

比较两个特定数据源之间的差异。

```bash
schema-drift compare <source1> <source2> [options]
```

**参数：**
- `source1`: 第一个数据源类型 (openapi, mock, fixture, captured)
- `source2`: 第二个数据源类型 (openapi, mock, fixture, captured)

**选项：**
- `-o, --openapi <path>`: OpenAPI 文档路径
- `-m, --mock <dir>`: Mock 数据目录
- `-f, --fixture <path>`: Fixture JSON 文件路径
- `-c, --captured <path>`: Captured responses JSONL 文件路径
- `--ignore <path>`: 忽略规则 JSON 文件路径
- `--endpoint <endpoint>`: 指定要比较的端点 (格式: METHOD /path)

**示例：**
```bash
# 比较 OpenAPI 和 Mock
schema-drift compare openapi mock -o openapi.json -m ./mocks

# 比较指定端点
schema-drift compare openapi mock -o openapi.json -m ./mocks --endpoint "GET /api/users"
```

### export 命令

导出检查报告为指定格式。

```bash
schema-drift export [options]
```

**选项：**
- `-o, --openapi <path>`: OpenAPI 文档路径
- `-m, --mock <dir>`: Mock 数据目录
- `-f, --fixture <path>`: Fixture JSON 文件路径
- `-c, --captured <path>`: Captured responses JSONL 文件路径
- `--ignore <path>`: 忽略规则 JSON 文件路径
- `--format <format>`: (必需) 导出格式: json, markdown, html
- `--out <path>`: (必需) 输出文件路径

**示例：**
```bash
schema-drift export -o openapi.json -m ./mocks --format json --out report.json
schema-drift export -o openapi.json -m ./mocks --format html --out report.html
```

## 支持的检查类型

### 问题严重级别

| 级别 | 说明 | 颜色 |
|------|------|------|
| CRITICAL | 严重问题，破坏性变更 | 🔴 红 |
| HIGH | 高危问题，需要立即处理 | 🟠 红 |
| MEDIUM | 中等问题，建议处理 | 🟡 黄 |
| LOW | 低危问题，建议关注 | 🔵 蓝 |
| INFO | 信息类提示 | ⚪ 灰 |

### 问题分类

| 分类 | 说明 |
|------|------|
| `type_mismatch` | 字段类型不匹配 |
| `enum_mismatch` | 枚举值不一致 |
| `nullable_mismatch` | nullable 属性不一致 |
| `required_mismatch` | 必填字段定义不一致 |
| `pagination_mismatch` | 分页字段名称不一致 |
| `format_mismatch` | 数据格式不一致 (时间/金额等) |
| `documentation_missing` | OpenAPI 文档缺少字段定义 |
| `mock_out_of_sync` | Mock 数据未同步 |
| `new_field_in_capture` | 抓包响应中出现新字段 |
| `endpoint_missing` | 端点在某数据源中不存在 |
| `destructive_change` | 破坏性变更 |

## 数据格式要求

### OpenAPI 文档

支持 OpenAPI 3.0.x 和 3.1.x，格式可以是 JSON 或 YAML。

```json
{
  "openapi": "3.0.0",
  "info": { ... },
  "paths": {
    "/api/users": {
      "get": {
        "parameters": [...],
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": { ... }
              }
            }
          }
        }
      }
    }
  }
}
```

### Mock 数据

Mock 目录中的 JSON/JS 文件，支持以下格式：

**方式一：数组格式（推荐）**
```json
[
  {
    "method": "GET",
    "path": "/api/users",
    "response": {
      "page": 1,
      "data": [...]
    }
  }
]
```

**方式二：单对象格式**
```json
{
  "method": "GET",
  "path": "/api/users/1",
  "response": { ... }
}
```

**方式三：直接返回响应数据（路径推断）**
```json
{
  "id": 1,
  "name": "张三"
}
```

### Fixture 数据

测试 fixture 必须是数组格式：

```json
[
  {
    "name": "get_users_list",
    "method": "GET",
    "path": "/api/users",
    "params": { "page": 1 },
    "response": { ... }
  }
]
```

### Captured Responses

抓包响应必须是 JSONL (JSON Lines) 格式，每行一个 JSON 对象：

```json
{"timestamp":"2024-01-15T10:30:00Z","method":"GET","path":"/api/users","response":{...}}
{"timestamp":"2024-01-15T10:31:00Z","method":"GET","path":"/api/users/1","response":{...}}
```

### 忽略规则

可以创建一个 JSON 文件来指定忽略某些端点或字段：

```json
{
  "endpoints": [
    "GET /api/health",
    { "method": "POST", "path": "/api/webhooks/*" }
  ],
  "fields": [
    "_debug",
    "debugInfo",
    { "name": "extraField", "endpoint": "/api/users/{id}" },
    { "pattern": "^_.*" }
  ],
  "patterns": [
    "GET /api/internal/.*",
    "DELETE /api/admin/.*"
  ]
}
```

## 示例数据

项目包含两套示例数据：

### 正常样例 (`examples/normal/`)

所有数据源的 Schema 完全一致，运行检查不会发现问题。

```bash
# 测试正常样例（应该没有问题）
schema-drift check \
  -o examples/normal/openapi.json \
  -m examples/normal/mocks \
  -f examples/normal/fixtures.json \
  -c examples/normal/captured-responses.jsonl
```

### 有问题的样例 (`examples/problematic/`)

故意制造了多种 schema 漂移问题，用于演示工具的检测能力：

| 问题类型 | 具体表现 |
|---------|---------|
| 字段名不一致 | OpenAPI 用 `amountCents`，Mock 用 `amount` |
| 类型不一致 | OpenAPI 用 `integer`，Mock 用 `string` |
| 枚举不一致 | OpenAPI 枚举只有 5 个值，Mock 有 `refunded` |
| 分页字段 | OpenAPI 用 `pageSize`，Mock 用 `limit` |
| 数据字段 | OpenAPI 用 `data`，Mock 用 `items` |
| 时间格式 | OpenAPI 用 `date-time`，Mock 用 `date` |
| 额外字段 | Mock/抓包中有文档未定义的字段 |
| 必填字段 | 各数据源 required 定义不一致 |

**运行有问题的样例：**

```bash
# 检查有问题的样例
schema-drift check \
  -o examples/problematic/openapi-problematic.json \
  -m examples/problematic/mocks-problematic \
  -f examples/problematic/fixtures-problematic.json \
  -c examples/problematic/captured-responses-problematic.json

# 导出报告
schema-drift export \
  -o examples/problematic/openapi-problematic.json \
  -m examples/problematic/mocks-problematic \
  --format html \
  --out report.html
```

## 异常处理

工具会优雅处理以下异常情况：

- OpenAPI 文件格式错误或版本不支持
- Mock 目录不存在或文件格式错误
- Fixture 不是数组格式
- JSONL 某一行解析失败
- 忽略规则 JSON 格式错误

遇到异常时会输出友好的错误信息，而不是直接堆栈崩溃。

## 项目结构

```
.
├── src/
│   ├── cli/
│   │   ├── index.js           # CLI 入口
│   │   └── commands/
│   │       ├── scan.js        # scan 命令
│   │       ├── check.js       # check 命令
│   │       ├── compare.js     # compare 命令
│   │       └── export.js      # export 命令
│   ├── readers/
│   │   ├── openapi-reader.js          # OpenAPI 解析器
│   │   ├── mock-reader.js             # Mock 读取器
│   │   ├── fixture-reader.js          # Fixture 读取器
│   │   └── captured-response-reader.js # 抓包响应读取器
│   ├── comparators/
│   │   └── schema-comparator.js       # Schema 比较引擎
│   ├── reporters/
│   │   ├── console-reporter.js        # 终端报告
│   │   └── export-reporter.js         # 导出报告 (JSON/MD/HTML)
│   └── utils/
│       ├── errors.js          # 自定义错误类
│       ├── error-handler.js   # 错误处理器
│       └── ignore-rules.js    # 忽略规则处理
├── examples/
│   ├── normal/                # 正常样例数据
│   │   ├── openapi.json
│   │   ├── mocks/
│   │   ├── fixtures.json
│   │   └── captured-responses.jsonl
│   ├── problematic/           # 有问题的样例数据
│   │   ├── openapi-problematic.json
│   │   ├── mocks-problematic/
│   │   ├── fixtures-problematic.json
│   │   └── captured-responses-problematic.jsonl
│   └── ignore-rules-example.json
├── package.json
└── README.md
```

## 常见问题

**Q: 工具支持 OpenAPI 2.0 (Swagger) 吗？**

A: 目前只支持 OpenAPI 3.0.x 和 3.1.x。如果需要支持 Swagger 2.0，可以先将其转换为 OpenAPI 3.0 格式。

**Q: 如何处理路径参数（如 `/api/users/{id}`）？**

A: 工具会自动匹配路径参数。在比较时，`/api/users/1` 和 `/api/users/{id}` 会被正确识别为同一个端点。

**Q: 如何忽略某些特定的问题？**

A: 可以使用 `--ignore` 选项指定忽略规则文件，支持忽略特定端点、字段或使用正则表达式模式匹配。

## License

MIT
