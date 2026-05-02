# OpenAPI 合约漂移回放台

一个本地工具，用于检测 OpenAPI 合约与实际接口调用之间的漂移问题。

## 功能特性

- 📄 **合约解析**：支持 OpenAPI 3.0 规格文档（YAML/JSON 格式）
- 📊 **请求回放**：导入 JSONL 格式的接口调用日志
- 🎭 **Mock 对比**：支持导入 Mock 响应进行对比分析
- 🔍 **漂移检测**：
  - 响应字段缺失/新增
  - 类型不匹配
  - 枚举变更（违规/新增/移除）
  - Nullable 误用
  - 非 nullable 字段返回 null
  - Mock 覆盖但真实响应缺字段
  - 必填字段缺失
- 🚦 **版本冲突检测**：同一路径多版本共存检测
- 🔑 **OperationId 缺失检测**：自动生成并建议正确命名
- 📋 **报告导出**：支持导出 JSON 和 Markdown 格式报告

## 项目结构

```
.
├── backend/                    # Node.js 后端服务
│   ├── src/
│   │   ├── parser/            # 解析器模块
│   │   │   └── index.js       # OpenAPI & JSONL 解析器
│   │   ├── contract-index/    # 合约索引模块
│   │   │   └── index.js       # 操作索引、路径匹配、版本检测
│   │   ├── diff-rules/        # 差异检测规则模块
│   │   │   └── index.js       # 10+ 检测规则
│   │   ├── report-exporter/   # 报告导出模块
│   │   │   └── index.js       # JSON & Markdown 导出
│   │   ├── test/              # 测试模块
│   │   │   └── parser.test.js # 解析器单元测试
│   │   └── server.js          # Express 服务入口
│   └── package.json
├── frontend/                   # Vite + Vue 3 前端
│   ├── src/
│   │   ├── App.vue            # 主应用组件
│   │   ├── main.js            # 入口文件
│   │   └── style.css          # 全局样式
│   ├── vite.config.js         # Vite 配置
│   └── package.json
├── samples/                    # 示例数据
│   ├── openapi.yaml           # 示例 OpenAPI 合约
│   ├── api-calls.jsonl        # 示例接口调用日志
│   └── mock-responses.json    # 示例 Mock 响应
├── package.json               # 根目录配置
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装后端和前端依赖（通过 workspaces）
# 会自动安装 backend 和 frontend 的依赖
```

### 2. 启动服务

#### 方式一：同时启动前后端（推荐）

```bash
npm run dev
```

这会同时启动：
- 后端服务：http://localhost:3001
- 前端服务：http://localhost:5173

#### 方式二：分别启动

```bash
# 仅启动后端
npm run dev:backend

# 仅启动前端
npm run dev:frontend
```

### 3. 使用示例数据测试

打开浏览器访问 http://localhost:5173，按以下步骤操作：

1. **上传 OpenAPI 合约**：选择 `samples/openapi.yaml`
2. **上传接口调用日志**：选择 `samples/api-calls.jsonl`
3. **（可选）上传 Mock 响应**：选择 `samples/mock-responses.json`
4. **点击「开始分析」**

### 4. 查看结果

分析完成后，你可以看到：

- **问题列表**：所有检测到的合约漂移问题
- **版本冲突**：同一路径多版本共存的情况
- **缺失 operationId**：建议添加明确的 operationId
- **未匹配请求**：无法与合约匹配的请求
- **完整报告**：可导出为 JSON 或 Markdown

### 5. 运行测试

```bash
npm run test
```

## API 接口

### POST /api/analyze

执行合约漂移分析。

**请求体：**
```json
{
  "openapiContent": "string - OpenAPI YAML/JSON 内容",
  "jsonlContent": "string - JSONL 格式的接口调用日志",
  "mockContent": "string (可选) - JSON 格式的 Mock 响应"
}
```

**响应：**
```json
{
  "success": true,
  "specInfo": { "title": "...", "version": "..." },
  "issues": [...],
  "versionConflicts": [...],
  "missingOperationIds": [...],
  "unmatchedRequests": [...],
  "summary": {
    "totalRequests": 10,
    "totalIssues": 15,
    "errorCount": 5,
    "warningCount": 8,
    "infoCount": 2
  },
  "reports": {
    "json": { ... },
    "markdown": "# 报告内容..."
  }
}
```

### GET /api/report/json

下载 JSON 格式报告。

### GET /api/report/markdown

下载 Markdown 格式报告。

## 检测规则说明

| 规则 ID | 名称 | 严重程度 | 说明 |
|---------|------|----------|------|
| field_missing_in_response | 响应字段缺失 | error | 响应中缺少合约定义的字段 |
| field_added_in_response | 响应新增字段 | warning | 响应中出现合约未定义的字段 |
| type_mismatch | 类型不匹配 | error | 字段实际类型与合约定义不符 |
| enum_violation | 枚举违规 | error | 字段值不在枚举范围内 |
| enum_added | 枚举新增值 | info | 响应中出现合约未定义的枚举值 |
| enum_removed | 枚举移除值 | warning | 合约定义的枚举值在响应中未出现 |
| nullable_misuse | Nullable 误用 | error | 字段标记为 nullable 但实际从未返回 null |
| null_in_non_nullable | 非 nullable 字段返回 null | error | 非 nullable 字段返回了 null 值 |
| mock_coverage_missing_field | Mock 覆盖但真实响应缺字段 | warning | Mock 数据包含某字段但真实响应缺失 |
| required_field_missing | 必填字段缺失 | error | 合约标记为 required 的字段缺失 |

## 数据格式说明

### JSONL 接口调用日志格式

每行一个 JSON 对象，包含请求和响应信息：

```json
{
  "timestamp": "2024-01-15T10:00:00Z",
  "request": {
    "method": "GET",
    "url": "/api/users/123",
    "headers": { "Content-Type": "application/json" },
    "body": { ... },
    "query": { "page": 1 }
  },
  "response": {
    "status": 200,
    "headers": { ... },
    "body": { "id": 123, "name": "张三" }
  },
  "mockResponse": {
    "status": 200,
    "body": { "id": 999, "name": "Mock User" }
  }
}
```

支持的字段别名：
- `request` 可使用 `req`
- `response` 可使用 `res`
- `body` 可使用 `data`

### Mock 响应格式

```json
[
  {
    "path": "/api/users/{id}",
    "method": "GET",
    "status": 200,
    "body": {
      "id": 123,
      "name": "Mock User"
    }
  }
]
```

## 构建生产版本

```bash
# 构建前端
npm run build
```

构建产物位于 `frontend/dist/` 目录。

## 注意事项

1. **路径匹配**：系统会自动匹配请求 URL 与 OpenAPI 路径模板（支持路径参数如 `{id}`）
2. **版本检测**：支持 `/v1/`、`/api/v2/`、`/2024-01-01/` 等版本格式
3. **OperationId**：如果 OpenAPI 中未定义 operationId，系统会自动生成一个
4. **Schema 解析**：支持 `$ref` 引用解析，会自动查找 `#/components/schemas/` 中的定义

## 许可证

MIT
