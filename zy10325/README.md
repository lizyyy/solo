# 批量通知去重 API

一个基于 Go 实现的通知去重服务，用于防止在指定时间窗口内重复发送相同通知给同一用户。

## 功能特性

- **创建通知请求**: 提交通知并进行去重校验
- **幂等性保证**: 重复提交相同 request_id 不会产生脏数据
- **去重窗口**: 可配置的时间窗口内自动去重
- **发送凭证**: 生成一次性发送凭证，防止伪造请求
- **状态推进**: 支持更新通知发送状态
- **历史查询**: 支持按场景、状态、时间范围查询通知记录
- **跳过记录**: 详细记录被跳过的请求原因
- **统计分析**: 查看去重效果统计
- **数据导出**: 支持导出 CSV 格式的通知记录

## 快速开始

### 启动服务

```bash
# 编译
go build -o bin/api ./cmd/api

# 运行
./bin/api

# 或直接运行
go run ./cmd/api
```

服务默认在 8080 端口启动，可通过 `PORT` 环境变量修改端口。

### API 接口

#### 1. 健康检查
```bash
curl http://localhost:8080/health
```

#### 2. 创建通知请求 (去重校验)
```bash
curl -X POST http://localhost:8080/api/v1/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "req-001",
    "scene": "order_notify",
    "user": {
      "user_id": "user123",
      "device_id": "device456",
      "email": "user@example.com",
      "phone": "13800138000"
    },
    "content": "您的订单已发货",
    "dedup_window": 300
  }'
```

**响应示例 (允许发送)**:
```json
{
  "request_id": "req-001",
  "allowed": true,
  "status": "allowed",
  "credential": "cred-xxxxxx",
  "message": "notification allowed to send"
}
```

**响应示例 (被去重)**:
```json
{
  "request_id": "req-002",
  "allowed": false,
  "status": "skipped",
  "skip_reason": "duplicate_in_window",
  "message": "duplicate request found in window: original=req-001"
}
```

#### 3. 查询单条通知
```bash
curl http://localhost:8080/api/v1/notifications/req-001
```

#### 4. 更新通知状态
```bash
curl -X PUT http://localhost:8080/api/v1/notifications/req-001/status \
  -H "Content-Type: application/json" \
  -d '{"status": "sent"}'
```

支持的状态: `pending`, `allowed`, `skipped`, `sent`, `failed`

#### 5. 查询通知列表
```bash
curl "http://localhost:8080/api/v1/notifications?scene=order_notify&status=allowed&limit=10"
```

查询参数:
- `scene`: 业务场景
- `user_hash`: 用户标识哈希
- `status`: 通知状态
- `start_time`: 开始时间 (RFC3339 格式)
- `end_time`: 结束时间
- `offset`: 分页偏移
- `limit`: 每页数量

#### 6. 查询跳过记录
```bash
curl "http://localhost:8080/api/v1/skip-records?scene=order_notify"
```

#### 7. 统计数据
```bash
curl "http://localhost:8080/api/v1/statistics?scene=order_notify"
```

#### 8. 导出通知数据 (CSV)
```bash
curl "http://localhost:8080/api/v1/export/notifications?scene=order_notify" -o notifications.csv
```

#### 9. 创建业务场景配置
```bash
curl -X POST http://localhost:8080/api/v1/scenes \
  -H "Content-Type: application/json" \
  -d '{
    "scene": "order_notify",
    "description": "订单通知场景",
    "default_window": 300,
    "enabled": true
  }'
```

## 去重规则

1. **时间窗口去重**: 同一业务场景(scene) + 同一用户(user_hash)，在指定时间窗口内只允许发送一次
2. **幂等提交**: 相同 request_id 重复提交，直接返回首次处理结果，不重复入库
3. **凭证校验**: 可选的发送凭证校验机制，防止非法请求
4. **全链路追踪**: 所有被跳过的请求都会记录跳过原因和原始请求ID

## 数据持久化

使用 SQLite 数据库存储，数据库文件默认为 `dedup.db`。

数据表:
- `notification_requests`: 通知请求主表
- `send_credentials`: 发送凭证表
- `skip_records`: 跳过记录表
- `business_scenes`: 业务场景配置表
