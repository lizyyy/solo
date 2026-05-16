# Push Token Lifecycle API

一个本地可运行的推送 Token 生命周期管理 API，帮助运营追踪推送失败原因，区分 Token 失效、设备换绑、退订等场景。

## 技术栈

- **语言**: Go
- **数据库**: SQLite (本地持久化)
- **路由**: gorilla/mux

## 核心功能

### Token 状态机
- `ACTIVE`: 活跃可用
- `INACTIVE`: 不活跃
- `EXPIRED`: Token 失效
- `UNSUBSCRIBED`: 用户退订
- `REBOUND`: 设备换绑

### 核心规则
1. **设备换绑检测**: 同一 Token 绑定不同用户/设备时，自动标记为 REBOUND
2. **退订拦截**: 用户退订后自动更新 Token 状态，拦截后续推送
3. **失败归因**: 根据推送回执自动归因失败原因，更新 Token 状态
4. **生命周期报告**: 生成 Token 完整生命周期报告，支持 CSV 导出

## API 接口

### 基础路径
```
http://localhost:8080/api/v1
```

### 1. Token 绑定
```http
POST /tokens/bind
Content-Type: application/json

{
  "token": "device_push_token",
  "user_id": "user_123",
  "device_id": "device_456",
  "platform": "iOS",
  "device_name": "iPhone 15",
  "app_version": "1.0.0",
  "os_version": "17.0"
}
```

### 2. 推送回执上报
```http
POST /push-receipts
Content-Type: application/json

{
  "push_id": "push_001",
  "token": "device_push_token",
  "success": false,
  "failure_reason": "INVALID_TOKEN",
  "error_message": "Token is no longer valid",
  "raw_response": "{'error': 'InvalidRegistration'}",
  "sent_at": "2024-01-01T00:00:00Z"
}
```

失败原因枚举:
- `INVALID_TOKEN`: Token 无效
- `UNREGISTERED`: 设备未注册
- `MISMATCHED`: 不匹配
- `RATE_LIMIT`: 频率限制
- `UNKNOWN`: 未知

### 3. 用户退订
```http
POST /tokens/{tokenID}/unsubscribe
Content-Type: application/json

{
  "reason": "User requested opt-out",
  "channel": "in_app"
}
```

### 4. 人工修正状态
```http
POST /tokens/correction
Content-Type: application/json

{
  "token_id": "token_uuid",
  "new_status": "ACTIVE",
  "reason": "User resubscribed",
  "operator_id": "admin_001"
}
```

### 5. 查询 Token 信息
```http
GET /tokens/{tokenID}
GET /tokens/lookup?token=device_push_token
GET /tokens?user_id=user_123
```

### 6. 获取 Token 生命周期详情
```http
GET /tokens/{tokenID}/details
```
返回内容: Token 基本信息 + 绑定历史 + 退订事件 + 推送回执

### 7. 生成生命周期报告
```http
POST /tokens/{tokenID}/report
```

### 8. 查询报告列表
```http
GET /reports?start_time=2024-01-01T00:00:00Z&end_time=2024-01-31T23:59:59Z
```

### 9. 导出报告 CSV
```http
GET /reports/export?start_time=2024-01-01T00:00:00Z
```

## 快速开始

### 1. 启动服务
```bash
# 默认端口 8080，数据库 push_token_lifecycle.db
go run cmd/server/main.go

# 自定义配置
PORT=8080 DB_PATH=./data.db go run cmd/server/main.go
```

### 2. 运行自检脚本
```bash
# 先启动服务，然后在另一个终端运行
go run test/self_check.go
```

自检脚本覆盖:
- ✅ 正常流程（绑定、推送成功、推送失败）
- ✅ 设备换绑、用户换绑
- ✅ 退订流程
- ✅ 人工修正
- ✅ 脏数据处理
- ✅ 重复请求幂等性
- ✅ 报告生成

## 数据模型

### 设备 (Device)
- 设备唯一标识、用户关联、平台信息、版本信息
- 创建时间、更新时间

### 推送 Token (PushToken)
- Token 字符串、关联用户、关联设备
- 状态、绑定次数、最后绑定时间
- 最后推送时间、过期时间
- 创建时间、更新时间

### 绑定事件 (BindEvent)
- Token ID、用户 ID、设备 ID
- 之前的用户/设备 ID（用于换绑追踪）
- 绑定类型（INITIAL/REBIND/DEVICE_CHANGE/USER_CHANGE）
- 创建时间

### 退订事件 (UnsubscribeEvent)
- Token ID、用户 ID、设备 ID
- 退订原因、退订渠道
- 创建时间

### 推送回执 (PushReceipt)
- Token ID、推送 ID
- 成功/失败标记、失败原因、错误信息
- 原始响应（用于排查问题）
- 发送时间、接收时间、创建时间

### 生命周期报告 (LifecycleReport)
- Token 基本信息、状态
- 绑定总次数、推送总次数、成功/失败次数
- 最后失败时间、最后失败原因
- 是否退订、是否换绑
- 报告生成时间

## 典型使用场景

### 场景 1: 推送失败归因
1. 推送服务收到厂商返回的 `InvalidRegistration` 错误
2. 调用 `POST /push-receipts` 上报回执
3. API 自动将 Token 状态更新为 `EXPIRED`
4. 运营查看报告即可知道失败原因为 Token 失效

### 场景 2: 用户换设备登录
1. 用户在新设备登录，调用 `POST /tokens/bind`
2. 检测到同一 Token 绑定了新设备，自动记录换绑事件
3. Token 状态更新为 `REBOUND`（如果用户变化）
4. 运营查看报告可追踪设备换绑历史

### 场景 3: 用户退订推送
1. 用户在 APP 内关闭推送，调用 `POST /tokens/{id}/unsubscribe`
2. Token 状态更新为 `UNSUBSCRIBED`
3. 推送服务可提前拦截对该 Token 的推送，减少无效请求

### 场景 4: 人工修正误判
1. 运营发现某 Token 被误判为失效
2. 调用 `POST /tokens/correction` 将状态改回 `ACTIVE`
3. 系统保留操作记录，可追踪操作人、原因等

## 目录结构

```
.
├── cmd/
│   └── server/
│       └── main.go          # 主程序入口
├── internal/
│   ├── model/
│   │   └── model.go         # 数据模型定义
│   ├── service/
│   │   └── lifecycle.go     # 业务逻辑服务
│   ├── storage/
│   │   ├── storage.go       # 存储接口定义
│   │   └── sqlite.go        # SQLite 实现
│   └── handler/
│       └── http.go          # HTTP 处理器
├── test/
│   └── self_check.go        # 自检脚本
├── go.mod
├── go.sum
└── README.md
```

## 注意事项

1. **本地运行**: 本服务设计为本地运行，SQLite 数据库文件默认保存在当前目录
2. **幂等性**: Token 绑定接口是幂等的，重复调用不会产生问题
3. **异常处理**: 所有接口都会保留原始输入和处理结果，便于问题排查
4. **扩展性**: 存储层为接口设计，可方便替换为 MySQL、PostgreSQL 等
