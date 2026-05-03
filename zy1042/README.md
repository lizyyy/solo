# API Contract Doctor

OpenAPI 3 兼容性检查工具 - 检查 API 变更对旧客户端的影响

## 功能特性

- ✅ **版本兼容性检查**: 比较旧版和新版 OpenAPI 规范，检测破坏性变更
- ✅ **请求样例校验**: 验证真实请求样例是否符合新版规范
- ✅ **多格式输出**: 支持终端摘要、Markdown 和 JSON 报告
- ✅ **智能检测**: 识别路径/方法删除、参数变必填、类型变更、枚举收窄等问题
- ✅ **友好错误**: 清晰的错误信息，不会直接抛出堆栈
- ✅ **零依赖网络**: 纯本地工具，无需连接外网

## 安装

```bash
npm install
```

## 快速开始

```bash
# 基本用法 - 检查版本兼容性
npm run scan -- --old examples/old.yaml --new examples/new.yaml

# 带请求样例校验
npm run scan -- --old examples/old.yaml --new examples/new.yaml --samples examples/requests.json

# 导出 Markdown 报告
npm run scan -- --old examples/old.yaml --new examples/new.yaml --samples examples/requests.json --out reports/check.md

# 导出 JSON 报告
npm run scan -- --old examples/old.yaml --new examples/new.yaml --out reports/check.json

# 显示详细问题
npm run scan -- --old examples/old.yaml --new examples/new.yaml --verbose
```

## CLI 命令

### `scan` 命令

检查 OpenAPI 规范的兼容性变化。

**参数:**

| 参数 | 说明 | 示例 |
|------|------|------|
| `--old` | 旧版 OpenAPI 规范文件路径 (JSON/YAML) | `--old examples/old.yaml` |
| `--new` | 新版 OpenAPI 规范文件路径 (JSON/YAML) | `--new examples/new.yaml` |
| `--samples` | 请求样例 JSON 文件路径 | `--samples examples/requests.json` |
| `--out` | 输出报告文件路径 (.md 或 .json) | `--out reports/check.md` |
| `--format` | 输出格式 (markdown/json)，默认 markdown | `--format json` |
| `--verbose, -v` | 显示详细问题列表 | `-v` |
| `--no-exit-code` | 即使发现问题也返回 0 退出码 | `--no-exit-code` |

**退出码:**

- `0`: 未发现严重问题，或使用 `--no-exit-code`
- `1`: 发现高危/严重问题 (破坏性变更)
- `1`: 执行错误 (文件不存在、格式错误等)

## 检测的兼容性问题

### 严重级别

| 级别 | 颜色 | 说明 |
|------|------|------|
| `critical` | 🔴 红色 | 路径/方法被删除，旧客户端完全无法调用 |
| `high` | 🟠 橙色 | 参数变必填、字段变必填、类型不兼容变更、枚举值收窄等 |
| `medium` | 🟡 黄色 | 参数类型兼容变更、字段移除、额外字段限制等 |
| `low` | 🔵 蓝色 | 非关键性变更 |
| `info` | ℹ️ 灰色 | 弃用通知、未覆盖端点等提示信息 |

### 检测类别

- **路径移除 (`path_removed`)**: 旧版存在的路径在新版中被删除
- **方法移除 (`method_removed`)**: 路径仍存在但特定 HTTP 方法被删除
- **参数变必填 (`parameter_made_required`)**: 可选参数变为必填
- **参数类型变更 (`parameter_type_changed`)**: 参数的数据类型发生变化
- **参数移除 (`parameter_removed`)**: 之前存在的参数被删除
- **请求体变必填 (`request_body_made_required`)**: 请求体从可选变为必填
- **请求体字段变必填 (`request_body_field_made_required`)**: 请求体字段从可选变为必填
- **请求体字段类型变更 (`request_body_field_type_changed`)**: 请求体字段类型变化
- **响应状态码移除 (`response_status_removed`)**: 之前返回的状态码不再返回
- **响应字段移除 (`response_field_removed`)**: 响应中的字段被删除
- **响应字段类型变更 (`response_field_type_changed`)**: 响应字段类型变化
- **枚举值移除 (`enum_value_removed`)**: 枚举允许的值减少
- **安全要求变更 (`security_requirement_changed`)**: 新增或变更认证要求
- **弃用通知 (`deprecation_notice`)**: 接口被标记为弃用
- **媒体类型移除 (`media_type_removed`)**: 支持的 Content-Type 减少
- **额外字段限制 (`schema_additional_properties_removed`)**: 从允许额外字段变为禁止

## 请求样例格式

请求样例 JSON 文件包含一组真实的 API 请求，用于验证新版规范是否与现有客户端兼容。

**格式:**

```json
[
  {
    "method": "GET",
    "path": "/users/123",
    "pathParams": {
      "userId": "123"
    },
    "queryParams": {
      "page": 1,
      "limit": 10
    },
    "body": {
      "email": "user@example.com",
      "name": "John Doe"
    },
    "mediaType": "application/json",
    "description": "获取用户详情"
  }
]
```

**字段说明:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `method` | string | 是 | HTTP 方法 (GET, POST, PUT, PATCH, DELETE 等) |
| `path` | string | 是 | 请求路径 (包含实际参数值，如 `/users/123`) |
| `pathParams` | object | 否 | 路径参数的映射 (用于校验路径匹配) |
| `queryParams` | object | 否 | 查询参数 |
| `body` | object | 否 | 请求体数据 |
| `mediaType` | string | 否 | 请求体媒体类型，默认 `application/json` |
| `description` | string | 否 | 样例描述 |

