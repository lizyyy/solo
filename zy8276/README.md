# 库存扣减服务

一个基于 FastAPI + SQLite 的本地库存扣减后端服务，专门用于限量商品开售场景。

## 功能特性

- **库存扣减流程**: 用户下单时预占库存，支付成功后实扣，取消/支付失败/超时回滚
- **幂等性保证**: 同一个幂等键重复请求不会重复扣减库存
- **并发安全**: 使用数据库行级锁防止超卖和负数库存
- **库存流水**: 完整记录所有库存变更操作
- **审计报告**: 支持导出 Markdown/JSON 格式的库存审计报告
- **内置数据**: 启动时自动初始化 2 个测试 SKU

## 技术栈

- **Web 框架**: FastAPI
- **ORM**: SQLAlchemy
- **数据库**: SQLite
- **并发测试**: aiohttp + asyncio

## 项目结构

```
.
├── main.py              # FastAPI 主应用
├── models.py            # 数据库模型定义
├── schemas.py           # Pydantic 数据模型
├── database.py          # 数据库连接配置
├── requirements.txt     # Python 依赖
├── curl_examples.sh     # API 调用示例脚本
├── concurrent_test.py   # 并发测试脚本
├── README.md            # 本文档
└── inventory.db         # SQLite 数据库文件（运行时自动创建）
```

## 内置测试数据

服务启动时会自动创建以下 2 个 SKU（如果不存在）：

| SKU | 商品名称 | 价格 | 总库存 |
|-----|----------|------|--------|
| SKU001 | 限量版智能手表 Pro | ¥1,999.00 | 10 |
| SKU002 | 限量款蓝牙耳机 Ultra | ¥999.00 | 10 |

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
# 方式一：直接运行
python main.py

# 方式二：使用 uvicorn
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

服务启动后访问：
- API 文档: http://localhost:8000/docs
- ReDoc 文档: http://localhost:8000/redoc
- 健康检查: http://localhost:8000/

## API 接口

### 商品相关

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/products/` | 获取所有商品列表 |
| GET | `/api/products/{sku}` | 获取单个商品详情 |
| POST | `/api/products/` | 创建新商品 |

### 订单相关

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/orders/` | 创建订单（预占库存） |
| GET | `/api/orders/{order_no}` | 获取订单详情 |
| POST | `/api/orders/pay` | 支付成功（实扣库存） |
| POST | `/api/orders/cancel` | 取消订单（回滚库存） |
| POST | `/api/orders/timeout` | 订单超时（回滚库存） |
| POST | `/api/orders/fail` | 支付失败（回滚库存） |

### 库存流水

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/inventory-journals/` | 获取所有库存流水 |
| GET | `/api/inventory-journals/?sku={sku}` | 按 SKU 筛选流水 |
| GET | `/api/inventory-journals/?order_no={order_no}` | 按订单号筛选流水 |
| GET | `/api/inventory-journals/{id}` | 获取单条流水详情 |

### 幂等键

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/idempotency-keys/{key}` | 查询幂等键状态 |

### 审计报告

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/audit/report` | 获取结构化审计报告 |
| GET | `/api/audit/report/json` | 导出 JSON 格式报告 |
| GET | `/api/audit/report/markdown` | 导出 Markdown 格式报告 |

## 库存扣减流程

### 1. 创建订单（预占库存）

```
可用库存(available_stock) -= 购买数量
冻结库存(frozen_stock) += 购买数量
```

**关键检查**:
- 幂等键是否已存在
- 可用库存是否 >= 购买数量

**并发控制**: 使用 `SELECT ... FOR UPDATE` 行级锁

### 2. 支付成功（实扣库存）

```
冻结库存(frozen_stock) -= 购买数量
已售库存(sold_stock) += 购买数量
```

**关键检查**:
- 订单状态必须为 `pending`
- 冻结库存必须 >= 购买数量

### 3. 取消/超时/失败（回滚库存）

```
冻结库存(frozen_stock) -= 购买数量
可用库存(available_stock) += 购买数量
```

**关键检查**:
- 订单状态必须为 `pending`
- 冻结库存必须 >= 购买数量

## 使用示例

### 运行 curl 示例脚本

```bash
chmod +x curl_examples.sh
./curl_examples.sh
```

脚本包含以下场景：
1. 获取商品列表
2. 创建订单（预占库存）
3. 幂等性测试（重复请求）
4. 支付成功（实扣）
5. 创建订单后取消（回滚）
6. 查看库存流水
7. 导出审计报告

### 手动 API 调用示例

#### 1. 创建订单（预占库存）

```bash
curl -X POST "http://localhost:8000/api/orders/" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_001",
    "sku": "SKU001",
    "quantity": 1,
    "idempotency_key": "IDEM_20260505_001"
  }'
```

#### 2. 支付成功

```bash
curl -X POST "http://localhost:8000/api/orders/pay" \
  -H "Content-Type: application/json" \
  -d '{"order_no": "ORD20260505123456ABC123"}'
```

#### 3. 取消订单

```bash
curl -X POST "http://localhost:8000/api/orders/cancel" \
  -H "Content-Type: application/json" \
  -d '{"order_no": "ORD20260505123456ABC123"}'
