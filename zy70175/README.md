# 合同收款认领 API

后端闭环系统：收款流水 → 合同匹配 → 认领审批 → 发票核销 → 退款退回 → 财务报表

---

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload --port 8000
```

启动后打开浏览器访问 `http://localhost:8000/docs` 查看 Swagger 文档。

### 3. 造测试数据

```bash
python scripts/seed_data.py
```

脚本会创建：
- 3 份合同
- 3 张发票
- 3 条收款流水（包含规范和不规范备注）

### 4. 调用主流程（以 RCP-2026-001 为例）

**步骤 1：查看收款流水列表**
```bash
curl http://localhost:8000/receipts
```

**步骤 2：匹配合同（根据付款方、备注自动打分）**
```bash
curl -X POST http://localhost:8000/receipts/1/match
```

返回示例：
```json
{
  "receipt_id": 1,
  "receipt_no": "RCP-2026-001",
  "matches": [
    {
      "contract_id": 1,
      "contract_no": "CT-2026-001",
      "contract_name": "软件开发服务合同",
      "customer_name": "创新科技有限公司",
      "score": 80,
      "match_reason": "付款方名称与合同客户完全匹配；备注包含合同号"
    }
  ]
}
```

**步骤 3：提交认领**
```bash
curl -X POST http://localhost:8000/claims \
  -H "Content-Type: application/json" \
  -d '{
    "receipt_id": 1,
    "contract_id": 1,
    "amount": 100000.00,
    "applicant": "张三",
    "applicant_remark": "备注包含合同号，已与对方确认"
  }'
```

**步骤 4：审批认领**
```bash
curl -X POST http://localhost:8000/claims/1/approve \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "李四",
    "approve_remark": "匹配无误"
  }'
```

**步骤 5：发票核销**
```bash
curl -X POST http://localhost:8000/claims/1/reconcile \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "invoice_id": 1, "amount": 100000.00 }
    ]
  }'
```

**步骤 6：查看财务报表**
```bash
curl http://localhost:8000/reports/financial
```

---

## 触发异常场景

### 异常 1：重复提交收款流水
```bash
# 第一次（成功）
curl -X POST http://localhost:8000/receipts \
  -H "Content-Type: application/json" \
  -d '{
    "receipt_no": "TEST-001",
    "amount": 5000.00,
    "paid_at": "2026-05-10T10:00:00"
  }'

# 第二次（失败，返回 DUPLICATE_SUBMISSION）
curl -X POST http://localhost:8000/receipts \
  -H "Content-Type: application/json" \
  -d '{
    "receipt_no": "TEST-001",
    "amount": 5000.00,
    "paid_at": "2026-05-10T10:00:00"
  }'
```

### 异常 2：对已审批的认领单再次审批（非法流转）
```bash
curl -X POST http://localhost:8000/claims/1/approve \
  -H "Content-Type: application/json" \
  -d '{ "approver": "王五" }'
```
返回：
```json
{
  "code": "STATE_TRANSITION_ERROR",
  "message": "认领单#1 不允许从状态 [approved] 流转到 [approved]"
}
```

### 异常 3：认领金额超过流水剩余金额
```bash
curl -X POST http://localhost:8000/claims \
  -H "Content-Type: application/json" \
  -d '{
    "receipt_id": 1,
    "contract_id": 1,
    "amount": 9999999.00,
    "applicant": "张三"
  }'
```
返回：
```json
{
  "code": "AMOUNT_EXCEEDED",
  "message": "收款流水 金额不足: 可用 0.0, 请求 9999999.0"
}
```

### 异常 4：对已完全核销的发票再次核销
```bash
curl -X POST http://localhost:8000/claims/1/reconcile \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "invoice_id": 1, "amount": 100.00 }
    ]
  }'
```
返回：
```json
{
  "code": "INVALID_OPERATION",
  "message": "不能对 发票 执行 [核销]: 发票 #1 已完全核销"
}
```

