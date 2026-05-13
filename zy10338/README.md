# 客户端能力协商 API

一个完整的客户端能力协商服务，用于管理客户端能力声明、版本协商、降级策略和状态追踪。

## 核心功能

### 1. 客户端标识管理
- 客户端注册与信息管理
- 支持多种客户端类型（Android、iOS、Web、Desktop、Server）
- 记录创建人和创建时间

### 2. 能力声明管理
- 声明客户端支持的 API 版本
- 配置具体能力项（名称、版本、是否支持）
- 支持降级选项配置（按优先级排序）

### 3. 版本协商
- 自动版本兼容性检查
- 匹配最佳能力集
- 协商失败时自动触发降级流程

### 4. 状态追踪
- 完整的状态流转记录
- 支持状态：PENDING → SUCCESS / FAILED / FALLBACK / CANCELLED
- 记录每次状态变更的操作人和原因

### 5. 防脏数据机制
- 防止重复提交协商请求
- Declaration ID 唯一性约束

### 6. 命中日志
- 记录每次协商结果的查询命中情况
- 缓存命中统计
- 响应时间监控

## 技术栈

- **语言**: Go 1.21+
- **Web 框架**: Gin
- **数据库**: SQLite (GORM ORM)
- **缓存**: go-cache
- **前端**: 原生 HTML + JavaScript

## 项目结构

```
├── cmd/
│   └── server/
│       └── main.go         # 服务入口
├── internal/
│   ├── model/              # 数据模型
│   │   └── model.go
│   ├── storage/            # 数据存储层
│   │   └── sqlite.go
│   ├── service/            # 业务逻辑层
│   │   └── negotiation.go
│   └── handler/            # HTTP 处理器
│       └── http.go
├── static/
│   └── index.html          # 管理页面
├── go.mod
└── go.sum
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

服务默认运行在 `http://localhost:8080`

### 3. 访问管理页面

打开浏览器访问 `http://localhost:8080`，即可使用图形化管理界面。

## API 文档

### 客户端管理

#### 创建客户端
```http
POST /api/v1/clients
Content-Type: application/json

{
    "client_id": "client_android_v1",
    "client_name": "Android 客户端",
    "client_type": "android",
    "created_by": "admin",
    "description": "Android 主客户端"
}
```

#### 查询客户端列表
```http
GET /api/v1/clients
```

#### 查询单个客户端
```http
GET /api/v1/clients/{client_id}
```

### 能力声明

#### 创建能力声明
```http
POST /api/v1/declarations
Content-Type: application/json

{
    "client_id": "client_android_v1",
    "api_version": "2.1.0",
    "declared_by": "admin",
    "capabilities": [
        {
            "name": "push_notification",
            "version": "1.0.0",
            "supported": true
        },
        {
            "name": "live_stream",
            "version": "2.0.0",
            "supported": true
        }
    ],
    "fallback_opts": [
        {
            "id": "basic_mode",
            "name": "基础模式",
            "description": "使用基础功能",
            "priority": 1
        }
    ]
}
```

#### 查询声明详情
```http
GET /api/v1/declarations/{id}
```

#### 查询客户端的所有声明
```http
GET /api/v1/clients/{client_id}/declarations
```

### 协商管理

#### 发起协商
```http
POST /api/v1/declarations/{declaration_id}/negotiate
Content-Type: application/json

{
    "declaration_id": "uuid",
    "negotiated_by": "system",
    "target_version": "2.0.0"  # 可选，不填则使用声明版本
}
```

**响应状态说明：**
- `SUCCESS`: 协商成功
- `FALLBACK`: 协商失败，使用降级方案
- `FAILED`: 协商失败，无降级方案可用
- `409 Conflict`: 重复提交，防止脏数据

#### 查询协商结果
```http
GET /api/v1/negotiations/{id}
```

#### 查询协商列表
```http
GET /api/v1/negotiations?client_id=xxx&status=SUCCESS&limit=10
```

#### 更新协商状态
```http
POST /api/v1/negotiations/{id}/status
Content-Type: application/json

{
    "result_id": "uuid",
    "target_status": "CANCELLED",
    "updated_by": "admin",
    "reason": "客户端请求取消",
    "error_message": ""
}
```

#### 查询状态流转历史
```http
GET /api/v1/negotiations/{id}/transitions
```

#### 验证协商结果
```http
GET /api/v1/negotiations/verify/{client_id}/{declaration_id}
```

### 命中日志

#### 查询协商结果的命中日志
```http
GET /api/v1/negotiations/{id}/hitlogs
```