```

## 并发测试

### 运行并发测试脚本

```bash
python concurrent_test.py
```

### 测试场景

**场景 1: 20 个并发请求，每个唯一幂等键**
- 模拟 20 个用户同时下单购买 SKU001
- 每个请求使用不同的幂等键
- 预期：只有 10 个请求成功（因为库存只有 10），其余失败

**场景 2: 20 个并发请求，相同幂等键**
- 模拟幂等性测试
- 所有请求使用相同的幂等键
- 预期：只有 1 个请求真正创建订单，其余返回相同订单信息

### 测试输出包含

- 初始/最终库存状态
- 请求统计（成功/失败数）
- 失败原因分析
- 响应时间统计
- 库存一致性验证
- 超卖检查
- 审计报告摘要

## 导出库存审计报告

### 方式一：API 导出

```bash
# 导出 JSON 格式
curl -s "http://localhost:8000/api/audit/report/json" | python3 -m json.tool

# 导出 Markdown 格式
curl -s "http://localhost:8000/api/audit/report/markdown" > audit_report.md
```

### 方式二：并发测试后查看

运行 `concurrent_test.py` 后会自动显示审计报告摘要。

### 报告内容

- **生成时间**: 报告创建时间
- **库存汇总**: 总商品数、总可用/冻结/已售库存
- **订单统计**: 总订单数、待支付/已支付/已取消
- **商品详情**: 每个 SKU 的库存明细和平衡状态

## 幂等性设计

### 幂等键生成建议

推荐格式：`{业务标识}_{日期}_{唯一序号}`

例如：
- `ORDER_20260505_0001`
- `PAY_20260505_ABC123`

### 幂等键过期

- 默认过期时间：24 小时
- 过期后可使用相同键重新请求

### 处理流程

1. 收到请求时先检查幂等键是否存在
2. 已完成：直接返回缓存的响应
3. 处理中：返回 409 冲突，请稍后重试
4. 不存在：创建幂等键记录，状态设为 "processing"
5. 处理完成：更新状态为 "completed"，缓存响应

## 并发安全保证

### 技术方案

1. **数据库行级锁**: 使用 `SELECT ... FOR UPDATE`
2. **事务原子性**: 所有库存操作在一个事务内完成
3. **库存检查**: 更新前确保可用库存 >= 购买数量
4. **非负约束**: 数据库层面确保库存字段非负

### 防止超卖

```python
# 1. 开启事务
# 2. 行级锁锁定商品记录
product = db.execute(
    select(Product).where(Product.sku == sku).with_for_update()
).scalar_one_or_none()

# 3. 检查可用库存
if product.available_stock < quantity:
    raise HTTPException(status_code=400, detail="库存不足")

# 4. 更新库存
product.available_stock -= quantity
product.frozen_stock += quantity

# 5. 提交事务
db.commit()
```

## 订单状态流转

```
                    ┌─────────────┐
                    │   pending   │ ← 下单后预占库存
                    └──────┬──────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │   paid   │    │ cancelled│    │ timeout  │
    │  (实扣)  │    │ (回滚)   │    │ (回滚)   │
    └──────────┘    └──────────┘    └──────────┘
           │
           ▼
    ┌──────────┐
    │   fail   │ ← 仅 pending 状态可回滚
    │ (回滚)   │
    └──────────┘
```

## 常见问题

### Q1: 如何重置数据库？

```bash
# 删除数据库文件，重启服务会自动重建
rm inventory.db
python main.py
```

### Q2: 如何添加更多商品？

```bash
curl -X POST "http://localhost:8000/api/products/" \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "SKU003",
    "name": "新商品",
    "price": 599.00,
    "total_stock": 100
  }'
```

### Q3: 如何查看库存流水？

```bash
# 查看所有流水
curl -s "http://localhost:8000/api/inventory-journals/" | python3 -m json.tool

# 按 SKU 筛选
curl -s "http://localhost:8000/api/inventory-journals/?sku=SKU001" | python3 -m json.tool
```

### Q4: 并发测试后如何验证库存？

```bash
# 查看商品库存
curl -s "http://localhost:8000/api/products/SKU001" | python3 -m json.tool

# 导出审计报告
curl -s "http://localhost:8000/api/audit/report/markdown"
```

## 性能测试建议

1. **测试前重置数据库**: 确保每次测试从干净状态开始
2. **调整库存数量**: 根据测试需求修改 `main.py` 中的 `init_seed_data` 函数
3. **监控响应时间**: 并发测试脚本会输出平均/最快/最慢响应时间
4. **验证一致性**: 每次测试后导出审计报告，确保库存平衡

## 生产环境建议

如果要将此服务用于生产环境，建议：

1. **数据库**: 替换为 PostgreSQL/MySQL
2. **缓存**: 使用 Redis 缓存商品信息和幂等键
3. **消息队列**: 订单处理使用异步消息队列
4. **分布式锁**: 使用 Redis 分布式锁替代数据库行级锁
5. **监控告警**: 添加库存异常监控和告警
6. **日志审计**: 完善操作日志记录

## License

MIT License
