# 分布式事务演练系统 - 跨仓调拨 Saga/TCC 模式

一个用于学习和演练分布式事务的本地后端 API 服务，模拟跨仓调拨场景中的仓库、账务、物流三个服务。

## 功能特性

- ✅ **TCC 模式**: 完整的 Prepare → Confirm → Cancel 三阶段提交
- ✅ **Saga 补偿**: Prepare 阶段失败时自动反向补偿
- ✅ **失败注入**: 可手动在任意步骤注入失败或超时
- ✅ **重试补偿**: 支持自动重试机制
- ✅ **幂等键去重**: 通过 X-Idempotency-Key 防重复请求
- ✅ **事务时间线**: 完整记录事务执行过程
- ✅ **复盘报告**: 导出 Markdown/JSON 格式的事务报告
- ✅ **SQLite 留痕**: 所有操作持久化到本地 SQLite 数据库

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动。

### 验证服务

```bash
curl http://localhost:3000/health
```

## 数据模型

### 预置测试数据

服务启动时自动初始化以下测试数据：

**仓库库存:**
| SKU | 仓库 | 数量 |
|-----|------|------|
| SKU001 | WH_A | 1000 |
| SKU001 | WH_B | 500 |
| SKU002 | WH_A | 200 |

**账户:**
| 账户ID | 余额 | 冻结金额 |
|--------|------|----------|
| ACC_001 | 50000 | 0 |
| ACC_002 | 30000 | 0 |

## API 文档

### 事务操作

#### 1. 执行跨仓调拨（完整 TCC 流程）

**一步执行完整的 Prepare + Confirm 流程**

```bash
curl -X POST http://localhost:3000/api/transactions/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "SKU001",
    "fromLocation": "WH_A",
    "toLocation": "WH_B",
    "quantity": 100,
    "payerAccount": "ACC_001",
    "payeeAccount": "ACC_002",
    "amount": 5000,
    "fromAddress": "北京市朝阳区",
    "toAddress": "上海市浦东新区"
  }'
```

**响应示例 (成功):**
```json
{
  "transactionId": "xxxx-xxxx-xxxx-xxxx",
  "success": true,
  "status": "CONFIRMED",
  "message": "跨仓调拨事务执行成功"
}
```

#### 2. 使用幂等键（防重复提交）

```bash
# 第一次请求
curl -X POST http://localhost:3000/api/transactions/transfer \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: order_001_20260505" \
  -d '{
    "sku": "SKU001",
    "fromLocation": "WH_A",
    "toLocation": "WH_B",
    "quantity": 50,
    "payerAccount": "ACC_001",
    "payeeAccount": "ACC_002",
    "amount": 2500,
    "fromAddress": "北京",
    "toAddress": "上海"
  }'

# 第二次请求（相同幂等键）- 返回已有事务，不会重复执行
curl -X POST http://localhost:3000/api/transactions/transfer \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: order_001_20260505" \
  -d '{...}'
```

#### 3. 分步执行 TCC

**适合需要人工介入确认的场景**

```bash
# 步骤1: 创建事务
TX_ID=$(curl -X POST http://localhost:3000/api/transactions/create \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "SKU001",
    "fromLocation": "WH_A",
    "toLocation": "WH_B",
    "quantity": 30,
    "payerAccount": "ACC_001",
    "payeeAccount": "ACC_002",
    "amount": 1500,
    "fromAddress": "北京",
    "toAddress": "上海"
  }' | jq -r '.transactionId')

echo "事务ID: $TX_ID"

# 步骤2: 执行 Prepare 阶段
curl -X POST http://localhost:3000/api/transactions/$TX_ID/prepare

# 步骤3: 确认提交（或取消）
curl -X POST http://localhost:3000/api/transactions/$TX_ID/confirm

# 或者取消事务
# curl -X POST http://localhost:3000/api/transactions/$TX_ID/cancel
```

#### 4. 查询事务详情