#### 查询客户端的命中日志
```http
GET /api/v1/clients/{client_id}/hitlogs
```

## 数据模型

### 客户端身份 (ClientIdentity)
| 字段 | 类型 | 说明 |
|------|------|------|
| client_id | string | 客户端唯一标识 |
| client_name | string | 客户端名称 |
| client_type | string | 客户端类型 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |
| created_by | string | 创建人 |
| description | string | 描述 |

### 能力声明 (CapabilityDeclaration)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 声明 UUID |
| client_id | string | 客户端 ID |
| api_version | string | 声明的 API 版本 |
| capabilities | array | 能力列表 |
| fallback_opts | array | 降级选项 |
| declared_at | datetime | 声明时间 |
| declared_by | string | 声明人 |
| expires_at | datetime | 过期时间 |

### 协商结果 (NegotiationResult)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 结果 UUID |
| client_id | string | 客户端 ID |
| declaration_id | string | 声明 ID（唯一） |
| api_version | string | 声明版本 |
| negotiated_version | string | 协商后的版本 |
| status | string | 协商状态 |
| selected_capabilities | array | 选中的能力列表 |
| selected_fallback | object | 选中的降级方案 |
| negotiated_at | datetime | 协商时间 |
| negotiated_by | string | 协商人 |
| error_message | string | 错误信息 |

### 状态流转 (StatusTransition)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 流转记录 ID |
| result_id | string | 协商结果 ID |
| from_status | string | 源状态 |
| to_status | string | 目标状态 |
| transitioned_at | datetime | 流转时间 |
| transitioned_by | string | 操作人 |
| reason | string | 变更原因 |

### 命中日志 (HitLog)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 日志 ID |
| result_id | string | 协商结果 ID |
| client_id | string | 客户端 ID |
| hit_time | datetime | 命中时间 |
| hit_source | string | 命中来源 |
| request_context | string | 请求上下文 |
| cache_hit | bool | 是否缓存命中 |
| response_time_ms | int | 响应时间(ms) |

## 状态流转规则

```
PENDING ──┬──> SUCCESS
          ├──> FAILED
          ├──> FALLBACK
          └──> CANCELLED

SUCCESS ──┬──> CANCELLED
          └──> FAILED

FAILED ──┬──> PENDING (重试)
         └──> FALLBACK

FALLBACK ─┬──> SUCCESS
          └──> CANCELLED

CANCELLED ──> PENDING (重新发起)
```

## 使用示例

### 成功流程示例

1. 创建客户端
2. 创建能力声明（包含支持的能力和降级选项）
3. 发起协商，获得 SUCCESS 状态
4. 重复提交协商请求，系统返回 409 防止脏数据
5. 查看命中日志和状态流转历史

### 异常流程示例

1. 创建客户端和声明
2. 使用不兼容的目标版本发起协商
3. 系统自动使用降级方案，状态为 FALLBACK
4. 手动更新状态，测试合法和非法流转

### 降级流程示例

1. 创建不包含支持能力的声明
2. 发起协商，协商失败
3. 如果配置了降级选项，自动进入 FALLBACK 状态
4. 如果未配置降级选项，进入 FAILED 状态

## 持久化说明

- 使用 SQLite 数据库存储所有数据
- 数据文件默认为 `./negotiation.db`
- 服务重启后所有状态数据保持完整
- 可通过环境变量 `DB_PATH` 指定数据库路径

## 环境变量

- `PORT`: 服务端口，默认 8080
- `DB_PATH`: SQLite 数据库路径，默认 `./negotiation.db`

## 管理界面功能

管理界面提供以下功能：

1. **概览页**: 系统功能介绍和快速操作
2. **客户端管理**: 创建、查看客户端列表
3. **能力声明**: 创建能力声明，配置能力和降级选项
4. **协商管理**: 发起协商、查看协商记录、更新状态、查看流转历史和命中日志
5. **使用示例**: 内置三个自动化演示流程（成功流、问题流、状态流转）

## 测试

```bash
# 运行测试
go test ./...

# 运行测试并显示覆盖率
go test ./... -cover
```

## 常见问题

**Q: 如何防止重复协商？**
A: 每个 Declaration ID 只能创建一个协商结果，重复提交会返回 409 Conflict 错误。

**Q: 缓存有效期是多久？**
A: 默认 5 分钟，可在 service 层配置。

**Q: 如何自定义状态流转规则？**
A: 在 `internal/service/negotiation.go` 中修改 `isValidStatusTransition` 函数。

**Q: 支持哪些数据库？**
A: 目前默认使用 SQLite，可通过替换 storage 层适配其他数据库。

## 许可证

MIT
