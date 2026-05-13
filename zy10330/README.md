# 策略规则热加载 API

## 项目简介

这是一个基于 Go 语言开发的策略规则热加载系统，提供规则版本管理、灰度发布、命中解释、快速回滚和审计日志等核心功能。

## 核心功能

- **规则热加载**: 支持动态创建和更新策略规则，无需重启服务
- **版本管理**: 完整的规则版本生命周期管理（草稿→测试→灰度→发布）
- **灰度发布**: 支持按用户、用户组、区域和百分比进行灰度控制
- **命中解释**: 提供详细的规则命中过程解释，便于排查问题
- **快速回滚**: 一键回滚到指定版本，确保系统稳定性
- **审计日志**: 所有关键操作都留下完整的审计轨迹
- **导出功能**: 导出完整的策略包数据，包含版本、命中记录和审计日志

## 项目结构

```
.
├── cmd/
│   └── main.go              # 程序入口
├── internal/
│   ├── model/
│   │   ├── model.go         # 核心数据模型
│   │   └── dto.go           # 请求/响应 DTO
│   ├── store/
│   │   └── store.go         # 数据存储层（内存存储）
│   ├── service/
│   │   └── service.go       # 业务逻辑层
│   ├── handler/
│   │   └── handler.go       # HTTP 处理器
│   └── api/
│       └── router.go          # 路由配置
├── pkg/
│   └── utils/
└── go.mod
```

## 状态流转

```
DRAFT → TESTING → GRAY → PUBLISHED → ROLLBACK
   ↓         ↓        ↓         ↓
REVOKED    REVOKED  REVOKED   REVOKED
```

## 快速开始

### 1. 安装依赖

```bash
go mod tidy
```

### 2. 启动服务

```bash
go run cmd/main.go
```

服务将在 `http://localhost:8080` 启动

### 3. 健康检查

```bash
curl http://localhost:8080/api/v1/health
```

## API 文档

### 策略包管理

#### 创建策略包
```bash
POST /api/v1/packages
Content-Type: application/json

{
  "name": "风控策略包",
  "description": "用于风险控制的策略规则集合",
  "created_by": "admin"
}
```

#### 查询策略包列表
```bash
GET /api/v1/packages
```

#### 查询单个策略包
```bash
GET /api/v1/packages/:id
```

### 规则版本管理

#### 创建规则版本
```bash
POST /api/v1/versions
Content-Type: application/json

{
  "package_id": "package-uuid",
  "version": "v1.0.0",
  "rule_content": {
    "rules": [
      {
        "id": "rule001",
        "name": "年龄检查",
        "conditions": [
          {
            "field": "age",
            "operator": "eq",
            "expected": "18"
          }
        ]
      }
    ]
  },
  "created_by": "admin",
  "remark": "初始版本"
}
```

#### 查询规则版本列表
```bash
GET /api/v1/versions?package_id=:package_id
```

#### 查询单个规则版本
```bash
GET /api/v1/versions/:id
```

#### 推进状态
```bash
POST /api/v1/versions/:id/status
Content-Type: application/json

{
  "target_status": "TESTING",
  "gray_range": {
    "percentage": 50,
    "user_ids": ["user1", "user2"],
    "regions": ["china"]
  },
  "operator": "admin",
  "remark": "进入测试阶段"
}
```

#### 回滚版本
```bash
POST /api/v1/versions/:id/rollback
Content-Type: application/json

{
  "operator": "admin",
  "remark": "发现问题，回滚"
}
```

#### 撤销版本
```bash
POST /api/v1/versions/:id/revoke
Content-Type: application/json

{
  "operator": "admin",
  "remark": "废弃此版本"
}
```

### 命中检查

#### 规则命中检查
```bash
POST /api/v1/hit
Content-Type: application/json

{
  "package_id": "package-uuid",
  "input": {
    "age": "18",
    "user_id": "user123"
  },
  "request_id": "req-001",
  "user_id": "user123"
}
```

#### 查询命中请求列表
```bash
GET /api/v1/hit/requests?package_id=:package_id
```

### 审计日志

#### 查询审计日志
```bash
GET /api/v1/audit/logs?entity_type=package&entity_id=:id
```

### 导出功能

#### 导出策略包完整数据
```bash
GET /api/v1/export?package_id=:package_id
```

## 数据模型说明

### StrategyPackage（策略包）
- `id`: 唯一标识
- `name`: 策略包名称
- `description`: 描述
- `created_at`: 创建时间
- `updated_at`: 更新时间
- `created_by`: 创建人

### RuleVersion（规则版本）
- `id`: 唯一标识
- `package_id`: 所属策略包ID
- `version`: 版本号
- `rule_content`: 规则内容
- `status`: 状态（DRAFT/TESTING/GRAY/PUBLISHED/ROLLBACK/REVOKED）
- `gray_range`: 灰度范围配置
- `rollback_point`: 回滚点快照
- `created_at`: 创建时间
- `updated_at`: 更新时间
- `created_by`: 创建人
- `remark`: 备注

### HitRequest（命中请求）
- `id`: 唯一标识
- `request_id`: 请求ID（幂等
- `package_id`: 策略包ID
- `version_id`: 版本ID
- `input`: 请求输入
- `hit_result`: 命中结果
- `hit_rules`: 命中的规则列表
- `explanation`: 命中解释
- `created_at`: 创建时间
- `user_id`: 用户ID

### AuditLog（审计日志）
- `id`: 唯一标识
- `entity_type`: 实体类型（package/version）
- `entity_id`: 实体ID
- `action`: 操作类型
- `before`: 操作前状态
- `after`: 操作后状态
- `operator`: 操作人
- `operated_at`: 操作时间
- `remark`: 备注

## 核心特性说明

### 1. 幂等性保证
- 重复提交相同的 `request_id` 不会产生脏数据
- 版本号在同一个策略包内唯一

### 2. 灰度发布策略
支持多种灰度维度：
- `user_ids`: 指定用户ID列表
- `user_groups`: 指定用户组
- `percentage`: 流量百分比
- `regions`: 指定区域

### 3. 审计追踪
所有关键操作都会记录审计日志，包括：
- 状态变更历史
- 操作人信息
- 变更前后对比
- 时间戳

### 4. 导出数据
导出结果包含：
- 策略包基本信息
- 所有版本历史
- 命中请求记录
- 完整审计日志
- 统计摘要信息

## 扩展说明

当前实现使用内存存储，生产环境可以扩展为：
- Redis 缓存
- MySQL/PostgreSQL 持久化存储
- 添加持久化层

## 许可证

MIT License