```bash
# 获取事务基本信息
curl http://localhost:3000/api/transactions/{transactionId}

# 获取事务时间线
curl http://localhost:3000/api/transactions/{transactionId}/timeline

# 获取所有事务列表
curl http://localhost:3000/api/transactions
```

### 失败注入

#### 1. 查看可注入的步骤

```bash
curl http://localhost:3000/api/failure/steps
```

**可用步骤:**
- `WAREHOUSE_PREPARE` - 仓库预扣
- `ACCOUNT_PREPARE` - 账户冻结
- `LOGISTICS_PREPARE` - 物流开单
- `WAREHOUSE_CONFIRM` - 仓库确认
- `ACCOUNT_CONFIRM` - 账户转账
- `LOGISTICS_CONFIRM` - 物流确认
- `WAREHOUSE_CANCEL` - 仓库补偿
- `ACCOUNT_CANCEL` - 账户补偿
- `LOGISTICS_CANCEL` - 物流补偿

**失败类型:**
- `ERROR` - 模拟错误
- `TIMEOUT` - 模拟超时

#### 2. 注入失败

```bash
# 在账务 Prepare 阶段注入错误
curl -X POST http://localhost:3000/api/failure/inject \
  -H "Content-Type: application/json" \
  -d '{
    "step": "ACCOUNT_PREPARE",
    "failureType": "ERROR"
  }'

# 注入超时
curl -X POST http://localhost:3000/api/failure/inject \
  -H "Content-Type: application/json" \
  -d '{
    "step": "WAREHOUSE_CONFIRM",
    "failureType": "TIMEOUT"
  }'
```

#### 3. 查看当前活跃的失败注入

```bash
curl http://localhost:3000/api/failure/active
```

#### 4. 清除失败注入

```bash
# 清除特定步骤
curl -X POST http://localhost:3000/api/failure/clear \
  -H "Content-Type: application/json" \
  -d '{"step": "ACCOUNT_PREPARE"}'

# 清除所有
curl -X POST http://localhost:3000/api/failure/clear \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 导出复盘报告

#### 1. JSON 格式

```bash
curl http://localhost:3000/api/transactions/{transactionId}/report/json
```

#### 2. Markdown 格式

```bash
# 直接查看
curl http://localhost:3000/api/transactions/{transactionId}/report/markdown

# 保存到文件
curl http://localhost:3000/api/transactions/{transactionId}/report/markdown \
  -o report.md
```

### 服务数据查询

```bash
# 查询仓库库存
curl http://localhost:3000/api/services/warehouse/inventory

# 查询单个 SKU 库存
curl http://localhost:3000/api/services/warehouse/inventory/SKU001/WH_A

# 查询账户
curl http://localhost:3000/api/services/accounting/accounts

# 查询运单
curl http://localhost:3000/api/services/logistics/shipments
```

---

## 坏样例（错误案例）

### ❌ 案例 1: 库存不足

**场景:** 请求调拨数量超过源仓库库存

```bash
# 准备数据: WH_A 只有 1000 个 SKU001
# 尝试调拨 2000 个 - 会失败
curl -X POST http://localhost:3000/api/transactions/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "SKU001",
    "fromLocation": "WH_A",
    "toLocation": "WH_B",
    "quantity": 2000,
    "payerAccount": "ACC_001",
    "payeeAccount": "ACC_002",
    "amount": 10000,
    "fromAddress": "北京",
    "toAddress": "上海"
  }'
```

**预期结果:**
- 仓库 Prepare 失败
- 事务状态变为 `FAILED`
- 已执行的操作自动补偿回滚

---

### ❌ 案例 2: 账户余额不足

**场景:** 付款账户余额不足以支付

```bash
# ACC_001 余额 50000，尝试支付 100000
curl -X POST http://localhost:3000/api/transactions/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "SKU001",
    "fromLocation": "WH_A",
    "toLocation": "WH_B",
    "quantity": 100,
    "payerAccount": "ACC_001",
    "payeeAccount": "ACC_002",
    "amount": 100000,
    "fromAddress": "北京",
    "toAddress": "上海"
  }'
