# 处方取药幂等核销台

社区药房处方取药本地REST API服务，针对网络抖动导致的重复请求问题，提供完整的幂等性保证和事务一致性保障。

## 核心特性

- **幂等性保证**: 同一幂等键多次请求只生效一次，返回首次执行结果
- **事务一致性**: 库存扣减、处方状态、支付流水要么一起成功要么一起失败
- **本地SQLite存储**: 无需外部数据库，单文件部署
- **审计追踪**: 完整的操作日志，支持导出Markdown/JSON格式报告
- **对账功能**: 自动检测处方、核销单、支付记录、库存之间的差异

## 技术栈

- Node.js + Express
- better-sqlite3 (SQLite数据库)
- uuid (唯一标识生成)

## 项目结构

```
xy4781/
├── data/                    # SQLite数据库文件目录 (自动创建)
├── src/
│   ├── database/
│   │   ├── connection.js    # 数据库连接
│   │   └── schema.js        # 数据库模式初始化
│   ├── dao/
│   │   ├── prescriptionDao.js    # 处方数据访问
│   │   ├── inventoryDao.js       # 库存数据访问
│   │   ├── fulfillmentDao.js     # 核销单数据访问
│   │   ├── idempotencyDao.js     # 幂等键数据访问
│   │   └── auditDao.js           # 审计日志数据访问
│   ├── services/
│   │   ├── prescriptionService.js    # 处方业务服务
│   │   ├── fulfillmentService.js     # 核销业务服务
│   │   ├── idempotencyService.js     # 幂等性服务
│   │   ├── reconciliationService.js  # 对账服务
│   │   └── auditReportService.js     # 审计报告服务
│   ├── routes/
│   │   ├── prescriptions.js    # 处方API路由
│   │   ├── fulfillments.js     # 核销API路由
│   │   └── audit.js            # 审计/对账API路由
│   └── index.js            # 服务入口
├── package.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

### 3. 健康检查

```bash
curl http://localhost:3000/health
```

---

## API 接口说明

### 基础接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | / | API概览 |
| GET | /health | 健康检查 |

### 处方管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/prescriptions | 获取所有处方 |
| GET | /api/prescriptions/:idOrNo | 获取单个处方 (ID或处方号) |
| POST | /api/prescriptions | 创建处方 |
| GET | /api/prescriptions/inventory | 获取药品库存 |

### 核销管理 (核心幂等接口)

| 方法 | 路径 | 说明 | 幂等要求 |
|------|------|------|----------|
| GET | /api/fulfillments | 获取所有核销单 | |
| GET | /api/fulfillments/:idOrNo | 获取单个核销单 | |
| **POST** | **/api/fulfillments/fulfill** | **核销处方** | **需要 X-Idempotency-Key** |
| **POST** | **/api/fulfillments/cancel** | **撤销核销** | **需要 X-Idempotency-Key** |
| GET | /api/fulfillments/payments | 获取所有支付记录 | |
| GET | /api/fulfillments/idempotency/:key | 检查幂等键状态 | |

### 审计与对账

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/audit/reconciliation | 查询对账差异 |
| GET | /api/audit/logs | 获取审计日志 (支持筛选) |
| GET | /api/audit/stats | 获取操作统计 |
| GET | /api/audit/report/json | 导出JSON格式审计报告 |
| GET | /api/audit/report/markdown | 导出Markdown格式审计报告 |
| GET | /api/audit/report/preview | 预览审计报告 |

---

## 完整 curl 验证流程

### 场景一：正常核销流程

#### 1. 查看初始库存

```bash
curl http://localhost:3000/api/prescriptions/inventory
```

#### 2. 创建处方

```bash
curl -X POST http://localhost:3000/api/prescriptions \
  -H "Content-Type: application/json" \
  -H "X-Operator: 张药师" \
  -d '{
    "patientName": "张三",
    "patientIdCard": "110101199001011234",
    "items": [
      {"drugCode": "DRUG001", "quantity": 2},
      {"drugCode": "DRUG002", "quantity": 1}
    ]
  }'
```

**保存返回的 `prescription_no`，后续步骤需要使用**

#### 3. 核销处方 (首次请求)

使用唯一的幂等键，格式建议: `操作类型-日期-随机串`

```bash
# 请将 RX20260505XXXXXX 替换为上一步返回的实际处方号
PRESCRIPTION_NO="RX20260505XXXXXX"

curl -X POST http://localhost:3000/api/fulfillments/fulfill \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: FULFILL-20260505-ABC001" \
  -H "X-Operator: 李药师" \
  -d "{
    \"prescriptionNo\": \"$PRESCRIPTION_NO\",
    \"pharmacistName\": \"李药师\"
  }"
