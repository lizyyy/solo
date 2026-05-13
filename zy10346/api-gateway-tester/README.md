# API 网关路由试算器

一个用于测试和验证 API 网关路由规则的后端服务。

## 功能特性

- **上游服务管理**：创建和管理后端服务
- **路由规则管理**：定义带有匹配条件和优先级的路由规则
- **请求样本管理**：创建和管理用于测试的 HTTP 请求样本
- **路由试算**：模拟请求匹配过程，验证路由规则是否按预期工作
- **冲突检测**：自动检测路由规则之间的优先级冲突
- **规则解释**：详细解释路由规则如何匹配特定请求
- **历史记录**：保存所有试算结果，支持分页查询和导出
- **幂等性保证**：通过幂等键防止重复提交产生脏数据

## 技术栈

- Go 1.x
- SQLite (持久化存储)
- GORM (ORM)
- Gorilla Mux (路由)

## 快速开始

### 构建并运行

```bash
go build -o api-gateway-tester ./cmd/server
./api-gateway-tester
```

服务将在 `http://localhost:8080` 启动。

## API 文档

### 健康检查

```
GET /api/v1/health
```

### 上游服务

#### 创建上游服务

```
POST /api/v1/upstreams
Content-Type: application/json

{
  "name": "user-service",
  "host": "user.example.com",
  "port": 8080,
  "weight": 100
}
```

#### 获取上游服务列表

```
GET /api/v1/upstreams
```

#### 获取单个上游服务

```
GET /api/v1/upstreams/{id}
```

### 路由规则

#### 创建路由规则

```
POST /api/v1/rules
Content-Type: application/json

{
  "name": "api-v2-rules",
  "description": "Routes for API v2 endpoints",
  "priority": 100,
  "enabled": true,
  "conditions": [
    {
      "type": "path",
      "operator": "starts_with",
      "value": "/api/v2"
    },
    {
      "type": "method",
      "operator": "equals",
      "value": "GET"
    }
  ],
  "upstream_id": "upstream-uuid-here"
}
```

**条件类型 (type)**:
- `path`: 匹配请求路径
- `method`: 匹配 HTTP 方法
- `header`: 匹配请求头
- `query`: 匹配查询参数

**操作符 (operator)**:
- `equals`: 精确匹配
- `contains`: 包含匹配
- `starts_with`: 前缀匹配
- `ends_with`: 后缀匹配
- `regex`: 正则表达式匹配

#### 获取路由规则列表

```
GET /api/v1/rules
```

#### 获取单个路由规则

```
GET /api/v1/rules/{id}
```

### 请求样本

#### 创建请求样本

```
POST /api/v1/samples
Content-Type: application/json

{
  "name": "test-api-v2-request",
  "method": "GET",
  "path": "/api/v2/users",
  "headers": {
    "X-API-Version": "2.0",
    "Authorization": "Bearer token"
  },
  "query": {
    "page": "1",
    "limit": "10"
  }
}
```

#### 获取请求样本列表

```
GET /api/v1/samples
```

#### 获取单个请求样本

```
GET /api/v1/samples/{id}
```

### 路由试算

#### 开始试算

```
POST /api/v1/trials
Content-Type: application/json

{
  "idempotency_key": "trial-2024-01-15-001",
  "request_sample_id": "sample-uuid-here",
  "rule_ids": ["rule-uuid-1", "rule-uuid-2"]
}
```

**注意**: 
- `idempotency_key` 用于保证幂等性，相同的 key 重复提交会返回第一次的结果
- `rule_ids` 可选，不提供时会测试所有启用的规则

#### 获取试算结果

```
GET /api/v1/trials/{id}
```

#### 查询试算历史

```
GET /api/v1/trials?status=completed&page=1&page_size=10
```

**查询参数**:
- `status`: 按状态过滤 (pending, running, completed, failed)
- `page`: 页码 (默认 1)
- `page_size`: 每页数量 (默认 10, 最大 100)

### 规则解释

#### 解释规则匹配

```
POST /api/v1/rules/{id}/explain
Content-Type: application/json

{
  "sample_id": "sample-uuid-here"
}
```

### 数据导出

#### 导出试算记录

```
POST /api/v1/export
Content-Type: application/json

{
  "format": "json",
  "trial_ids": ["trial-uuid-1", "trial-uuid-2"]
}
```

**格式选项**:
- `json`: JSON 格式
- `csv`: CSV 格式（会自动下载文件）

## 错误响应格式

```json
{
  "code": "Bad Request",
  "message": "Validation failed",
  "details": "详细错误信息"
}
```

## 核心算法

### 路由匹配

1. 按优先级从高到低排序规则
2. 对每个规则检查所有匹配条件
3. 全部条件满足则匹配成功
4. 相同优先级时选择匹配分数高的规则

### 冲突检测

检测具有相同优先级的规则，可能导致不确定的路由行为。

## 项目结构

```
api-gateway-tester/
├── cmd/
│   └── server/
│       └── main.go          # 主入口
├── internal/
│   ├── config/              # 配置
│   ├── model/               # 数据模型和 DTO
│   ├── repository/          # 数据访问层
│   ├── service/             # 业务逻辑层
│   └── handler/             # HTTP 处理器
├── go.mod
├── go.sum
└── README.md
```
