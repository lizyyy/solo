# 小剧场批量退票 REST API 服务

一个用于处理小剧场演出取消后批量退票的 REST API 服务，使用 SQLite 存储数据。

## 功能特性

- **批量退票**：支持两种处理模式
  - `all_or_nothing`（全失败回滚）：任何一张票退款失败，所有已成功的票全部回滚
  - `partial_success`（允许部分成功）：部分票退款失败不影响其他票，失败的票可以后续重试
- **回滚机制**：第三方退款失败时自动回滚座位释放和流水写入
- **失败查询**：可查询批次中所有失败票的详细原因
- **重试机制**：支持对失败的票进行重试
- **对账功能**：导出 Markdown 格式的批次对账单

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

这将创建数据库文件 `theater.db` 并插入测试数据：

- **演出 1**：《茶馆》经典话剧，2026-06-15 19:30，小剧场A厅
- **演出 2**：《雷雨》经典话剧，2026-06-20 14:00，小剧场B厅

测试订单：
| 订单号 | 客户 | 金额 | 座位 |
|--------|------|------|------|
| ORD20260501001 | 张三 | ¥360 | A1, A2 |
| ORD20260501002 | 李四 | ¥180 | B1 |
| ORD20260501003 | 王五 | ¥280 | B2, B3 |

### 3. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动。

---

## API 接口

### 基础接口

#### 获取演出列表

```bash
curl -X GET http://localhost:3000/api/shows
```

#### 获取演出订单

```bash
curl -X GET http://localhost:3000/api/orders/show/1
```

#### 获取演出座位

```bash
curl -X GET http://localhost:3000/api/seats/show/1
```

---

### 核心业务接口

#### 1. 批量退票

**全失败回滚模式**：

```bash
curl -X POST http://localhost:3000/api/refund/batch \
  -H "Content-Type: application/json" \
  -d '{
    "show_id": 1,
    "mode": "all_or_nothing",
    "tickets": [
      {"order_id": 1, "seat_id": 1, "amount": 180},
      {"order_id": 1, "seat_id": 2, "amount": 180},
      {"order_id": 2, "seat_id": 3, "amount": 180}
    ]
  }'
```

**允许部分成功模式**：

```bash
curl -X POST http://localhost:3000/api/refund/batch \
  -H "Content-Type: application/json" \
  -d '{
    "show_id": 1,
    "mode": "partial_success",
    "tickets": [
      {"order_id": 1, "seat_id": 1, "amount": 180},
      {"order_id": 1, "seat_id": 2, "amount": 180},
      {"order_id": 2, "seat_id": 3, "amount": 180}
    ]
  }'
```

**强制失败测试**（用于测试回滚机制）：

```bash
curl -X POST http://localhost:3000/api/refund/batch \
  -H "Content-Type: application/json" \
  -d '{
    "show_id": 1,
    "mode": "all_or_nothing",
    "tickets": [
      {"order_id": 1, "seat_id": 1, "amount": 180},
      {"order_id": 1, "seat_id": 2, "amount": 180},
      {"order_id": 2, "seat_id": 3, "amount": 180}
    ],
    "force_fail_index": [1]
  }'
```

参数说明：
- `show_id`: 演出ID
- `mode`: 处理模式，可选值 `all_or_nothing` 或 `partial_success`
- `tickets`: 待退票数组，每个元素包含 `order_id`（订单ID）、`seat_id`（座位ID）、`amount`（退款金额）
- `force_fail_index`: 可选，强制指定哪些索引的票退款失败（用于测试）

#### 2. 查询批次详情

```bash
curl -X GET http://localhost:3000/api/refund/batch/{batch_no}
```

将 `{batch_no}` 替换为实际的批次号。

#### 3. 查询失败票详情

```bash
curl -X GET http://localhost:3000/api/refund/batch/{batch_no}/failed
```

#### 4. 重试失败票

**重试所有失败票**：

```bash
curl -X POST http://localhost:3000/api/refund/batch/{batch_no}/retry \
  -H "Content-Type: application/json" \
  -d '{}'
```

**重试指定失败票**：

```bash
curl -X POST http://localhost:3000/api/refund/batch/{batch_no}/retry \
  -H "Content-Type: application/json" \
  -d '{
    "ticket_ids": [3, 5]
  }'
```

#### 5. 导出 Markdown 对账单

```bash
curl -X GET http://localhost:3000/api/refund/batch/{batch_no}/export \
  -o refund-statement.md
```

---

## 完整验证链

以下是一套完整的 curl 验证链，用于测试所有功能：

### 步骤 1：准备测试数据

首先查看现有的演出、订单和座位信息：

```bash
# 查看演出列表
curl -X GET http://localhost:3000/api/shows

# 查看演出1的订单
curl -X GET http://localhost:3000/api/orders/show/1

# 查看演出1的座位状态
curl -X GET http://localhost:3000/api/seats/show/1
```

### 步骤 2：测试"允许部分成功"模式

先测试允许部分成功的模式，观察部分失败的情况：

```bash
# 批量退票（允许部分成功，强制第2张票失败）
curl -X POST http://localhost:3000/api/refund/batch \
  -H "Content-Type: application/json" \
  -d '{
    "show_id": 1,
    "mode": "partial_success",
    "tickets": [
      {"order_id": 1, "seat_id": 1, "amount": 180},
      {"order_id": 1, "seat_id": 2, "amount": 180},
      {"order_id": 2, "seat_id": 3, "amount": 180}
    ],
    "force_fail_index": [1]
  }'
```

