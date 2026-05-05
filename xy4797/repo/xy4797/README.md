# Go 代码质量扫描器

一个用于 Go 项目代码质量检查的后端 API 服务，支持扫描 go.mod、源码文件，检查多种代码质量问题。

## 功能特性

- **包依赖分析**：解析 go.mod 文件，分析项目依赖
- **跨层导入检查**：检测 handler/service/repository 层之间的违规导入
- **错误处理检查**：检测裸返回 error、未处理的错误
- **TODO 技术债**：检测过期的 TODO/FIXME 注释
- **SQLite 存储**：所有扫描结果持久化存储
- **历史查询**：支持查询所有扫描记录
- **误报标记**：支持人工标记误报
- **报告导出**：支持导出 Markdown 和 JSON 格式报告

## 快速开始

### 环境要求

- Go 1.21+

### 安装依赖

```bash
go mod tidy
```

### 启动服务

```bash
go run cmd/server/main.go
```

服务默认运行在 `http://localhost:8080`

## API 端点

### 健康检查

```bash
curl http://localhost:8080/health
```

**响应示例：**
```json
{
  "service": "go-quality-scanner",
  "status": "healthy"
}
```

### 提交扫描任务

```bash
curl -X POST http://localhost:8080/api/v1/scans \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-project",
    "path": "'"$(pwd)/test_project"'"
  }'
```

**正常响应（202 Accepted）：**
```json
{
  "message": "scan submitted successfully",
  "project_name": "test-project",
  "scan_id": 1,
  "status": "running"
}
```

**异常响应 - 路径不存在（400 Bad Request）：**
```bash
curl -X POST http://localhost:8080/api/v1/scans \
  -H "Content-Type: application/json" \
  -d '{
    "name": "nonexistent",
    "path": "/nonexistent/path"
  }'
```

**响应：**
```json
{
  "error": "project path not found",
  "message": "The specified project path does not exist"
}
```

**异常响应 - 不是 Go 项目（400 Bad Request）：**
```bash
mkdir -p /tmp/not-a-go-project
curl -X POST http://localhost:8080/api/v1/scans \
  -H "Content-Type: application/json" \
  -d '{
    "name": "not-go-project",
    "path": "/tmp/not-a-go-project"
  }'
```

**响应：**
```json
{
  "error": "not a Go project",
  "message": "go.mod file not found in project directory"
}
```

### 查询扫描状态

```bash
curl http://localhost:8080/api/v1/scans/1/status
```

**响应示例：**
```json
{
  "created_at": "2026-05-05T10:00:00Z",
  "error_msg": "",
  "project_name": "test-project",
  "project_path": "/path/to/test_project",
  "scan_id": 1,
  "status": "completed",
  "updated_at": "2026-05-05T10:00:01Z"
}
```

**异常响应 - 扫描不存在（404 Not Found）：**
```bash
curl http://localhost:8080/api/v1/scans/999/status
```

**响应：**
```json
{
  "error": "scan not found",
  "message": "scan record not found: record not found"
}
```

### 获取扫描结果

等待几秒让扫描完成后，获取完整结果：

```bash
curl http://localhost:8080/api/v1/scans/1
```

**响应示例（节选）：**
```json
{
  "id": 1,
  "project_name": "test-project",
  "status": "completed",
  "scan_result": {
    "issues": [
      {
        "id": 1,
        "rule_type": "cross_layer_import",
        "severity": "high",
        "file": "handler/user_handler.go",
        "line": 7,
        "message": "Layer 'handler' cannot import 'test-project/repository'..."
      },
      {
        "id": 2,
        "rule_type": "bare_return_error",
        "severity": "medium",
        "file": "handler/user_handler.go",
        "line": 20,
        "message": "Bare error return detected: 'return err'..."
      },
      {
        "id": 3,
        "rule_type": "expired_todo",
        "severity": "medium",
        "file": "handler/user_handler.go",
        "line": 13,
        "message": "TODO with date found..."
      }
    ],
    "summary": {
      "total_issues": 15,
      "high_issues": 2,
      "medium_issues": 8,
      "low_issues": 5
    }
  }
}
```

### 获取所有扫描记录

```bash
curl http://localhost:8080/api/v1/scans
```

**响应示例：**
```json
{
  "total": 2,
  "scans": [
    {
      "id": 2,
      "project_name": "test-project",
      "status": "completed",
      "created_at": "2026-05-05T10:05:00Z"
    },
    {
      "id": 1,
      "project_name": "test-project",
      "status": "completed",
      "created_at": "2026-05-05T10:00:00Z"
    }
  ]
}
```

### 标记误报

```bash
curl -X POST http://localhost:8080/api/v1/issues/1/false-positive \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "这是一个特殊场景，repository 层的导入是有意为之的设计"
  }'
```

**响应示例：**
```json
{
  "false_positive_reason": "这是一个特殊场景，repository 层的导入是有意为之的设计",
  "is_false_positive": true,
  "issue_id": 1,
  "message": "marked as false positive"
}
```

