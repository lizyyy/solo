# 商户结算扣罚 API - 快速开始指南

## 项目简介

**商户结算扣罚 API** 是一个完整的商户结算平台，围绕平台给商户结算时要合并订单、退款、服务费、扣罚和申诉状态展开。

### 核心功能

1. **数据录入**：商户、订单、退款、扣罚、申诉
2. **结算流程**：创建 → 计算 → 确认 → 冻结/解冻 → 打款
3. **异常处理**：状态变更历史、失败原因、幂等性保证
4. **人工修正**：记录前后差异和操作者
5. **报告导出**：商户对账单、结算明细、汇总报告

### 业务规则

- ✅ **同一订单重复结算检测**：通过 `SettlementItem` 记录已结算项目
- ✅ **申诉期间扣罚暂缓**：申诉状态为 PENDING/REVIEWING 的扣罚不参与结算
- ✅ **退款跨账期抵扣**：退款根据完成时间归属，不强制要求和订单同期
- ✅ **负结算转下期**：结算金额 < 0 时，payableAmount = 0，nextCarryOver = 负金额
- ✅ **幂等性保证**：支持 `X-Idempotency-Key` 请求头
- ✅ **人工修正留痕**：`ManualAdjustment` 表记录 beforeAmount/afterAmount/operator

---

## 环境准备

### 1. 安装依赖

```bash
# Node.js >= 18
node -v

# PostgreSQL >= 14
psql --version
```

### 2. 安装项目依赖

```bash
cd /Users/mac/pro/solo/workspaces/xy10515
npm install
```

### 3. 配置数据库

```bash
# 创建数据库
createdb merchant_settlement

# 复制环境变量配置
cp .env.example .env

# 编辑 .env，修改数据库连接信息
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/merchant_settlement?schema=public"
```

---

## 初始化数据库

### 1. 生成 Prisma Client

```bash
npx prisma generate
```

### 2. 执行数据库迁移

```bash
npx prisma migrate dev --name init
```

### 3. 导入演示数据（推荐）

```bash
npx prisma db seed
```

> 这会创建 5 个完整的业务场景演示数据，详见下方"演示数据说明"

---

## 启动服务

### 开发模式（热重载）

```bash
npm run dev
```

### 生产模式

```bash
npm run build
npm start
```

### 验证服务

```bash
# 健康检查
curl http://localhost:3000/health

# API 信息
curl http://localhost:3000/api
```

---

## 演示数据说明

执行 `prisma db seed` 后，会创建以下 5 个商户的演示场景：

| 商户编号 | 商户名称 | 场景类型 | 关键数据 |
|---------|---------|---------|---------|
| M000001 | 测试商户A - 正常结算 | ✅ 正常结算 | 3订单4500 + 1退款200 + 服务费135 = 应结4165 |
| M000002 | 测试商户B - 扣罚冻结 | ❄️ 扣罚冻结 | 订单3000 - 服务费150 - 扣罚500 = 2350（风控冻结） |
| M000003 | 测试商户C - 申诉通过 | ✅ 申诉通过 | 扣罚1000申诉成功，最终结算4750已打款 |
| M000004 | 测试商户D - 申诉失败 | ❌ 申诉失败 | 扣罚300申诉驳回，最终结算2075已打款 |
| M000005 | 测试商户E - 跨期抵扣 | 🔄 跨期抵扣 | 2023-12期负150结转，2024-01期抵扣后结算2700 |

---

## 主要演示路径

### 路径 1：完整结算流程（从创建到打款）

**场景**：新商户有订单和退款，走完整结算流程

```bash
# 1. 创建商户
curl -X POST http://localhost:3000/api/merchants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "演示商户-完整流程",
    "phone": "13900000001",
    "contactName": "演示人",
    "bankAccount": "6222020000000000001",
    "bankName": "招商银行"
  }'

# 2. 创建订单（假设商户号为 M000006）
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "merchantNo": "M000006",
    "merchantOrderNo": "TEST-001",
    "amount": 2000,
    "serviceFee": 60,
    "platformFee": 40,
    "payTime": "2024-02-10T10:00:00Z"
  }'

# 3. 创建退款
curl -X POST http://localhost:3000/api/refunds \
  -H "Content-Type: application/json" \
  -d '{
    "orderNo": "O20240210xxxxxx",
    "amount": 200,
    "reason": "商品瑕疵",
    "applyTime": "2024-02-12T14:00:00Z",
    "completeTime": "2024-02-12T16:00:00Z"
  }'

# 4. 计算结算单（预览）
curl -X POST http://localhost:3000/api/settlements/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "merchantNo": "M000006",
    "period": "2024-02",
    "settlementDate": "2024-02-29T00:00:00Z"
  }'

# 5. 创建结算单
curl -X POST http://localhost:3000/api/settlements \
  -H "Content-Type: application/json" \
  -d '{
    "merchantNo": "M000006",
    "period": "2024-02",
    "settlementDate": "2024-02-29T00:00:00Z",
    "operator": "finance_user"
  }'

# 6. 确认结算
curl -X POST http://localhost:3000/api/settlements/{settlementId}/confirm \
  -H "Content-Type: application/json" \
  -d '{ "operator": "finance_manager" }'

# 7. 发起打款
curl -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "settlementNo": "S20240229xxxxxx",
    "operator": "payment_operator"
  }'

# 8. 确认打款成功
curl -X POST http://localhost:3000/api/payments/{paymentNo}/success \
  -H "Content-Type: application/json" \
  -d '{ "operator": "bank_callback" }'

# 9. 查看结算单详情（包含状态历史）
curl http://localhost:3000/api/settlements/no/S20240229xxxxxx

# 10. 导出对账单
curl -X POST http://localhost:3000/api/reports/merchant-statement \
  -H "Content-Type: application/json" \
  -d '{ "merchantNo": "M000006", "startPeriod": "2024-02", "endPeriod": "2024-02" }'
```