```

**预期结果:**
- 仓库 Prepare 成功（库存已扣减）
- 账户 Prepare 失败
- 自动触发 Saga 补偿：仓库库存归还
- 事务状态 `FAILED`，数据保持一致

---

### ❌ 案例 3: 手动注入失败 + 补偿

**场景:** 模拟账务服务在 Prepare 阶段故障

```bash
# 步骤1: 注入失败
curl -X POST http://localhost:3000/api/failure/inject \
  -H "Content-Type: application/json" \
  -d '{"step": "ACCOUNT_PREPARE", "failureType": "ERROR"}'

# 步骤2: 执行调拨
curl -X POST http://localhost:3000/api/transactions/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "SKU001",
    "fromLocation": "WH_A",
    "toLocation": "WH_B",
    "quantity": 50,
    "payerAccount": "ACC_001",
    "payeeAccount": "ACC_002",
    "amount": 2500,
    "fromAddress": "北京",
    "toAddress": "上海"
  }'

# 步骤3: 查看时间线确认补偿发生
curl http://localhost:3000/api/transactions/{transactionId}/timeline

# 步骤4: 清除失败注入
curl -X POST http://localhost:3000/api/failure/clear -d '{}'
```

---

### ❌ 案例 4: Confirm 阶段失败（需人工介入）

**场景:** 模拟物流服务在 Confirm 阶段失败

```bash
# 步骤1: 注入 Confirm 阶段失败
curl -X POST http://localhost:3000/api/failure/inject \
  -H "Content-Type: application/json" \
  -d '{"step": "LOGISTICS_CONFIRM", "failureType": "ERROR"}'

# 步骤2: 执行调拨
curl -X POST http://localhost:3000/api/transactions/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "SKU001",
    "fromLocation": "WH_A",
    "toLocation": "WH_B",
    "quantity": 30,
    "payerAccount": "ACC_001",
    "payeeAccount": "ACC_002",
    "amount": 1500,
    "fromAddress": "北京",
    "toAddress": "上海"
  }'

# 步骤3: 查看事务状态 - 应返回 requiresManualIntervention: true
curl http://localhost:3000/api/transactions/{transactionId}

# 步骤4: 导出报告分析
curl http://localhost:3000/api/transactions/{transactionId}/report/markdown
```

**说明:** Confirm 阶段的失败通常需要人工介入处理，因为：
- 仓库可能已经实际出库
- 账户可能已经实际转账
- 无法简单回滚，需要对账处理

---

### ❌ 案例 5: 重复请求（幂等键测试）

```bash
# 使用相同的幂等键发送多次请求
for i in 1 2 3; do
  echo "第 $i 次请求:"
  curl -X POST http://localhost:3000/api/transactions/transfer \
    -H "Content-Type: application/json" \
    -H "X-Idempotency-Key: test_idempotency_001" \
    -d '{
      "sku": "SKU001",
      "fromLocation": "WH_A",
      "toLocation": "WH_B",
      "quantity": 10,
      "payerAccount": "ACC_001",
      "payeeAccount": "ACC_002",
      "amount": 500,
      "fromAddress": "北京",
      "toAddress": "上海"
    }'
  echo ""
done

