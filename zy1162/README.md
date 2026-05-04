# 红包活动后端API服务

一个完整的红包活动后端API服务，支持创建红包活动、锁定预算、拆包、用户领取、支付回调、风控管理、账本流水和审计导出。

## 功能特性

- **红包活动管理**：创建、查询、管理红包活动
- **预算锁定**：锁定预算并拆分成具体红包
- **智能拆包**：支持随机金额和固定金额两种拆包规则
- **领取幂等**：通过request_id确保同一请求不会重复领取
- **防重复领取**：同一用户在同一活动只能领取一个红包
- **模拟支付**：支持支付回调处理
- **失败重试**：失败的领取请求支持重试补偿
- **风控管理**：支持活动/红包的冻结和解冻
- **账本流水**：完整的资金流水记录
- **审计日志**：所有关键操作都有审计记录

## 技术栈

- **语言**: Python 3.8+
- **框架**: FastAPI
- **ORM**: SQLAlchemy 2.0
- **数据库**: SQLite (可切换为PostgreSQL/MySQL)
- **数据验证**: Pydantic

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI应用入口
│   ├── config.py            # 配置管理
│   ├── database.py          # 数据库连接
│   ├── models.py            # 数据模型
│   ├── schemas.py           # Pydantic模型
│   ├── services.py          # 业务逻辑
│   └── routers.py           # API路由
├── seed.py                  # 种子数据脚本
├── requirements.txt         # 依赖文件
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化数据库和种子数据

```bash
python seed.py
```

### 3. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问:
- API文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

## API 端点

### 活动管理

#### 创建红包活动
```bash
curl -X POST "http://localhost:8000/api/v1/activities" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "新年红包活动",
    "description": "春节红包大派送",
    "total_amount": 500.0,
    "total_count": 100,
    "merchant_id": "merchant_001",
    "merchant_name": "测试商家",
    "rule_type": "random"
  }'
```

#### 锁定预算
```bash
curl -X POST "http://localhost:8000/api/v1/activities/lock-budget" \
  -H "Content-Type: application/json" \
  -d '{
    "activity_id": "act_xxx",
    "merchant_id": "merchant_001"
  }'
```

#### 查询活动详情
```bash
curl "http://localhost:8000/api/v1/activities/act_seed_001"
```

#### 列出活动
```bash
curl "http://localhost:8000/api/v1/activities?merchant_id=merchant_001&page=1&page_size=10"
```

### 红包领取

#### 领取红包（幂等）
```bash
curl -X POST "http://localhost:8000/api/v1/activities/claim" \
  -H "Content-Type: application/json" \
  -d '{
    "activity_id": "act_seed_002",
    "user_id": "user_002",
    "user_name": "测试用户2",
    "request_id": "req_20260504_001"
  }'
```

### 支付回调

#### 模拟支付成功回调
```bash
curl -X POST "http://localhost:8000/api/v1/payments/callback" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_id": "pay_xxx",
    "status": "success",
    "external_order_id": "ext_123456"
  }'
```

#### 模拟支付失败回调
```bash
curl -X POST "http://localhost:8000/api/v1/payments/callback" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_id": "pay_xxx",
    "status": "failed"
  }'
```

### 风控管理

#### 冻结活动
```bash
curl -X POST "http://localhost:8000/api/v1/risk/action" \
  -H "Content-Type: application/json" \
  -d '{
    "activity_id": "act_seed_002",
    "merchant_id": "merchant_001",
    "action": "freeze",
    "reason": "检测到异常领取行为"
  }'
```

#### 解冻活动
```bash
curl -X POST "http://localhost:8000/api/v1/risk/action" \
  -H "Content-Type: application/json" \
  -d '{
    "activity_id": "act_seed_002",
    "merchant_id": "merchant_001",
    "action": "unfreeze",
    "reason": "风控复核通过"
  }'
```

### 重试补偿

#### 重试失败的领取
```bash
curl -X POST "http://localhost:8000/api/v1/retry-failed-claims?activity_id=act_seed_002"
```

### 账本流水

#### 查询账本流水
```bash
curl "http://localhost:8000/api/v1/ledger/transactions?merchant_id=merchant_001"
```

### 审计导出

