# 环境开关防误触服务

一个基于 Go 语言开发的环境开关变更防误触服务，提供统一的后端处理链路，确保开关变更的安全性和可追溯性。

## 核心功能

### 数据对象
- **开关项 (SwitchItem)**: 管理开关的基础信息
- **环境 (Environment)**: 支持 dev/test/pre/prod 四种环境隔离
- **操作者 (Operator)**: 记录操作人信息
- **风险等级 (RiskLevel)**: low/medium/high/critical 四级风险
- **审批票 (ApprovalTicket)**: 开关变更的审批流程载体
- **变更结果 (ChangeResult)**: 记录实际执行结果
- **误触报告 (MisuseReport)**: 风险拦截记录

### 核心规则
1. **环境隔离**: 不同环境执行不同的风险策略
2. **风险拦截**: 生产环境禁止 high/critical 风险操作，预发环境禁止 critical 风险操作
3. **审批校验**: 根据风险等级要求不同数量的审批人
   - low/medium: 1人审批
   - high: 2人审批
   - critical: 3人审批
4. **变更落库**: 所有操作全量记录，支持审计追溯
5. **误触报告**: 拦截的风险操作自动生成报告

### API 接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/switch | 创建开关项 |
| POST | /api/v1/ticket | 创建审批票（支持幂等） |
| POST | /api/v1/ticket/validate | 校验审批票 |
| POST | /api/v1/ticket/approve | 审批通过 |
| POST | /api/v1/ticket/execute | 执行变更（支持幂等） |
| GET | /api/v1/ticket | 查询审批票详情 |
| GET | /api/v1/tickets | 查询历史记录列表（支持多条件筛选） |
| GET | /api/v1/result | 查询变更结果 |
| GET | /api/v1/export | 导出历史记录 |

## 技术特点

1. **幂等性保证**: 通过 idempotent_key 确保重复提交不会产生脏数据
2. **统一错误处理**: 结构化错误响应，包含错误码、消息和详情
3. **可插拔存储**: 当前使用内存存储，可轻松扩展至数据库
4. **无外部依赖**: 仅使用 gorilla/mux 进行路由，核心逻辑纯 Go 实现

## 快速开始

### 启动服务
```bash
go run cmd/server/main.go
# 或编译后执行
go build -o server cmd/server/main.go
./server
```

服务将在 `http://localhost:8080` 启动。

### 运行测试脚本
```bash
./test_api.sh
```

## 使用示例

### 1. 创建审批票
```bash
curl -X POST http://localhost:8080/api/v1/ticket \
  -H "Content-Type: application/json" \
  -d '{
    "idempotent_key": "unique_key_123",
    "switch_id": "SW001",
    "environment": "test",
    "risk_level": "low",
    "operator_id": "op001",
    "operator_name": "张三",
    "operator_email": "zhangsan@example.com",
    "change_type": "enable",
    "target_value": true,
    "reason": "功能上线测试"
  }'
```

### 2. 审批通过
```bash
curl -X POST http://localhost:8080/api/v1/ticket/approve \
  -H "Content-Type: application/json" \
  -d '{"ticket_id": "xxx", "approver_id": "admin001"}'
```

### 3. 执行变更
```bash
curl -X POST http://localhost:8080/api/v1/ticket/execute \
  -H "Content-Type: application/json" \
  -d '{"ticket_id": "xxx"}'
```

### 4. 查询历史
```bash
curl "http://localhost:8080/api/v1/tickets?page=1&page_size=10&environment=test"
```

## 项目结构
```
.
├── cmd/
│   └── server/
│       └── main.go          # 程序入口
├── internal/
│   ├── model/
│   │   └── model.go         # 数据模型定义
│   ├── store/
│   │   └── store.go         # 存储层实现
│   ├── service/
│   │   └── service.go       # 业务逻辑层
│   └── api/
│       └── handler.go       # API 处理层
├── pkg/
│   └── errors/
│       └── errors.go        # 错误定义
├── go.mod
├── go.sum
├── test_api.sh              # API 测试脚本
└── README.md
```