---

### 路径 2：申诉流程（申诉成功，扣罚取消）

**场景**：商户对扣罚有异议，提起申诉，审核通过后扣罚取消

```bash
# 1. 先有扣罚（或用演示数据中的 M000003）
# 查询扣罚状态
curl http://localhost:3000/api/penalties/no/P2024011300002

# 2. 商户提起申诉
curl -X POST http://localhost:3000/api/appeals \
  -H "Content-Type: application/json" \
  -d '{
    "penaltyNo": "P2024011300002",
    "merchantNo": "M000003",
    "reason": "已提供物流凭证，证明在约定时间内发货",
    "evidence": "物流单号：SF1234567890",
    "applyTime": "2024-01-13T10:00:00Z"
  }'

# 3. 查看申诉详情（状态应为 APPEALING）
curl http://localhost:3000/api/appeals/no/A2024011300001

# 4. 审核申诉（通过）
curl -X POST http://localhost:3000/api/appeals/{appealId}/review \
  -H "Content-Type: application/json" \
  -d '{
    "status": "APPROVED",
    "reviewResult": "申诉通过，物流凭证有效，扣罚取消",
    "operator": "appeal_dept"
  }'

# 5. 验证扣罚状态（应为 CANCELLED）
curl http://localhost:3000/api/penalties/no/P2024011300002

# 6. 查看状态变更历史
# 在扣罚详情的 statusHistory 中可看到：
# PENDING → APPEALING → CANCELLED
```

---

### 路径 3：人工调整 + 负结转

**场景**：结算金额为负或需要人工修正

**演示数据查看**（商户 M000005）：

```bash
# 查看 2023-12 期结算（负150结转）
curl http://localhost:3000/api/settlements/no/S2023123100005

# 查看 2024-01 期结算（抵扣上期 -150 + 人工调整 +50）
curl http://localhost:3000/api/settlements/no/S2024011500006

# 查看人工调整记录（前后金额、操作人）
# 在 settlement 的 manualAdjustments 字段中
```

**计算逻辑验证**：

```
2023-12期：
订单 1000 - 退款 500 - 服务费 50 - 扣罚 600 = -150
→ payableAmount = 0, nextCarryOver = -150

2024-01期：
上期结转 -150 + 订单 3000 - 服务费 150 = 2700
→ 人工调整 +50 = 2750
→ payableAmount = 2750
```

---

## 失败路径演示

### 失败场景 1：重复结算

```bash
# 尝试对同一商户同一账期创建两次结算单
curl -X POST http://localhost:3000/api/settlements \
  -H "Content-Type: application/json" \
  -d '{
    "merchantNo": "M000001",
    "period": "2024-01",
    "settlementDate": "2024-01-15T00:00:00Z"
  }'

# 预期返回：400 错误，"该账期已存在结算单"
```

### 失败场景 2：申诉中扣罚尝试结算

```bash
# 1. 创建处于申诉中的扣罚
curl -X POST http://localhost:3000/api/penalties \
  -H "Content-Type: application/json" \
  -d '{
    "merchantNo": "M000001",
    "amount": 100,
    "type": "PERFORMANCE",
    "reason": "测试扣罚",
    "applyTime": "2024-02-01T10:00:00Z"
  }'

# 2. 确认扣罚
curl -X PUT http://localhost:3000/api/penalties/{penaltyId}/status \
  -H "Content-Type: application/json" \
  -d '{ "status": "CONFIRMED", "operator": "test" }'

# 3. 提起申诉
curl -X POST http://localhost:3000/api/appeals \
  -H "Content-Type: application/json" \
  -d '{
    "penaltyNo": "P20240201xxxxxx",
    "merchantNo": "M000001",
    "reason": "异议",
    "applyTime": "2024-02-02T10:00:00Z"
  }'

# 4. 计算新账期结算（该扣罚不会被纳入）
curl -X POST http://localhost:3000/api/settlements/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "merchantNo": "M000001",
    "period": "2024-02",
    "settlementDate": "2024-02-29T00:00:00Z"
  }'

# 验证：penaltyAmount 应不包含申诉中的扣罚
```

### 失败场景 3：打款失败后重试

