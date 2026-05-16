# 消费者归属 API

解决消息队列被多个团队消费后，某个消费者卡住时找不到明确负责人的问题。

## 技术栈

- Go 1.21+
- Gin Web 框架
- GORM + SQLite (本地持久化)

## 快速开始

### 1. 下载依赖

```bash
go mod tidy
```

### 2. 初始化样例数据

```bash
go run scripts/init_sample_data.go
```

### 3. 启动服务

```bash
go run cmd/main.go
```

服务默认启动在 `http://localhost:8080`

可选环境变量:
- `PORT`: 服务端口 (默认 8080)
- `DB_PATH`: 数据库文件路径 (默认 data/consumer_ownership.db)

## API 接口文档

### 1. 消费者登记 (POST /api/v1/consumers)

登记消费者，支持幂等调用。

```bash
curl -X POST http://localhost:8080/api/v1/consumers \
  -H "Content-Type: application/json" \
  -d '{
    "queue_name": "order_created",
    "consumer_group": "log-service",
    "process_scope": "日志收集、审计记录",
    "owner": "孙八",
    "owner_email": "sunba@example.com"
  }'
```

### 2. 查询消费者列表 (GET /api/v1/consumers)

支持按队列、消费者组、负责人、状态筛选。

```bash
# 查询所有
curl http://localhost:8080/api/v1/consumers

# 按队列筛选
curl "http://localhost:8080/api/v1/consumers?queue_name=order_created"

# 按负责人筛选
curl "http://localhost:8080/api/v1/consumers?owner=张三"

# 分页查询
curl "http://localhost:8080/api/v1/consumers?page=1&page_size=10"
```

### 3. 查询单个消费者 (GET /api/v1/consumers/:id)

```bash
curl http://localhost:8080/api/v1/consumers/1
```

### 4. 状态推进 (PUT /api/v1/consumers/status)

更新消费者状态 (active/inactive/pending)。

```bash
curl -X PUT http://localhost:8080/api/v1/consumers/status \
  -H "Content-Type: application/json" \
  -d '{
    "consumer_id": 5,
    "status": "active"
  }'
```

### 5. 负责人转移 (POST /api/v1/consumers/transfer)

转移消费者负责人，自动记录交接历史。

```bash
curl -X POST http://localhost:8080/api/v1/consumers/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "consumer_id": 1,
    "to_owner": "周九",
    "to_email": "zhoujiu@example.com",
    "transfer_reason": "团队调整，支付模块移交"
  }'
```

### 6. 查询交接记录 (GET /api/v1/consumers/:id/transfers)

```bash
curl http://localhost:8080/api/v1/consumers/1/transfers
```

### 7. 人工修正 (POST /api/v1/consumers/manual-fix)

管理员手动修正消费者信息。

```bash
curl -X POST http://localhost:8080/api/v1/consumers/manual-fix \
  -H "Content-Type: application/json" \
  -d '{
    "consumer_id": 1,
    "process_scope": "支付处理、订单状态更新、退款处理",
    "fix_reason": "业务范围扩展"
  }'
```

### 8. 生成归属报告 (POST /api/v1/reports)

```bash
# 生成全量报告
curl -X POST http://localhost:8080/api/v1/reports \
  -H "Content-Type: application/json" \
  -d '{}'

# 按队列生成报告
curl -X POST http://localhost:8080/api/v1/reports \
  -H "Content-Type: application/json" \
  -d '{"queue_name": "order_created"}'
```

### 9. 查询报告列表 (GET /api/v1/reports)

```bash
curl http://localhost:8080/api/v1/reports
```

### 10. 导出 CSV (GET /api/v1/exports/csv)

```bash
curl -O http://localhost:8080/api/v1/exports/csv
```

### 11. 查询异常记录 (GET /api/v1/errors)

```bash
# 查询所有异常
curl http://localhost:8080/api/v1/errors

# 查询未处理异常
curl "http://localhost:8080/api/v1/errors?handled=false"
```

### 12. 标记异常处理完成 (POST /api/v1/errors/resolve)

```bash
curl -X POST http://localhost:8080/api/v1/errors/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "error_record_id": 1,
    "conclusion": "已联系相关负责人处理",
    "handled": true
  }'
```

## 核心规则演示

### 被规则拦住的路径：处理范围冲突

当尝试登记一个与现有消费者处理范围重叠的消费者时，会被规则拦截：

```bash
# 尝试登记与现有范围冲突的消费者
curl -X POST http://localhost:8080/api/v1/consumers \
  -H "Content-Type: application/json" \
  -d '{
    "queue_name": "order_created",
    "consumer_group": "another-payment-service",
    "process_scope": "支付处理",
    "owner": "冲突测试",
    "owner_email": "conflict@example.com"
  }'
```

预期返回（HTTP 409 Conflict）：
```json
{
  "code": 409,
  "message": "处理范围冲突: 支付处理 已由 张三(payment-service) 负责",
  "data": null
}
```

此时异常会被自动记录到错误记录表中，可通过查询异常接口查看。

### 幂等性演示

重复调用相同的登记请求，不会重复创建：

```bash
# 第一次调用
curl -X POST http://localhost:8080/api/v1/consumers \
  -H "Content-Type: application/json" \
  -d '{
    "queue_name": "order_created",
    "consumer_group": "test-service",
    "process_scope": "测试范围",
    "owner": "测试",
    "owner_email": "test@example.com"
  }'

# 第二次调用（相同参数），返回已存在的记录，不会报错
curl -X POST http://localhost:8080/api/v1/consumers \
  -H "Content-Type: application/json" \
  -d '{
    "queue_name": "order_created",
    "consumer_group": "test-service",
    "process_scope": "测试范围",
    "owner": "测试",
    "owner_email": "test@example.com"
  }'
```

## 数据模型

### Consumer (消费者)
- `id`: 主键
- `queue_name`: 队列名称
- `consumer_group`: 消费者组
- `process_scope`: 处理范围
- `owner`: 负责人
- `owner_email`: 负责人邮箱
- `status`: 状态 (active/inactive/pending)
- `created_at`: 创建时间
- `updated_at`: 更新时间

### TransferRecord (交接记录)
- `id`: 主键
- `consumer_id`: 消费者ID
- `from_owner`: 原负责人
- `to_owner`: 新负责人
- `transfer_reason`: 交接原因
- `transferred_at`: 交接时间

### OwnershipReport (归属报告)
- `id`: 主键
- `report_date`: 报告日期
- `queue_name`: 队列名称
- `total_consumers`: 消费者总数
- `active_consumers`: 活跃消费者数
- `owner_count`: 负责人数量
- `conflict_count`: 冲突数量

### ErrorRecord (异常记录)
- `id`: 主键
- `request_path`: 请求路径
- `request_method`: 请求方法
- `raw_input`: 原始输入
- `error_msg`: 错误信息
- `conclusion`: 处理结论
- `handled`: 是否已处理

## 项目结构

```
.
├── cmd/
│   └── main.go              # 程序入口
├── internal/
│   ├── model/
│   │   ├── model.go         # 数据模型
│   │   └── dto.go           # 请求/响应DTO
│   ├── repository/
│   ├── service/
│   │   └── consumer.go      # 业务逻辑
│   └── handler/
│       └── handler.go       # HTTP处理器
├── pkg/
│   └── database/
│       └── database.go      # 数据库操作
├── scripts/
│   └── init_sample_data.go  # 样例数据初始化
├── data/                    # 数据库文件目录
├── go.mod
└── README.md
```
