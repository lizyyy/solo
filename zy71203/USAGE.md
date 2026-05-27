# 跨币种发票贴现 API 使用指南

## 🚀 启动方式

### 开发模式（推荐）
```bash
npm run dev
```
服务将在 `http://localhost:3000` 启动

### 生产模式
```bash
npm run build
npm start
```

### 健康检查
```bash
curl http://localhost:3000/api/health
```

---

## 📋 核心业务流程

```
创建发票贴现记录 → 贴现试算 → 提交审批 → 贴现 → 回款匹配 → 完成
     DRAFT        → PENDING_APPROVAL → APPROVED → DISCOUNTED → SETTLED → COMPLETED
```

---

## 🔌 API 端点总览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/calculate` | 贴现试算 |
| POST | `/api/invoices` | 创建发票贴现 |
| GET | `/api/invoices` | 查询列表（支持筛选） |
| GET | `/api/invoices/:id` | 查询详情 |
| PUT | `/api/invoices/:id` | 修正信息 |
| POST | `/api/invoices/:id/advance` | 推进状态 |
| POST | `/api/invoices/:id/export` | 导出报告 |
| POST | `/api/invoices/:id/profit-report` | 生成收益报告 |
| POST | `/api/payments` | 录入回款流水 |
| POST | `/api/payments/:id/match` | 手动匹配回款 |
| POST | `/api/bank-receipts` | 导入银行回执 |

---

## 💡 样例调用

### 1. 贴现试算（不保存数据）
```bash
curl -X POST http://localhost:3000/api/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceAmount": 100000,
    "invoiceCurrency": "USD",
    "discountRate": 3.5,
    "discountDays": 90,
    "exchangeRateToCNY": {
      "fromCurrency": "USD",
      "toCurrency": "CNY",
      "rate": 7.25,
      "rateDate": "2026-05-20",
      "source": "中国银行"
    },
    "interestCurrency": "CNY"
  }'
```

**返回说明：**
- `invoiceAmountCNY`: 发票金额换算人民币
- `discountInterestCNY`: 贴现利息（人民币）
- `netProceedsCNY`: 净到手金额
- `dailyInterestCNY`: 每日利息
- `effectiveAnnualRate`: 实际年化利率

### 2. 创建发票贴现记录
```bash
curl -X POST http://localhost:3000/api/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceNumber": "INV-2026-002",
    "invoiceDate": "2026-05-01",
    "invoiceAmount": 100000,
    "invoiceCurrency": "USD",
    "discountRate": 3.5,
    "discountDate": "2026-05-20",
    "discountDays": 90,
    "exchangeRateToCNY": {
      "fromCurrency": "USD",
      "toCurrency": "CNY",
      "rate": 7.25,
      "rateDate": "2026-05-19",
      "source": "中国银行"
    },
    "exchangeRatePaymentToCNY": {
      "fromCurrency": "EUR",
      "toCurrency": "CNY",
      "rate": 7.85,
      "rateDate": "2026-05-19",
      "source": "中国银行"
    }
  }'
```

**⚠️ 注意：** 响应中的 `missingFields` 会列出缺失的必填字段，不会自动假设默认值。

### 3. 查询发票列表
```bash
# 全部查询
curl http://localhost:3000/api/invoices

# 按状态筛选
curl "http://localhost:3000/api/invoices?status=DRAFT"

# 按发票号码模糊搜索
curl "http://localhost:3000/api/invoices?invoiceNumber=INV-2026"

# 按币种筛选
curl "http://localhost:3000/api/invoices?currency=USD"

# 按日期范围筛选
curl "http://localhost:3000/api/invoices?dateFrom=2026-05-01&dateTo=2026-05-31"
```

### 4. 推进状态（从 DRAFT 到 PENDING_APPROVAL）
```bash
# 先获取发票ID
INVOICE_ID=$(curl -s http://localhost:3000/api/invoices | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")

curl -X POST "http://localhost:3000/api/invoices/$INVOICE_ID/advance" \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "PENDING_APPROVAL",
    "operator": "财务小张",
    "remark": "资料齐全，提交审批"
  }'
```