```

**保存返回的 `fulfillment_no`**

#### 4. 验证结果

查看处方状态应为 `FULFILLED`:

```bash
curl "http://localhost:3000/api/prescriptions/$PRESCRIPTION_NO"
```

查看库存已扣减:

```bash
curl http://localhost:3000/api/prescriptions/inventory
```

查看支付记录:

```bash
curl http://localhost:3000/api/fulfillments/payments
```

---

### 场景二：重复请求 (幂等性验证)

使用**相同的幂等键**再次发起核销请求:

```bash
curl -X POST http://localhost:3000/api/fulfillments/fulfill \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: FULFILL-20260505-ABC001" \
  -H "X-Operator: 李药师" \
  -d "{
    \"prescriptionNo\": \"$PRESCRIPTION_NO\",
    \"pharmacistName\": \"李药师\"
  }"
```

**预期结果**:
- 返回 `isDuplicate: true`
- 返回与首次请求相同的数据
- **库存不会再次扣减**
- **处方状态保持不变**

验证库存:

```bash
curl http://localhost:3000/api/prescriptions/inventory
```

---

### 场景三：异常回滚验证

#### 1. 创建一个新处方

```bash
curl -X POST http://localhost:3000/api/prescriptions \
  -H "Content-Type: application/json" \
  -H "X-Operator: 张药师" \
  -d '{
    "patientName": "李四",
    "patientIdCard": "110101199002025678",
    "items": [
      {"drugCode": "DRUG999", "quantity": 1}
    ]
  }'
```

**预期结果**: 失败，因为 `DRUG999` 不存在

验证库存:

```bash
curl http://localhost:3000/api/prescriptions/inventory
```

#### 2. 测试库存不足场景

先创建一个需要大量药品的处方:

```bash
curl -X POST http://localhost:3000/api/prescriptions \
  -H "Content-Type: application/json" \
  -H "X-Operator: 张药师" \
  -d '{
    "patientName": "王五",
    "items": [
      {"drugCode": "DRUG001", "quantity": 9999}
    ]
  }'
```

保存处方号为 `RX20260505YYYYYY`，然后尝试核销:

```bash
PRESCRIPTION_NO2="RX20260505YYYYYY"

curl -X POST http://localhost:3000/api/fulfillments/fulfill \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: FULFILL-20260505-ABC002" \
  -H "X-Operator: 李药师" \
  -d "{
    \"prescriptionNo\": \"$PRESCRIPTION_NO2\",
    \"pharmacistName\": \"李药师\"
  }"
```

**预期结果**:
- 返回错误: `INSUFFICIENT_INVENTORY`
- 处方状态保持 `CREATED` (没有变为 `FULFILLED`)
- 库存没有扣减
- 没有创建核销单和支付记录

验证:

```bash
curl "http://localhost:3000/api/prescriptions/$PRESCRIPTION_NO2"
curl http://localhost:3000/api/fulfillments
curl http://localhost:3000/api/fulfillments/payments
```

---

### 场景四：撤销核销

使用之前保存的 `fulfillment_no`:

```bash
FULFILLMENT_NO="FL20260505XXXXXX"

curl -X POST http://localhost:3000/api/fulfillments/cancel \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: CANCEL-20260505-CAN001" \
  -H "X-Operator: 王主管" \
  -d "{
    \"fulfillmentNo\": \"$FULFILLMENT_NO\",
    \"reason\": \"患者放弃取药\"
  }"
```

**预期结果**:
- 核销单状态变为 `CANCELLED`
- 处方状态恢复为 `CREATED`
- 支付记录状态变为 `REFUNDED`
- 库存已加回

验证:

```bash
curl "http://localhost:3000/api/fulfillments/$FULFILLMENT_NO"
curl "http://localhost:3000/api/prescriptions/$PRESCRIPTION_NO"
curl http://localhost:3000/api/prescriptions/inventory
```

---

### 场景五：对账与审计

#### 1. 查询对账差异

```bash
curl http://localhost:3000/api/audit/reconciliation
```

#### 2. 查看审计日志

```bash
curl http://localhost:3000/api/audit/logs
```

#### 3. 导出审计报告

**JSON格式**:
```bash
curl -o audit-report.json http://localhost:3000/api/audit/report/json
```

**Markdown格式**:
```bash
curl -o audit-report.md http://localhost:3000/api/audit/report/markdown
```

**预览报告**:
```bash
curl http://localhost:3000/api/audit/report/preview
```

---

## 幂等性设计说明

### 幂等键使用规则

1. **请求头**: `X-Idempotency-Key`
2. **生成建议**: `操作类型-日期-随机串`
   - 核销: `FULFILL-20260505-ABC123`
   - 撤销: `CANCEL-20260505-DEF456`
3. **唯一性**: 同一业务操作使用相同的幂等键

### 幂等键处理流程

```
请求到达
    │
    ▼