### 异常 5：对终态（已退款）流水创建认领
先退款：
```bash
# 使用另一条未认领流水 RCP-2026-003（id=3）
curl -X POST http://localhost:8000/refunds \
  -H "Content-Type: application/json" \
  -d '{
    "receipt_id": 3,
    "amount": 25000.00,
    "reason": "对方打错款",
    "operator": "财务"
  }'

# 标记退款成功
curl -X POST http://localhost:8000/refunds/1/process \
  -H "Content-Type: application/json" \
  -d '{
    "success": true,
    "operator": "财务"
  }'

# 再创建认领（失败）
curl -X POST http://localhost:8000/claims \
  -H "Content-Type: application/json" \
  -d '{
    "receipt_id": 3,
    "contract_id": 3,
    "amount": 25000.00,
    "applicant": "张三"
  }'
```

---

## 查看结果

### 查看单条收款流水状态
```bash
curl http://localhost:8000/receipts/1
```

### 查看某条流水的所有认领记录
```bash
curl "http://localhost:8000/claims?receipt_id=1"
```

### 查看某张发票的核销记录
```bash
curl "http://localhost:8000/contracts/invoices/1"
```

### 查看合同已收款累计
```bash
curl http://localhost:8000/contracts/1
```

### 查看完整操作日志（状态流转审计）
```bash
# 查所有
curl http://localhost:8000/logs

# 按类型查（Receipt / Claim / Invoice / Refund / Reconciliation）
curl "http://localhost:8000/logs?target_type=Receipt"

# 查某条流水的日志
curl "http://localhost:8000/logs?target_type=Receipt&target_id=1"
```

### 重启后查历史
数据存储在项目根目录下的 `collection.db`（SQLite 数据库文件），服务重启后数据不丢失，可直接查询历史流水、认领单、报表。

```bash
# 直接用 sqlite 查
sqlite3 collection.db "SELECT receipt_no, status, amount FROM receipts;"
```

---

## 状态机说明

### 收款流水状态
```
unmatched → matched → pending_claim → claiming → claimed
                                      ↘         ↗
                                      partial_claimed
                                        ↓
                                      refunded (终态，不可逆转)
```

### 认领单状态
```
pending → approved (终态)
       ↘ rejected (终态)
```

### 发票状态
```
unreconciled → partial → reconciled (终态)
```

### 退款单状态
```
pending → processed (终态)
       ↘ failed → pending (可重试)
```

---

## 后台任务说明

本系统采用**同步处理**模型，不使用后台任务。如需异步场景（例如：银行流水定时拉取、对账定时生成），可参考以下设计：

### 如果使用后台任务（例如 Celery / APScheduler）

#### 失败表现
- 任务异常时，数据状态保持在操作前的状态，不产生中间脏状态
- 操作日志记录失败动作和原因
- 数据库事务回滚

#### 再次执行表现
- **退款失败可重试**：退款单状态 `failed` 时，可调用 `/refunds/{id}/retry` 将状态重置为 `pending` 再次执行
- **认领/核销**：必须通过新的请求发起，不支持重试已失败的操作（因为操作前已做状态机校验，失败说明前置条件不满足）
- **幂等性**：通过业务唯一键（收款流水号、发票号、认领单号）防重复提交，重复请求直接返回 `DUPLICATE_SUBMISSION`

---

## 项目结构

```
.
├── app/
│   ├── main.py              # FastAPI 入口
│   ├── config.py            # 配置
│   ├── database.py          # 数据库连接
│   ├── models.py            # SQLAlchemy 模型
│   ├── schemas.py           # Pydantic 请求/响应模型
│   ├── exceptions.py        # 业务异常
│   ├── state_machine.py     # 状态机与流转规则
│   ├── services/            # 业务逻辑层
│   │   ├── base_service.py
│   │   ├── receipt_service.py
│   │   ├── claim_service.py
│   │   ├── reconciliation_service.py
│   │   ├── refund_service.py
│   │   └── report_service.py
│   └── routers/             # API 路由
│       ├── receipts.py
│       ├── contracts.py
│       ├── claims.py
│       ├── refunds.py
│       ├── reports.py
│       └── logs.py
├── scripts/
│   └── seed_data.py         # 造数脚本
├── requirements.txt
├── README.md
└── collection.db            # 运行后自动生成
```