### 5. 推进到部分贴现（PARTIALLY_SETTLED）
```bash
curl -X POST "http://localhost:3000/api/invoices/$INVOICE_ID/advance" \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "PARTIALLY_SETTLED",
    "operator": "财务小张",
    "partialDiscountAmount": 50000,
    "partialDiscountRate": 3.5
  }'
```

### 6. 录入回款流水
```bash
curl -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -d "{
    \"invoiceDiscountId\": \"$INVOICE_ID\",
    \"paymentAmount\": 62000,
    \"paymentCurrency\": \"EUR\",
    \"paymentDate\": \"2026-05-25\"
  }"
```

### 7. 导入银行回执（自动查重）
```bash
curl -X POST http://localhost:3000/api/bank-receipts \
  -H "Content-Type: application/json" \
  -d '{
    "receiptNumber": "BK-2026-0525-001",
    "receiptDate": "2026-05-25",
    "amount": 62000,
    "currency": "EUR",
    "invoiceDiscountId": "'"$INVOICE_ID"'"
  }'
```

### 8. 生成收益报告
```bash
curl -X POST "http://localhost:3000/api/invoices/$INVOICE_ID/profit-report" \
  -H "Content-Type: application/json" \
  -d '{
    "bankFeesCNY": 500
  }'
```

### 9. 导出报告（CSV/JSON）
```bash
# 导出 CSV（默认）
curl -X POST "http://localhost:3000/api/invoices/$INVOICE_ID/export" \
  -H "Content-Type: application/json" \
  -d '{"format": "csv"}' \
  -o export.csv

# 导出 JSON
curl -X POST "http://localhost:3000/api/invoices/$INVOICE_ID/export" \
  -H "Content-Type: application/json" \
  -d '{"format": "json"}' \
  -o export.json
```

### 10. 修正信息
```bash
curl -X PUT "http://localhost:3000/api/invoices/$INVOICE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "discountRate": 3.8,
    "revisionReason": "银行调整贴现利率",
    "operator": "财务小张"
  }'
```

---

## ❌ 会失败的操作示例

### 失败场景 1：汇率日期与贴现日期相差超过3天
```bash
curl -X POST http://localhost:3000/api/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceNumber": "INV-TEST-001",
    "invoiceDate": "2026-05-01",
    "invoiceAmount": 100000,
    "invoiceCurrency": "USD",
    "discountRate": 3.5,
    "discountDate": "2026-05-20",
    "discountDays": 90,
    "exchangeRateToCNY": {
      "fromCurrency": "USD",
      "toCurrency": "CNY",
      "rate": 7.25,
      "rateDate": "2026-05-10",
      "source": "中国银行"
    }
  }'
```

**预期结果：**
- `success: true` （操作成功，但有警告）
- `warnings` 包含：`汇率日期(2026-05-10)与贴现日期(2026-05-20)相差10天，超过最大允许3天`
- 数据仍然保存，但标记了风险

---

### 失败场景 2：状态非法跳转（从 DRAFT 直接到 DISCOUNTED）
```bash
INVOICE_ID=$(curl -s http://localhost:3000/api/invoices?status=DRAFT | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")

curl -X POST "http://localhost:3000/api/invoices/$INVOICE_ID/advance" \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "DISCOUNTED",
    "operator": "财务小张"
  }'
```

**预期结果：**
- `success: false`
- `error`: `无法从DRAFT状态转换到DISCOUNTED状态，允许的转换为: PENDING_APPROVAL`
- HTTP 状态码 400

---

### 失败场景 3：重复导入银行回执
```bash
# 第一次导入（成功）
curl -X POST http://localhost:3000/api/bank-receipts \
  -H "Content-Type: application/json" \
  -d '{
    "receiptNumber": "BK-DUP-TEST-001",
    "receiptDate": "2026-05-25",
    "amount": 50000,
    "currency": "EUR"
  }'

# 第二次导入相同号码（会被标记为重复）
curl -X POST http://localhost:3000/api/bank-receipts \
  -H "Content-Type: application/json" \
  -d '{
    "receiptNumber": "BK-DUP-TEST-001",
    "receiptDate": "2026-05-25",
    "amount": 50000,
    "currency": "EUR"
  }'
```