# 验证: 库存应该只减少了 10 个，不是 30 个
curl http://localhost:3000/api/services/warehouse/inventory
```

---

## TCC 执行流程详解

```
                    ┌─────────────────────────────────────────┐
                    │           客户端请求                      │
                    │  POST /api/transactions/transfer        │
                    └─────────────────────┬───────────────────┘
                                          │
                    ┌─────────────────────▼───────────────────┐
                    │         Prepare 阶段 (Try)               │
                    │  ┌──────────┐  ┌──────────┐  ┌────────┐│
                    │  │ 仓库预扣  │→│ 账户冻结  │→│ 物流开单││
                    │  └──────────┘  └──────────┘  └────────┘│
                    └─────────────────────┬───────────────────┘
                                          │
                    ┌───────────┬─────────┴──────────┬───────────┐
                    ▼           ▼                    ▼           ▼
            ┌───────────┐  ┌───────────┐      ┌───────────┐  ┌───────────┐
            │ 全部成功   │  │ 部分失败   │      │ 全部失败   │  │ 超时/未知  │
            └─────┬─────┘  └─────┬─────┘      └─────┬─────┘  └─────┬─────┘
                  │              │                    │              │
                  ▼              ▼                    ▼              ▼
            ┌───────────┐  ┌───────────┐      ┌───────────┐  ┌───────────┐
            │  Continue │  │ Compensate│      │ Compensate│  │   Retry   │
            │ (Confirm) │  │ (反向补偿) │      │ (反向补偿) │  │           │
            └─────┬─────┘  └─────┬─────┘      └─────┬─────┘  └─────┬─────┘
                  │              │                    │              │
                  ▼              │                    │              │
            ┌─────────────────────────────────────────────────────────────┐
            │                    Confirm 阶段 (Confirm)                     │
            │  ┌──────────┐  ┌──────────┐  ┌────────┐                    │
            │  │ 仓库确认  │→│ 账户转账  │→│ 物流确认│                    │
            │  └──────────┘  └──────────┘  └────────┘                    │
            └─────────────────────┬───────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
            ┌───────────┐               ┌───────────┐
            │ 全部成功   │               │ 部分失败   │
            │  → 完成    │               │  → 人工介入 │
            └───────────┘               └───────────┘
```

## 项目结构

```
├── src/
│   ├── config/
│   │   ├── database.js      # SQLite 连接配置
│   │   └── init-db.js       # 数据库初始化和种子数据
│   ├── services/
│   │   ├── warehouse-service.js      # 仓库服务
│   │   ├── accounting-service.js     # 账务服务
│   │   ├── logistics-service.js      # 物流服务
│   │   └── saga-coordinator.js       # Saga/TCC 协调器
│   ├── utils/
│   │   ├── idempotency.js    # 幂等键管理
│   │   ├── failure-injector.js # 失败注入器
│   │   ├── timeline.js       # 时间线记录
│   │   ├── retry-manager.js  # 重试管理
│   │   └── report-exporter.js # 报告导出
│   ├── routes/
│   │   ├── transactions.js   # 事务路由
│   │   ├── failure-injection.js # 失败注入路由
│   │   └── services.js       # 服务数据路由
│   └── index.js              # 入口文件
├── data/                     # SQLite 数据库文件目录
├── package.json
└── README.md
```

## 数据库表结构

### 核心业务表
- `warehouse` - 仓库库存
- `accounts` - 账户余额
- `shipments` - 物流运单

### 操作日志表
- `warehouse_operations` - 仓库操作记录
- `account_operations` - 账务操作记录
- `logistics_operations` - 物流操作记录

### 事务管理表
- `transactions` - 分布式事务主表
- `transaction_timeline` - 事务执行时间线
- `idempotency_keys` - 幂等键映射
- `failure_injections` - 失败注入配置
- `retry_attempts` - 重试记录

## 开发模式

```bash
# 使用 nodemon 自动重启
npm run dev
```

## 注意事项

1. **这是一个演练/学习系统**，不应用于生产环境
2. 所有服务使用本地模拟，实际生产中应替换为真实的微服务调用
3. SQLite 适合单机演练，生产环境应使用 MySQL/PostgreSQL
4. 失败注入仅在当前服务实例生效
5. 幂等键有效期：本实现中永久有效，实际生产应设置过期时间

## 扩展建议

1. 添加真实的 HTTP 服务间调用（使用 axios/fetch）
2. 实现定时任务扫描悬挂事务
3. 添加消息队列支持（如 RabbitMQ/Kafka）
4. 实现分布式锁
5. 添加 Grafana/Prometheus 监控
6. 实现 Circuit Breaker 熔断器模式