```bash
# 1. 用演示数据中的结算单 S2024011500001（状态 CONFIRMED）
curl http://localhost:3000/api/settlements/no/S2024011500001

# 2. 发起打款
curl -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "settlementNo": "S2024011500001",
    "operator": "test_operator"
  }'

# 3. 模拟打款失败
curl -X POST http://localhost:3000/api/payments/{paymentNo}/fail \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "银行卡状态异常",
    "operator": "bank"
  }'

# 4. 查看结算单状态（应为 FAILED）
curl http://localhost:3000/api/settlements/no/S2024011500001

# 5. 重试打款
curl -X POST http://localhost:3000/api/payments/{paymentNo}/retry \
  -H "Content-Type: application/json" \
  -d '{ "operator": "test_operator" }'

# 6. 查看打款历史（payment 的 statusHistory）
curl http://localhost:3000/api/payments/{newPaymentNo}
```

### 失败场景 4：幂等性测试

```bash
# 使用相同的 X-Idempotency-Key 发送两次请求
curl -X POST http://localhost:3000/api/merchants \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: my-unique-key-001" \
  -d '{
    "name": "幂等测试商户",
    "phone": "13900000099"
  }'

# 第二次调用（应返回相同结果，不重复创建）
curl -X POST http://localhost:3000/api/merchants \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: my-unique-key-001" \
  -d '{
    "name": "幂等测试商户",
    "phone": "13900000099"
  }'

# 验证：商户列表只增加了一个商户
curl http://localhost:3000/api/merchants
```

---

## 核心数据验证

通过以下查询验证业务闭环：

### 验证结算计算

```bash
# 商户 A 正常结算应结 4165
# 公式：订单 4500 - 退款 200 - 服务费 135 = 4165
curl http://localhost:3000/api/reports/merchant-statement \
  -H "Content-Type: application/json" \
  -d '{ "merchantNo": "M000001" }'
```

### 验证状态流转

```bash
# 查看商户 C 的完整状态历史
# 扣罚：PENDING → APPEALING → CANCELLED
# 申诉：PENDING → REVIEWING → APPROVED
# 结算：PENDING → CONFIRMED → PAYING → PAID
curl http://localhost:3000/api/settlements/no/S2024011500003
```

### 验证人工调整留痕

```bash
# 商户 E 有一条人工调整记录，包含：
# - beforeAmount: 2700
# - afterAmount: 2750
# - operator: finance_manager
# - reason: 上期退款手续费优惠返还
curl http://localhost:3000/api/settlements/no/S2024011500006
```

---

## API 端点速查

| 模块 | 方法 | 路径 | 说明 |
|-----|-----|------|-----|
| 商户 | POST | `/api/merchants` | 创建商户 |
| 商户 | GET | `/api/merchants` | 商户列表 |
| 商户 | GET | `/api/merchants/no/:merchantNo` | 商户详情 |
| 订单 | POST | `/api/orders` | 创建订单 |
| 订单 | GET | `/api/orders` | 订单列表 |
| 退款 | POST | `/api/refunds` | 创建退款 |
| 扣罚 | POST | `/api/penalties` | 创建扣罚 |
| 扣罚 | PUT | `/api/penalties/:id/status` | 更新扣罚状态 |
| 申诉 | POST | `/api/appeals` | 创建申诉 |
| 申诉 | POST | `/api/appeals/:id/review` | 审核申诉 |
| 结算 | POST | `/api/settlements/calculate` | 计算结算单（预览） |
| 结算 | POST | `/api/settlements` | 创建结算单 |
| 结算 | POST | `/api/settlements/:id/confirm` | 确认结算 |
| 结算 | POST | `/api/settlements/:id/freeze` | 冻结结算 |
| 结算 | POST | `/api/settlements/:id/unfreeze` | 解冻结算 |
| 结算 | POST | `/api/settlements/:id/manual-adjust` | 人工调整 |
| 打款 | POST | `/api/payments` | 发起打款 |
| 打款 | POST | `/api/payments/:paymentNo/success` | 打款成功 |
| 打款 | POST | `/api/payments/:paymentNo/fail` | 打款失败 |
| 打款 | POST | `/api/payments/:paymentNo/retry` | 重试打款 |
| 报告 | POST | `/api/reports/merchant-statement` | 商户对账单 |
| 报告 | GET | `/api/reports/settlement-detail/:no` | 结算明细 |
| 报告 | GET | `/api/reports/settlement-export/:no` | 导出 CSV |
| 报告 | POST | `/api/reports/summary` | 汇总报告 |

---

## 故障排查

### 数据库连接失败

```bash
# 检查 PostgreSQL 是否运行
brew services list | grep postgresql

# 测试连接
psql -h localhost -U postgres -d merchant_settlement
```

### 迁移失败

```bash
# 重置数据库（慎用，会清除数据）
npx prisma migrate reset

# 重新执行
npx prisma migrate dev
```

### Seed 数据失败

```bash
# 清除现有数据后重试
npx prisma migrate reset
npx prisma db seed
```