**预期结果：**
- 第一次：`success: true`, `isDuplicate: false`
- 第二次：`success: true`, `isDuplicate: true`, `duplicateOf` 指向第一次的 ID
- `warnings` 包含：`检测到重复回执，原始回执ID: xxxxx`
- 数据仍然保存，但标记为重复，不会混入正常结果

---

### 失败场景 4：缺少必填字段
```bash
curl -X POST http://localhost:3000/api/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceNumber": "INV-MISSING-001",
    "invoiceAmount": 100000,
    "discountRate": 3.5
  }'
```

**预期结果：**
- `success: false`
- `error`: `参数验证失败: Expected string, received undefined`
- HTTP 状态码 400
- **不会** 假设默认值

---

### 失败场景 5：部分贴现金额超过剩余金额
```bash
# 先创建一张新发票
INVOICE_ID=$(curl -s -X POST http://localhost:3000/api/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceNumber": "INV-PARTIAL-TEST",
    "invoiceDate": "2026-05-01",
    "invoiceAmount": 100000,
    "invoiceCurrency": "USD",
    "discountRate": 3.5,
    "discountDate": "2026-05-20",
    "discountDays": 90
  }' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

# 推进到 APPROVED
curl -X POST "http://localhost:3000/api/invoices/$INVOICE_ID/advance" \
  -H "Content-Type: application/json" \
  -d '{"targetStatus": "PENDING_APPROVAL", "operator": "test"}'

curl -X POST "http://localhost:3000/api/invoices/$INVOICE_ID/advance" \
  -H "Content-Type: application/json" \
  -d '{"targetStatus": "APPROVED", "operator": "test"}'

# 尝试部分贴现 150,000（超过发票金额 100,000）
curl -X POST "http://localhost:3000/api/invoices/$INVOICE_ID/advance" \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "PARTIALLY_SETTLED",
    "operator": "test",
    "partialDiscountAmount": 150000,
    "partialDiscountRate": 3.5
  }'
```

**预期结果：**
- `success: true` 但 `warnings` 包含：
  `部分贴现金额(150000)超过剩余未贴现金额(100000)`
- 数据仍然保存，但金额会被限制为剩余金额

---

## 🛡️ 关键防护机制

| 防护点 | 说明 |
|--------|------|
| **汇率日期校验** | 汇率日期与贴现日期相差超过3天会警告 |
| **日期顺序校验** | 发票日期不能晚于贴现日期 |
| **重复回执拦截** | 相同回执号或相同金额+日期会被标记为重复 |
| **状态流转校验** | 严格的状态机，不允许跳步 |
| **部分贴现校验** | 贴现金额不能超过剩余未贴现金额 |
| **缺失字段标记** | 不会假设默认值，明确列出缺失字段 |
| **回款匹配校验** | 币种不匹配不会自动匹配 |

---

## 📊 数据结构说明

### 状态流转
```
DRAFT (草稿)
    ↓
PENDING_APPROVAL (待审批) ←→ DRAFT
    ↓
APPROVED (已批准)
    ↓
DISCOUNTED (已贴现) / PARTIALLY_SETTLED (部分结算)
    ↓
FULLY_SETTLED (全部结算)
    ↓
COMPLETED (已完成)
```

### 币种支持
- `USD`: 美元（发票常用）
- `EUR`: 欧元（回款常用）
- `CNY`: 人民币（利息计算和报表）

---

## 🔍 调试技巧

1. **查看所有数据状态**
   ```bash
   curl http://localhost:3000/api/invoices | python3 -m json.tool
   ```

2. **查看完整流程日志**
   每个响应的 `warnings` 字段会列出所有潜在问题

3. **检查回执重复状态**
   ```bash
   curl http://localhost:3000/api/bank-receipts | python3 -c "
   import sys, json
   data = json.load(sys.stdin)
   for r in data['data']:
       print(f'{r['receiptNumber']} - 重复: {r['isDuplicate']}')
   "
   ```
