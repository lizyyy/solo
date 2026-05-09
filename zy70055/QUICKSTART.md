# 商户清算异常挂起服务 - 快速开始

## 快速启动

```bash
npm install
npm run db:init
npm run seed
npm run dev
```

打开 http://localhost:3000 查看服务信息

## 启动后测试指南

### 第一步：查看概览

```bash
curl http://localhost:3000/api/reports/dashboard
```

你会看到：
- 总批次数量
- 各状态批次统计
- 待处理异常数量

**下一步要查哪里？** 如果有未处理异常 → 查 `GET /api/exceptions/pending`

---

### 第二步：查看待处理异常

```bash
curl http://localhost:3000/api/exceptions/pending
```

种子数据预设了 3 个挂起的异常：
1. 高退款比例 (商户 MCH002)
2. 拒付未解决 (商户 MCH003)

**下一步要查哪里？** 点击某个异常对应的 batchId → 查 `GET /api/batches/:id/exceptions`

---

### 第三步：查看某个挂起批次的详情

```bash
# 先用 GET /api/batches?status=SUSPENDED 找到挂起批次
curl "http://localhost:3000/api/batches?status=SUSPENDED"

# 取第一个挂起批次的 id，查看其异常详情
curl "http://localhost:3000/api/batches/<batch_id>/exceptions"
```

**下一步要查哪里？**
- 如果异常需要人工核实 → 联系风控/运营处理
- 处理完后 → 调 `POST /api/exceptions/:exceptionNo/resolve` 标记解决

---

### 场景 A：正常清算流程（无异常）

找一个 APPROVED 状态的批次，继续走完流程：

```bash
# 1. 生成出款报表
curl -X POST "http://localhost:3000/api/reports/batches/<batch_id>/generate" \
  -H "Content-Type: application/json" \
  -d '{"generatedBy": "finance_user"}'

# 2. 标记已出款
curl -X POST "http://localhost:3000/api/reports/batches/<batch_id>/mark-paid" \
  -H "Content-Type: application/json" \
  -d '{"operator": "finance_user"}'
```

**下一步要查哪里？** 查 `GET /api/reports/batches/:batch_id` 确认报表已生成

---

### 场景 B：异常挂起 → 解挂审批流程

假设你有一个 SUSPENDED 批次：

```bash
# 1. 先看这个批次有哪些未解决的异常
curl "http://localhost:3000/api/batches/<batch_id>/exceptions"

# 2. 逐个解决异常（实际需要业务核实）
curl -X POST "http://localhost:3000/api/exceptions/<exception_no>/resolve" \
  -H "Content-Type: application/json" \
  -d '{"resolvedBy": "risk_user", "resolutionNote": "与持卡人协商和解，拒付已撤销"}'

# 3. 申请解挂
curl -X POST "http://localhost:3000/api/batches/<batch_id>/unsuspend/request" \
  -H "Content-Type: application/json" \
  -d '{"requester": "operator_user", "requestNote": "所有异常已处理完毕"}'

# 4. 审批解挂（注意要从请求返回里拿到 approvalId）
curl -X POST "http://localhost:3000/api/batches/<batch_id>/unsuspend/approve" \
  -H "Content-Type: application/json" \
  -d '{"approvalId": "<approval_id>", "approver": "manager_user", "approvalNote": "同意解挂"}'
```

**下一步要查哪里？** 批准后批次状态变为 PROCESSING → 继续走 `场景 A` 的审批出款流程

---

### 场景 C：创建新批次（测试自动挂起规则）

创建一个高退款比例的批次，看自动挂起是否生效：

```bash
# 先获取商户列表
curl "http://localhost:3000/api/merchants"

# 创建一个高退款批次
curl -X POST "http://localhost:3000/api/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "<merchant_id>",
    "settlementDate": "2026-05-09",
    "operator": "test_user",
    "transactions": [
      {
        "transactionNo": "TEST-TXN-001",
        "transactionDate": "2026-05-08",
        "amount": 10000,
        "refundAmount": 2500,
        "hasPendingRefund": true
      }
    ]
  }'

# 拿到返回的 batch.id 后，执行处理
curl -X POST "http://localhost:3000/api/batches/<batch_id>/process" \
  -H "Content-Type: application/json" \
  -d '{"operator": "test_user"}'
```

**预期结果：** 因为退款比例 25% > 阈值 10%，批次会被自动挂起
**下一步要查哪里？** 查 `GET /api/batches/:id/exceptions` 看产生了哪些异常记录

---

### 场景 D：测试重复操作（防重机制）

```bash
# 同一个批次多次调用 suspend，第二次应该返回 409
curl -X POST "http://localhost:3000/api/batches/<suspended_batch_id>/suspend" \
  -H "Content-Type: application/json" \
  -d '{"reason": "REFUND", "note": "测试重复操作", "operator": "test_user"}'
```

**预期结果：** 第二次调用返回 `DUPLICATE_OPERATION` 错误
**下一步要查哪里？** 看错误信息里的提示，确认批次当前状态

---

## 关键配置阈值

默认挂起阈值在 `src/config/index.ts`：

```typescript
export const SUSPEND_THRESHOLDS = {
  REFUND_RATIO: 0.1,      // 退款比例超过 10% 挂起
  CHARGEBACK_RATIO: 0.05, // 拒付比例超过 5% 挂起
  FEE_TOLERANCE: 0.001,   // 手续费容差 0.1%
  MIN_AMOUNT_TO_CHECK: 100,
};
```

可根据业务需要调整。

---

## 核心数据模型

### 状态流转

```
PENDING → PROCESSING → APPROVED → PAID
             ↓
          SUSPENDED → [审批解挂] → PROCESSING
```

### 主要枚举

| 枚举 | 值 |
|------|-----|
| 批次状态 | PENDING / PROCESSING / SUSPENDED / APPROVED / REJECTED / PAID |
| 挂起原因 | REFUND / CHARGEBACK / FEE_ADJUSTMENT / BANK_ERROR / MANUAL / OTHER |
| 异常类型 | REFUND_PENDING / CHARGEBACK_PENDING / FEE_MISMATCH / ... |

---

## 关键文件索引

| 模块 | 文件路径 | 说明 |
|------|---------|------|
| 数据模型 | `prisma/schema.prisma` | 所有表结构和枚举 |
| 批次服务 | `src/services/settlementBatchService.ts` | 核心挂起/解挂逻辑 |
| 手续费规则 | `src/services/feeRuleService.ts` | 费率计算和校验 |
| 异常记录 | `src/services/exceptionService.ts` | 异常的创建/查询/解决 |
| 路由入口 | `src/routes/` | 所有 API 端点 |
| 种子数据 | `prisma/seed.ts` | 样例数据和测试场景 |

---

## 下一步扩展建议

1. **加鉴权**：当前未实现用户认证，可在 middleware 层加 JWT/OAuth
2. **加通知**：挂起时发站内信/邮件通知运营
3. **加定时任务**：定时扫描待处理异常并生成提醒
4. **接银行/网关**：`MARK_PAID` 阶段对接实际出款通道
5. **加报表导出**：出款报表支持导出 Excel/PDF
6. **加操作人信息**：所有接口传的 operator 可从鉴权上下文获取