#### 导出审计日志
```bash
curl -X POST "http://localhost:8000/api/v1/audit/export" \
  -H "Content-Type: application/json" \
  -d '{
    "merchant_id": "merchant_001",
    "start_time": "2026-05-01T00:00:00",
    "end_time": "2026-05-10T23:59:59"
  }'
```

## 异常样例

### 1. 参数验证错误
```bash
curl -X POST "http://localhost:8000/api/v1/activities" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "",
    "total_amount": -100,
    "total_count": 0
  }'
```
返回状态码 422，包含详细的验证错误信息。

### 2. 活动不存在
```bash
curl "http://localhost:8000/api/v1/activities/act_not_exist"
```
返回状态码 404，"Activity not found"。

### 3. 重复领取
```bash
# 同一用户在同一活动领取第二次
curl -X POST "http://localhost:8000/api/v1/activities/claim" \
  -H "Content-Type: application/json" \
  -d '{
    "activity_id": "act_seed_002",
    "user_id": "user_001",
    "request_id": "req_duplicate_001"
  }'
```
返回 is_success: false，错误信息 "User has already claimed a packet in this activity"。

### 4. 幂等重试
```bash
# 使用相同的request_id多次调用
curl -X POST "http://localhost:8000/api/v1/activities/claim" \
  -H "Content-Type: application/json" \
  -d '{
    "activity_id": "act_seed_002",
    "user_id": "user_003",
    "request_id": "req_same_id_001"
  }'
```
多次调用返回相同结果，不会重复处理。

### 5. 活动未激活
```bash
# DRAFT状态的活动无法领取
curl -X POST "http://localhost:8000/api/v1/activities/claim" \
  -H "Content-Type: application/json" \
  -d '{
    "activity_id": "act_seed_001",
    "user_id": "user_004",
    "request_id": "req_draft_001"
  }'
```
返回 is_success: false，错误信息 "Activity not active: draft"。

### 6. 活动已冻结
```bash
# 冻结状态的活动无法领取
curl -X POST "http://localhost:8000/api/v1/activities/claim" \
  -H "Content-Type: application/json" \
  -d '{
    "activity_id": "act_frozen_001",
    "user_id": "user_005",
    "request_id": "req_frozen_001"
  }'
```
返回 is_success: false，错误信息 "Activity not active: frozen"。

### 7. 红包已抢完
```bash
# 所有红包都被领取后
curl -X POST "http://localhost:8000/api/v1/activities/claim" \
  -H "Content-Type: application/json" \
  -d '{
    "activity_id": "act_completed_001",
    "user_id": "user_006",
    "request_id": "req_empty_001"
  }'
```
返回 is_success: false，错误信息 "No available packets"。

## 数据模型

### 红包活动状态
- `draft`: 草稿
- `pending_payment`: 等待支付
- `active`: 活动中
- `completed`: 已完成
- `cancelled`: 已取消
- `frozen`: 已冻结

### 红包状态
- `pending`: 待领取
- `locked`: 已锁定
- `claimed`: 已领取
- `expired`: 已过期
- `frozen`: 已冻结

### 交易类型
- `recharge`: 充值
- `create_packet`: 创建红包
- `claim_packet`: 领取红包
- `refund`: 退款
- `frozen`: 冻结
- `unfrozen`: 解冻

## 运行测试

```bash
pytest tests/ -v
```

## 配置

环境变量配置：
- `DATABASE_URL`: 数据库连接字符串 (默认: sqlite:///./red_packet.db)
- `DEBUG`: 调试模式 (默认: True)
- `SECRET_KEY`: 密钥
- `MAX_RETRY_COUNT`: 最大重试次数 (默认: 3)
- `RETRY_INTERVAL_SECONDS`: 重试间隔 (默认: 5秒)

## 注意事项

1. **幂等性**: 所有领取操作需要使用唯一的 `request_id`，确保重试不会重复领取
2. **并发安全**: 使用数据库行级锁 (`with_for_update`) 确保红包领取的原子性
3. **风控机制**: 支持活动级别的冻结和解冻，可用于应对异常情况
4. **审计追踪**: 所有关键操作都有审计日志，便于问题排查

## 扩展建议

1. 接入真实支付网关
2. 添加Redis缓存优化热点数据
3. 实现消息队列异步处理
4. 添加监控和告警
5. 实现更复杂的风控规则
6. 添加用户限额控制
