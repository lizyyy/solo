# 代理规则影子测试 API

网关代理规则上线前缺少影子测试，规则一改就可能误伤已有路径。本项目提供本地可运行的"代理规则影子测试API"，帮助在上线前验证规则的正确性。

## 技术栈

- **语言**: Go 1.x
- **Web框架**: Gin
- **ORM**: GORM
- **数据库**: SQLite (本地持久化)

## 核心功能

### 数据模型

1. **代理规则 (ProxyRule)**: 定义路径匹配和重写规则
2. **样本请求 (SampleRequest)**: 生产环境的真实请求样本
3. **影子批次 (ShadowBatch)**: 一组规则的测试执行批次
4. **命中结果 (HitResult)**: 规则与样本的匹配及差异检测结果
5. **差异原因 (DiffReason)**: 详细的差异分析记录
6. **测试报告 (TestReport)**: 测试结果报告导出

### 核心规则

- ✅ **规则匹配**: 基于路径模式和HTTP方法的匹配
- ✅ **样本回放**: 用历史样本重放测试新规则
- ✅ **差异归因**: 自动检测路径重写后的预期与实际差异
- ✅ **批次确认**: 支持批量规则测试的状态管理
- ✅ **报告导出**: JSON/Markdown格式的测试报告

## 项目结构

```
.
├── cmd/
│   └── server/
│       └── main.go          # 服务入口
├── internal/
│   ├── model/
│   │   ├── model.go         # 数据模型定义
│   │   └── dto.go           # 请求/响应DTO
│   ├── storage/
│   │   └── storage.go       # SQLite持久化层
│   ├── service/
│   │   ├── service.go       # 业务逻辑层
│   │   └── service_test.go  # 单元测试
│   └── api/
│       └── handler.go       # REST API处理器
├── scripts/
│   ├── init_data.go         # 样例数据初始化
│   └── self_check.sh        # API自检脚本
├── go.mod
├── go.sum
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
go mod tidy
```

### 2. 启动服务

```bash
go run cmd/server/main.go
```

服务将在 `http://localhost:8080` 启动

### 3. 初始化样例数据 (可选)

```bash
go run scripts/init_data.go
```

### 4. 运行自检脚本

```bash
# 先启动服务，然后运行
bash scripts/self_check.sh
```

### 5. 运行单元测试

```bash
go test -v ./internal/service/...
```

## API 接口文档

### 基础路径: `/api/v1`

### 代理规则管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/rules` | 创建代理规则 |
| GET | `/rules/:id` | 查询单个规则 |
| GET | `/rules` | 分页查询规则列表 |

**创建规则示例**:
```json
{
  "name": "API网关路由-v1",
  "description": "将/api/v1/*路由到/service/v1/*",
  "path_pattern": "/api/v1/*",
  "method": "GET",
  "rewrite_to": "/service/v1/$1"
}
```

### 样本请求管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/samples` | 创建样本请求 |
| GET | `/samples/:id` | 查询单个样本 |
| GET | `/samples` | 分页查询样本列表 |

**创建样本示例**:
```json
{
  "path": "/api/v1/users",
  "method": "GET",
  "expected_path": "/service/v1/users",
  "expected_code": 200,
  "source": "production-log"
}
```

### 测试批次管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/batches` | 创建测试批次 |
| GET | `/batches/:id` | 查询单个批次 |
| GET | `/batches` | 分页查询批次列表 |
| POST | `/batches/execute` | 执行批次测试 |
| POST | `/batches/status` | 更新批次状态 |
| POST | `/batches/recalculate` | 重新计算批次 |
| GET | `/batches/:id/results` | 查询批次的命中结果 |

**创建批次示例**:
```json
{
  "name": "新规则上线前测试",
  "rule_ids": ["rule-uuid-1", "rule-uuid-2"]
}
```

**执行批次示例**:
```json
{
  "batch_id": "batch-uuid"
}
```

### 结果修正与报告

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/results/correct` | 人工修正命中结果 |
| POST | `/reports/export` | 导出测试报告 |
| GET | `/reports` | 查询报告列表 |

**人工修正示例**:
```json
{
  "result_id": "result-uuid",
  "is_corrected": true,
  "remark": "人工确认接受此差异"
}
```

**导出报告示例**:
```json
{
  "batch_id": "batch-uuid",
  "format": "json"
}
```

支持的格式: `json` (默认), `markdown`

## 使用流程示例

### 典型工作流

1. **导入样本**: 从生产日志导入真实请求作为样本
2. **配置规则**: 创建/修改待上线的代理规则
3. **创建批次**: 选择要测试的规则集合
4. **执行测试**: 运行影子测试，自动检测差异
5. **分析结果**: 查看命中结果和差异详情
6. **人工修正**: 对可以接受的差异进行人工标注
7. **导出报告**: 生成测试报告供评审
8. **确认上线**: 所有测试通过后规则可上线

## 单元测试覆盖

测试覆盖以下场景:

| 测试场景 | 说明 |
|---------|------|
| ✅ 正常流测试 | 规则创建、样本创建、批次执行的完整流程 |
| ✅ 规则匹配测试 | 路径模式、方法匹配的正确性 |
| ✅ 路径重写测试 | 重写规则的变量替换逻辑 |
| ✅ 脏数据处理 | 查询不存在的ID、异常参数处理 |
| ✅ 重复请求处理 | 重复创建的处理逻辑 |
| ✅ 人工修正测试 | 修正后的状态变更逻辑 |
| ✅ 重新计算测试 | 批次结果的重新计算功能 |
| ✅ 报告导出测试 | JSON格式报告的生成 |

## 特点

### ✅ 本地持久化

- 使用SQLite嵌入式数据库
- 无需额外部署数据库服务
- 数据文件直接保存在本地

### ✅ 清晰的REST接口

- 统一的响应格式
- 完善的分页支持
- 符合RESTful设计规范

### ✅ 异常处理完善

- 异常路径保留原始请求
- 错误处理包含详细信息
- 支持人工修正和备注

### ✅ 可重复测试

- 样例数据可重复导入
- 批次可多次执行
- 支持重新计算功能

## 响应格式

### 成功响应
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "...",
    "name": "..."
  }
}
```

### 分页响应
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "total": 100,
    "page": 1,
    "page_size": 20,
    "items": [...]
  }
}
```

### 错误响应
```json
{
  "code": 400,
  "message": "name and path_pattern are required"
}
```

## 常见问题

### Q: 如何添加新的规则匹配模式？
A: 在 `service.go` 的 `matchRule` 方法中扩展匹配逻辑。

### Q: 如何支持更多的报告格式？
A: 在 `service.go` 的 `ExportReport` 方法中添加新格式的处理逻辑。

### Q: 数据文件在哪里？
A: 默认在当前目录的 `shadow_test.db`，可在 `main.go` 中修改路径。

### Q: 如何批量导入生产请求？
A: 可调用 `/samples` 接口批量POST，或编写自定义脚本直接操作数据库。

## License

MIT