**异常响应 - 问题不存在（404 Not Found）：**
```bash
curl -X POST http://localhost:8080/api/v1/issues/999/false-positive \
  -H "Content-Type: application/json" \
  -d '{"reason": "test"}'
```

**响应：**
```json
{
  "error": "issue not found",
  "message": "issue not found: record not found"
}
```

### 标记问题已解决

```bash
curl -X POST http://localhost:8080/api/v1/issues/2/resolve
```

**响应示例：**
```json
{
  "issue_id": 2,
  "message": "issue resolved",
  "resolved": true,
  "resolved_at": "2026-05-05T10:10:00Z"
}
```

### 导出 JSON 报告

```bash
curl http://localhost:8080/api/v1/scans/1/export?format=json -o report.json
```

或者直接查看：
```bash
curl http://localhost:8080/api/v1/scans/1/export?format=json
```

### 导出 Markdown 报告

```bash
curl http://localhost:8080/api/v1/scans/1/export?format=markdown -o report.md
```

### 带过滤条件的导出

只导出高危和严重问题，排除误报：

```bash
curl "http://localhost:8080/api/v1/scans/1/export?format=json&severity=critical,high&exclude_false_positive=true"
```

## 扫描规则说明

### 1. 跨层导入检查 (cross_layer_import)

**严重程度**: high

**检查规则**:
- handler 层只能导入 service 层，不能直接导入 repository 层
- service 层可以导入 repository 和 model 层，不能导入 handler 层
- repository 层只能导入 model 层，不能导入 handler 和 service 层

### 2. 裸返回错误 (bare_return_error)

**严重程度**: medium

**检查规则**:
- 检测直接 `return err` 而不包装的情况
- 建议使用 `fmt.Errorf("context: %w", err)` 包装错误

### 3. 未处理错误 (unhandled_error)

**严重程度**: high/low

**检查规则**:
- 检测使用 `_ = someFunc()` 显式忽略错误
- 启发式检测可能返回错误但未处理的函数调用

### 4. 过期 TODO (expired_todo)

**严重程度**: medium

**检查规则**:
- 检测代码中的 TODO、FIXME、HACK 注释
- 超过 30 天的 TODO 标记为潜在问题

### 5. 测试缺口 (test_coverage)

**严重程度**: medium

**检查规则**:
- 检测测试覆盖率低于阈值的包
- 默认阈值：70%

## 配置说明

规则配置位于 `config/rules.yaml`，可以根据项目需求自定义：

```yaml
rules:
  cross_layer_import:
    enabled: true
    severity: high
    layers:
      - name: "handler"
        path_pattern: "handler"
        allowed_imports: ["service"]
        forbidden_imports: ["repository"]
  # ... 其他规则
```

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| PORT | 服务端口 | 8080 |
| CONFIG_PATH | 配置文件路径 | ./config/rules.yaml |
| DB_PATH | SQLite 数据库路径 | ./data/scanner.db |

## 完整使用流程示例

```bash
# 1. 启动服务
go run cmd/server/main.go &

# 2. 提交扫描
SCAN_ID=$(curl -s -X POST http://localhost:8080/api/v1/scans \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-project",
    "path": "'"$(pwd)/test_project"'"
  }' | python3 -c "import sys,json; print(json.load(sys.stdin)['scan_id'])")

echo "扫描 ID: $SCAN_ID"

# 3. 等待扫描完成
sleep 2

# 4. 查看扫描状态
curl http://localhost:8080/api/v1/scans/$SCAN_ID/status

# 5. 获取详细结果
curl http://localhost:8080/api/v1/scans/$SCAN_ID

# 6. 导出 JSON 报告
curl "http://localhost:8080/api/v1/scans/$SCAN_ID/export?format=json" > report.json

# 7. 导出 Markdown 报告
curl "http://localhost:8080/api/v1/scans/$SCAN_ID/export?format=markdown" > report.md

# 8. 标记某个问题为误报
curl -X POST http://localhost:8080/api/v1/issues/1/false-positive \
  -H "Content-Type: application/json" \
  -d '{"reason": "业务特殊场景，需要直接访问repository"}'

# 9. 查看所有扫描记录
curl http://localhost:8080/api/v1/scans
```

## 项目结构

```
.
├── cmd/
│   └── server/
│       └── main.go          # 主入口文件
├── config/
│   └── rules.yaml           # 扫描规则配置
├── internal/
│   ├── config/
│   │   └── config.go        # 配置加载
│   ├── database/
│   │   └── database.go      # 数据库连接
│   ├── exporter/
│   │   └── exporter.go      # 报告导出
│   ├── handler/
│   │   └── handler.go       # API 处理器
│   ├── models/
│   │   └── models.go        # 数据模型
│   └── scanner/
│       ├── gomod.go         # go.mod 解析
│       ├── service.go       # 扫描服务
│       └── source.go        # 源码扫描
├── test_project/            # 测试项目（包含各种问题）
│   ├── go.mod
│   ├── handler/
│   ├── service/
│   └── repository/
├── go.mod
└── README.md
```

## 许可证

MIT License