## 示例文件说明

项目包含以下示例文件，可直接运行测试：

- `examples/old.yaml` - v1 版本的 OpenAPI 规范 (旧版)
- `examples/new.yaml` - v2 版本的 OpenAPI 规范 (新版，包含破坏性变更)
- `examples/requests.json` - 针对旧版规范的请求样例

**旧版 vs 新版的主要变更 (用于演示):**

| 变更类型 | 旧版 (v1) | 新版 (v2) |
|----------|-----------|-----------|
| 路径移除 | `/users/{userId}/orders` | 已删除 |
| 方法移除 | `DELETE /users/{userId}` | 已删除 |
| 参数变必填 | `page` 查询参数可选 | 变为必填 |
| 字段重命名 | `name` | `fullName` |
| 类型变更 | `age: integer` | `age: number` |
| 字段变必填 | `CreateUserRequest.phone` 可选 | 变为必填 |
| 枚举收窄 | `status: [active, inactive, pending]` | `status: [active, inactive]` |
| 响应状态码移除 | `GET /users/{userId}` 返回 404 | 不再返回 |

## 输出报告示例

### 终端摘要

```
═══════════════════════════════════════════════════════════════
              API 契约体检报告 - API Contract Doctor
═══════════════════════════════════════════════════════════════

  检查文件:
    旧版本: examples/old.yaml
    新版本: examples/new.yaml
    请求样例: examples/requests.json

  [1] 版本兼容性检查

    发现问题:
      ● 严重: 2
      ● 高危: 8
      ● 中等: 5
      ● 信息: 1

    ⚠  检测到破坏性变更！旧客户端可能无法正常工作。

  [2] 请求样例校验

    发现问题:
      ● 高危: 5
      ● 中等: 3
      ● 信息: 1

═══════════════════════════════════════════════════════════════
```

### Markdown 报告

生成的 Markdown 报告包含：

- 检查文件信息
- 版本兼容性检查概览
- 请求样例校验概览
- 详细问题列表 (每个问题包含位置、问题描述、原因分析、迁移建议)

### JSON 报告

生成的 JSON 报告可用于 CI/CD 集成或其他工具处理：

```json
{
  "meta": {
    "tool": "api-contract-doctor",
    "version": "1.0.0",
    "generatedAt": "2026-05-03T...",
    "files": {
      "old": "examples/old.yaml",
      "new": "examples/new.yaml",
      "samples": "examples/requests.json"
    }
  },
  "compatibility": {
    "summary": {
      "total": 16,
      "bySeverity": {
        "critical": 2,
        "high": 8,
        "medium": 5,
        "low": 0,
        "info": 1
      },
      "hasBreakingChanges": true,
      "hasIssues": true
    },
    "issues": [...]
  },
  "samples": {
    "summary": {...},
    "issues": [...]
  }
}
```

## CI/CD 集成

可将此工具集成到 CI/CD 流水线中，在发布新版 API 前自动检查兼容性：

```bash
# 在 CI 中运行
api-contract-doctor scan \
  --old openapi/old.yaml \
  --new openapi/new.yaml \
  --samples openapi/requests.json \
  --out reports/compatibility-check.md

# 退出码:
# - 0: 无严重问题
# - 1: 发现破坏性变更
```

**GitHub Actions 示例:**

```yaml
name: API Compatibility Check

on:
  pull_request:
    paths:
      - 'openapi/**'

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run compatibility check
        run: |
          npm run scan -- \
            --old openapi/old.yaml \
            --new openapi/new.yaml \
            --samples openapi/requests.json \
            --out reports/check.md
      
      - name: Upload report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: compatibility-report
          path: reports/
```

## 错误处理

工具提供友好的错误提示，不会直接抛出堆栈：

```
╔═══════════════════════════════════════════════════════════════╗
║                        错误                                      ║
╚═══════════════════════════════════════════════════════════════╝

  错误代码: FILE_NOT_FOUND
  错误信息: 文件不存在: examples/nonexistent.yaml
```

**常见错误:**

| 错误代码 | 说明 |
|----------|------|
| `FILE_NOT_FOUND` | 指定的文件不存在 |
| `INVALID_FORMAT` | 文件格式错误 (YAML/JSON 解析失败) |
| `INVALID_OPENAPI_VERSION` | 不支持的 OpenAPI 版本 (仅支持 3.x) |
| `INVALID_SAMPLES_FORMAT` | 请求样例格式错误 |

## 支持的 OpenAPI 版本

- OpenAPI 3.0.x
- OpenAPI 3.1.x

## 项目结构

```
api-contract-doctor/
├── src/
│   ├── cli.js              # CLI 入口
│   ├── parser.js           # OpenAPI 解析器 (JSON/YAML)
│   ├── checker.js          # 兼容性检查引擎
│   ├── sample-validator.js # 请求样例校验器
│   ├── reporter.js         # 报告生成器
│   └── errors.js           # 错误定义
├── examples/
│   ├── old.yaml            # 旧版 OpenAPI 规范示例
│   ├── new.yaml            # 新版 OpenAPI 规范示例
│   └── requests.json       # 请求样例示例
├── package.json
└── README.md
```

## License

MIT