检查幂等键是否存在
    │
    ├─► 已存在且有响应数据 ──► 直接返回缓存的响应 (isDuplicate=true)
    │
    ├─► 已存在但无响应数据 ──► 返回 "请求正在处理中" (409 Conflict)
    │
    └─► 不存在 ──► 插入幂等键记录 (标记为"处理中")
                      │
                      ▼
                 执行业务逻辑
                      │
                      ├─► 成功 ──► 更新幂等键记录，保存响应数据
                      │
                      └─► 失败 ──► 幂等键记录保持"处理中"状态
                                    (后续相同幂等键会收到409)
```

### 注意事项

- 如果请求因网络问题超时，**不要立即更换幂等键重试**
- 应先查询幂等键状态: `GET /api/fulfillments/idempotency/{key}`
- 如果状态是已完成，直接使用之前的结果
- 如果状态是处理中，等待一段时间后再查询

---

## 事务一致性设计

### 核销操作事务范围

核销处方时，以下操作在同一个数据库事务中执行:

1. **创建核销单** (`fulfillments` 表)
2. **创建支付记录** (`payment_records` 表)
3. **扣减库存** (`inventory` 表)
4. **记录库存交易** (`inventory_transactions` 表)
5. **更新核销单状态** → `COMPLETED`
6. **更新支付记录状态** → `SUCCESS`
7. **更新处方状态** → `FULFILLED`

**任一环节失败，整个事务回滚，所有修改全部撤销。**

### 撤销核销事务范围

撤销核销时，以下操作在同一个数据库事务中执行:

1. **加回库存** (`inventory` 表)
2. **记录库存交易** (`inventory_transactions` 表，类型为 ADD)
3. **更新核销单状态** → `CANCELLED`
4. **更新支付记录状态** → `REFUNDED`
5. **更新处方状态** → `CREATED`

---

## 数据库表结构

### 核心表

| 表名 | 说明 |
|------|------|
| `inventory` | 药品库存 |
| `prescriptions` | 处方信息 |
| `fulfillments` | 核销单 |
| `payment_records` | 支付记录 |
| `inventory_transactions` | 库存交易流水 |
| `idempotency_keys` | 幂等键记录 |
| `audit_logs` | 审计日志 |

---

## 状态流转

### 处方状态

```
CREATED (已创建)
    │
    ├─► FULFILLED (已核销) ──► CANCELLED (已撤销)
    │
    └─► (保持 CREATED，等待核销)
```

### 核销单状态

```
PENDING (待处理)
    │
    ├─► COMPLETED (已完成) ──► CANCELLED (已撤销)
    │
    └─► (异常时不创建或回滚)
```

### 支付记录状态

```
PENDING (待支付)
    │
    ├─► SUCCESS (支付成功) ──► REFUNDED (已退款)
    │
    └─► (异常时不创建或回滚)
```

---

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| `MISSING_IDEMPOTENCY_KEY` | 缺少幂等键 |
| `REQUEST_IN_PROGRESS` | 请求正在处理中 |
| `PRESCRIPTION_NOT_FOUND` | 处方不存在 |
| `PRESCRIPTION_ALREADY_FULFILLED` | 处方已核销 |
| `PRESCRIPTION_CANCELLED` | 处方已作废 |
| `FULFILLMENT_NOT_FOUND` | 核销单不存在 |
| `FULFILLMENT_ALREADY_CANCELLED` | 核销单已撤销 |
| `DRUG_NOT_FOUND` | 药品不存在 |
| `INSUFFICIENT_INVENTORY` | 库存不足 |
| `INVALID_QUANTITY` | 数量无效 |
| `EMPTY_ITEMS` | 明细为空 |

---

## 部署说明

### 环境要求

- Node.js >= 16.0.0
- npm >= 7.0.0

### 生产部署

```bash
# 1. 安装依赖 (生产环境)
npm install --production

# 2. 设置端口 (可选)
export PORT=8080

# 3. 启动服务
npm start
```

### 使用 PM2 守护进程

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start src/index.js --name "prescription-service"

# 查看状态
pm2 status

# 查看日志
pm2 logs prescription-service

# 开机自启
pm2 startup
pm2 save
```

---

## 许可证

MIT License
