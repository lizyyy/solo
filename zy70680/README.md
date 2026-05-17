# 支付订单补建补偿券处理留痕后端API

## 项目简介

处理小程序支付成功但订单未生成的补偿流程，提供统一的入口和留痕机制。

## 技术栈

- Python 3.9+
- FastAPI
- SQLAlchemy
- SQLite
- pytest

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py              # 应用入口
│   ├── database.py          # 数据库配置
│   ├── models.py            # 数据模型
│   ├── schemas.py           # Pydantic模式
│   ├── crud.py              # 业务逻辑
│   └── api/
│       ├── __init__.py
│       ├── base_data.py     # 基础数据接口
│       └── compensation.py  # 补偿流程接口
├── tests/
│   └── test_compensation.py # 测试用例
├── init_data.py             # 造数脚本
├── requirements.txt         # 依赖包
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问:
- API文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

### 3. 造数

```bash
python init_data.py
```

将创建测试数据：
- 2个用户
- 1个处理人
- 1张补偿券
- 3条支付流水

## 核心功能

### 状态机流转

```
PENDING → MATCHING → ORDER_CREATED → COMPENSATING → COMPLETED
   ↓          ↓            ↓              ↓
REJECTED   REJECTED     REJECTED       REJECTED
   ↓
CLOSED
WITHDRAWN (终态)
```

### 幂等处理

- 同一支付流水只能创建一条补偿记录
- 重复创建返回已存在的记录（状态码409）

## API接口示例

### 主流程（Curl示例）

#### 1. 创建补偿记录
```bash
curl -X POST "http://localhost:8000/api/v1/records" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "PAY20240101001",
    "user_id": "USER001",
    "handler_id": "ADMIN001",
    "reason": "支付成功但订单未生成"
  }'
```

#### 2. 查询补偿记录
```bash
curl "http://localhost:8000/api/v1/records/COMPXXXXXXXXXXXXXX"
```

#### 3. 推进状态 - 匹配中
```bash
curl -X PUT "http://localhost:8000/api/v1/records/COMPXXXXXXXXXXXXXX/status?new_status=MATCHING&handler_id=ADMIN001"
```

#### 4. 匹配订单（自动补建）
```bash
curl -X POST "http://localhost:8000/api/v1/records/COMPXXXXXXXXXXXXXX/match-order?handler_id=ADMIN001"
```

#### 5. 推进状态 - 补偿中
```bash
curl -X PUT "http://localhost:8000/api/v1/records/COMPXXXXXXXXXXXXXX/status?new_status=COMPENSATING&handler_id=ADMIN001&reason=发放5元无门槛券"
```

#### 6. 人工修正（关联补偿券）
```bash
curl -X PUT "http://localhost:8000/api/v1/records/COMPXXXXXXXXXXXXXX/correct?handler_id=ADMIN001" \
  -H "Content-Type: application/json" \
  -d '{
    "voucher_id": 1,
    "compensation_amount": 5.0,
    "compensation_type": "VOUCHER"
  }'
```

#### 7. 推进状态 - 完成
```bash
curl -X PUT "http://localhost:8000/api/v1/records/COMPXXXXXXXXXXXXXX/status?new_status=COMPLETED&handler_id=ADMIN001&conclusion=补偿券已发放"
```

#### 8. 导出报告
```bash
curl -X POST "http://localhost:8000/api/v1/records/COMPXXXXXXXXXXXXXX/report?exported_by=ADMIN001"
```

#### 9. 查看操作日志
```bash
curl "http://localhost:8000/api/v1/records/COMPXXXXXXXXXXXXXX/logs"
```

### 冲突路径示例

#### 重复创建记录（幂等测试）
```bash
# 第一次创建 - 成功
curl -X POST "http://localhost:8000/api/v1/records" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "PAY20240101001",
    "user_id": "USER001",
    "handler_id": "ADMIN001"
  }'

# 第二次创建 - 返回409冲突
curl -X POST "http://localhost:8000/api/v1/records" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "PAY20240101001",
    "user_id": "USER001",
    "handler_id": "ADMIN001"
  }'
```

#### 非法状态流转（状态机测试）
```bash
# 从 PENDING 直接到 COMPLETED - 返回400错误
curl -X PUT "http://localhost:8000/api/v1/records/COMPXXXXXXXXXXXXXX/status?new_status=COMPLETED&handler_id=ADMIN001"
```

#### 撤回记录
```bash
curl -X PUT "http://localhost:8000/api/v1/records/COMPXXXXXXXXXXXXXX/withdraw?handler_id=ADMIN001&reason=用户已退款无需补偿"
```

#### 关闭记录
```bash
curl -X PUT "http://localhost:8000/api/v1/records/COMPXXXXXXXXXXXXXX/close?handler_id=ADMIN001&reason=超时未处理自动关闭"
```

### 基础数据接口

```bash
# 创建用户
curl -X POST "http://localhost:8000/api/v1/users" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "USER001", "user_name": "张三", "phone": "13800138000"}'

# 创建处理人
curl -X POST "http://localhost:8000/api/v1/handlers" \
  -H "Content-Type: application/json" \
  -d '{"handler_id": "ADMIN001", "handler_name": "客服小王", "department": "客服部"}'

# 创建支付流水
curl -X POST "http://localhost:8000/api/v1/transactions" \
  -H "Content-Type: application/json" \
  -d '{"transaction_id": "PAY20240101001", "user_id": "USER001", "amount": 99.9, "pay_channel": "WECHAT", "pay_status": "SUCCESS"}'

# 创建补偿券
curl -X POST "http://localhost:8000/api/v1/vouchers" \
  -H "Content-Type: application/json" \
  -d '{"voucher_code": "VOUCHER001", "amount": 5.0, "valid_days": 30}'
```

## 测试

### 运行pytest测试

```bash
pytest tests/test_compensation.py -v
```

### 测试覆盖项

- ✅ 基础数据创建测试
- ✅ 补偿记录完整流程测试
- ✅ 幂等性测试（重复创建）
- ✅ 状态机流转测试
- ✅ 非法状态流转测试
- ✅ 人工修正测试
- ✅ 撤回和关闭测试
- ✅ 报告导出测试
- ✅ 操作日志测试

## 数据模型

### 核心实体

1. **UserAccount** - 用户账号
2. **PaymentTransaction** - 支付流水
3. **OrderDraft** - 订单草稿
4. **Handler** - 处理人
5. **CompensationVoucher** - 补偿券
6. **CompensationRecord** - 补偿记录（核心）
7. **OperationLog** - 操作日志
8. **CompensationReport** - 补偿报告

## 异常处理

- 所有操作保留原始输入（raw_input字段）
- 记录处理人信息
- 保留处理结论
- 完整的操作日志链

## License

MIT