**注意**：记录返回的 `batch_no` 值，后续步骤需要使用。

### 步骤 3：查询批次详情

```bash
# 替换 {batch_no} 为实际返回的批次号
curl -X GET http://localhost:3000/api/refund/batch/{batch_no}
```

### 步骤 4：查询失败票

```bash
curl -X GET http://localhost:3000/api/refund/batch/{batch_no}/failed
```

### 步骤 5：重试失败票

```bash
curl -X POST http://localhost:3000/api/refund/batch/{batch_no}/retry \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 步骤 6：导出对账单

```bash
curl -X GET http://localhost:3000/api/refund/batch/{batch_no}/export \
  -o refund-statement-partial.md
```

### 步骤 7：测试"全失败回滚"模式

现在测试全失败回滚模式，观察回滚效果：

```bash
# 先查看剩余座位状态
curl -X GET http://localhost:3000/api/seats/show/1

# 批量退票（全失败回滚模式，强制第1张票失败）
curl -X POST http://localhost:3000/api/refund/batch \
  -H "Content-Type: application/json" \
  -d '{
    "show_id": 1,
    "mode": "all_or_nothing",
    "tickets": [
      {"order_id": 1, "seat_id": 2, "amount": 180},
      {"order_id": 2, "seat_id": 3, "amount": 180},
      {"order_id": 3, "seat_id": 4, "amount": 140}
    ],
    "force_fail_index": [0]
  }'
```

### 步骤 8：验证回滚效果

```bash
# 查看批次详情（状态应该是 failed）
curl -X GET http://localhost:3000/api/refund/batch/{new_batch_no}

# 查看座位状态（应该全部恢复为 sold）
curl -X GET http://localhost:3000/api/seats/show/1
```

### 步骤 9：导出回滚批次的对账单

```bash
curl -X GET http://localhost:3000/api/refund/batch/{new_batch_no}/export \
  -o refund-statement-rollback.md
```

---

## 数据库表结构

### 1. shows（演出表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| name | TEXT | 演出名称 |
| date | TEXT | 演出日期 |
| time | TEXT | 演出时间 |
| venue | TEXT | 演出场地 |
| status | TEXT | 状态 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

### 2. orders（订单表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| order_no | TEXT | 订单号（唯一） |
| show_id | INTEGER | 演出ID（外键） |
| customer_name | TEXT | 客户姓名 |
| customer_phone | TEXT | 客户电话 |
| total_amount | REAL | 总金额 |
| status | TEXT | 状态 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

### 3. seats（座位表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| show_id | INTEGER | 演出ID（外键） |
| row | TEXT | 排号 |
| number | INTEGER | 座位号 |
| price | REAL | 价格 |
| order_id | INTEGER | 订单ID（外键，可空） |
| status | TEXT | 状态 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

### 4. refund_batches（退款批次表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| batch_no | TEXT | 批次号（唯一） |
| show_id | INTEGER | 演出ID（外键） |
| mode | TEXT | 处理模式 |
| status | TEXT | 状态 |
| total_tickets | INTEGER | 总票数 |
| success_count | INTEGER | 成功数 |
| failed_count | INTEGER | 失败数 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

### 5. refund_transactions（退款流水表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| transaction_no | TEXT | 交易号（唯一） |
| batch_id | INTEGER | 批次ID（外键） |
| order_id | INTEGER | 订单ID（外键） |
| seat_id | INTEGER | 座位ID（外键） |
| amount | REAL | 金额 |
| third_party_ref | TEXT | 第三方引用 |
| status | TEXT | 状态 |
| failure_reason | TEXT | 失败原因 |
| created_at | TEXT | 创建时间 |

### 6. ticket_results（票处理结果表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| batch_id | INTEGER | 批次ID（外键） |
| order_id | INTEGER | 订单ID（外键） |
| seat_id | INTEGER | 座位ID（外键） |
| status | TEXT | 状态 |
| failure_reason | TEXT | 失败原因 |
| retry_count | INTEGER | 重试次数 |
| last_retry_at | TEXT | 最后重试时间 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

---

## 状态说明

### 批次状态

- `pending`：待处理
- `processing`：处理中
- `completed`：全部完成
- `partially_completed`：部分完成
- `failed`：全部失败（全失败回滚模式）

### 座位状态

- `available`：可用
- `sold`：已售出
- `released`：已释放（退款成功）

### 交易状态

- `pending`：待处理
- `processing`：处理中
- `success`：成功
- `failed`：失败
- `rolled_back`：已回滚

### 票处理结果状态

- `pending`：待处理
- `success`：成功
- `failed`：失败
- `rolled_back`：已回滚

---

## 技术栈

- **运行时**：Node.js
- **Web 框架**：Express.js
- **数据库**：SQLite3
- **其他依赖**：uuid, body-parser

---

## 注意事项

1. 测试数据中的 `order_id` 和 `seat_id` 是固定的，如果重新初始化数据库，这些ID可能会变化。
2. `force_fail_index` 参数仅用于测试，生产环境不应使用。
3. 第三方退款模拟有 10% 的随机失败概率，用于测试真实场景。
4. 在全失败回滚模式下，回滚操作会：
   - 恢复座位状态为 `sold`
   - 恢复座位的 `order_id`
   - 更新交易状态为 `rolled_back`
   - 更新票结果状态为 `rolled_back`

---

## 许可证

MIT
