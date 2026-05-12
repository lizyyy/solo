# 跨境清关资料 API

跨境订单出库前报关资料校验系统 - 解决因身份证照片、商品税号缺失导致清关退回的问题。

---

## 一、快速启动

### 1. 安装依赖
```bash
npm install
```

### 2. 初始化样例数据
```bash
npm run seed
```
> 这会创建 5 个预设样例订单和 8 个税号配置。

### 3. 启动服务
```bash
npm start
```
> 服务运行在 http://localhost:3000

### 4. 运行自动化演示（新开终端）
```bash
npm run demo
```
> 自动执行 6 条演示路径，输出每一步状态变化。

---

## 二、项目结构

```
cross-border-customs-api/
├── src/
│   ├── server.js                 # 服务入口
│   ├── config/
│   │   ├── database.js           # SQLite 配置
│   │   └── constants.js          # 状态常量定义
│   ├── models/
│   │   └── init.js               # 数据表初始化
│   ├── services/
│   │   ├── rules.js              # 核心业务规则引擎 ⭐
│   │   └── orderService.js       # 订单服务层
│   └── routes/
│       ├── orders.js             # 订单导入/查询
│       ├── documents.js          # 证件校验/人工修正
│       ├── taxcodes.js           # 税号维护/校验
│       ├── customs.js            # 预检/补件/放行/出库 ⭐
│       └── reports.js            # 统计/导出/时间线
├── scripts/
│   ├── seed.js                   # 样例数据生成
│   └── demo.js                   # 自动化演示脚本
└── data/
    └── customs.db                # SQLite 数据库（自动生成）
```

---

## 三、核心数据模型

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| **orders** | 订单主表 | order_no, status, receiver_* |
| **order_items** | 订单商品 | sku_code, tax_code, category_code |
| **documents** | 证件资料 | doc_type, verified_status, expiry_date |
| **tax_codes** | 税号配置 | tax_code, category_code, is_active |
| **checkpoints** | 检查点记录 | checkpoint_type, passed, error_message, **idempotent_key** |
| **supplements** | 补件记录 | reason_code, status, attempt_no, deadline_at |
| **status_history** | 状态历史 | from_status, to_status, changed_by, reason |
| **manual_corrections** | 人工修正 | **old_value, new_value**, corrected_by |

---

## 四、订单状态流转

```
imported → docs_pending → docs_verified → taxcode_pending → taxcode_verified
                                                                 ↓
shipped ← approved ← ready ← supplement_completed ← supplement_pending ← precheck_failed
                            ↓
                   supplement_timeout / rejected
```

---

## 五、样例数据说明

运行 `npm run seed` 后会创建以下样例订单：

| 订单号 | 场景 | 预期结果 |
|--------|------|----------|
| **DEMO-001-PERFECT** | 资料齐全 | 直接放行出库 ✅ |
| **DEMO-002-NO-DOCS** | 缺身份证 | 触发补件，人工修正后放行 |
| **DEMO-003-BAD-TAXCODE** | 税号品类不匹配 | T恤误用手机税号，需修正 |
| **DEMO-004-IDEM** | 幂等性测试 | 重复预检只产生1条记录 |
| **DEMO-005-EXPIRED** | 证件过期 | 校验失败，无法放行 |

---

## 六、API 接口速查

### 6.1 订单管理 (`/api/orders`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/orders` | 导入订单（幂等：按 order_no） |
| GET | `/api/orders` | 分页查询订单列表 |
| GET | `/api/orders/:orderNo` | **订单详情**（含状态、商品、证件、检查点、补件、历史、人工修正、风险评估） |

### 6.2 证件校验 (`/api/documents`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/documents/verify` | 证件校验（幂等） |
| POST | `/api/documents/manual-correct` | **人工修正**（必须记录前后差异和操作者） |

### 6.3 税号维护 (`/api/taxcodes`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/taxcodes` | 查询税号列表 |
| POST | `/api/taxcodes` | 新增税号 |
| PUT | `/api/taxcodes/:taxCode` | 更新税号 |
| POST | `/api/taxcodes/verify` | 订单税号校验（幂等） |
| POST | `/api/taxcodes/update-item-tax` | 修正商品税号 |

### 6.4 清关流程 (`/api/customs`) ⭐

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/customs/precheck` | **清关预检**（综合校验，幂等，自动创建补件） |
| POST | `/api/customs/supplement/request` | **补件申请**（检查重复补件、次数上限） |
| POST | `/api/customs/supplement/submit` | 补件提交（幂等，检查超时） |
| POST | `/api/customs/supplement/approve` | 补件审核（幂等） |
| POST | `/api/customs/approve` | **放行审批**（必须预检通过） |
| POST | `/api/customs/ship` | **出库**（必须放行通过，否则拦截） |

### 6.5 报告统计 (`/api/reports`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/reports/statistics` | 全局统计（状态分布、补件统计、风险订单） |
| GET | `/api/reports/reports/export` | 导出报告（支持 json/csv） |
| GET | `/api/reports/orders/:orderNo/history` | **完整时间线**（状态变更+检查点+补件+人工修正） |

---

## 七、主要演示路径

### 路径 1: 资料齐全 → 直接放行
**订单**: DEMO-001-PERFECT

```bash
# 1. 证件校验
curl -X POST http://localhost:3000/api/documents/verify \
  -H "Content-Type: application/json" \
  -d '{"order_no":"DEMO-001-PERFECT","doc_type":"id_card","verified_by":"user_01"}'

# 2. 税号校验
curl -X POST http://localhost:3000/api/taxcodes/verify \
  -H "Content-Type: application/json" \
  -d '{"order_no":"DEMO-001-PERFECT","verified_by":"user_01"}'

# 3. 清关预检
curl -X POST http://localhost:3000/api/customs/precheck \
  -H "Content-Type: application/json" \
  -d '{"order_no":"DEMO-001-PERFECT","checked_by":"user_01"}'

# 4. 放行审批
curl -X POST http://localhost:3000/api/customs/approve \
  -H "Content-Type: application/json" \
  -d '{"order_no":"DEMO-001-PERFECT","approved_by":"manager_01"}'

# 5. 出库
curl -X POST http://localhost:3000/api/customs/ship \
  -H "Content-Type: application/json" \
  -d '{"order_no":"DEMO-001-PERFECT","shipped_by":"warehouse_01","waybill_no":"SF123456"}'

# 6. 查看最终状态
curl http://localhost:3000/api/orders/DEMO-001-PERFECT
```

**预期状态变化**: imported → docs_pending → docs_verified → taxcode_pending → taxcode_verified → precheck_pending → ready → approved → shipped

---

### 路径 2: 缺证件 → 人工修正 → 补件完成
**订单**: DEMO-002-NO-DOCS

```bash
# 1. 证件校验（失败：身份证缺失）
curl -X POST http://localhost:3000/api/documents/verify \
  -H "Content-Type: application/json" \
  -d '{"order_no":"DEMO-002-NO-DOCS","doc_type":"id_card","verified_by":"user_01"}'

# 2. 人工修正身份证（记录差异）
curl -X POST http://localhost:3000/api/documents/manual-correct \
  -H "Content-Type: application/json" \
  -d '{
    "order_no":"DEMO-002-NO-DOCS",
    "field_name":"receiver_id_number",
    "new_value":"110101199505054321",
    "corrected_by":"operator_01",
    "correction_reason":"客户补充身份证"
  }'

# 3. 人工修正有效期
curl -X POST http://localhost:3000/api/documents/manual-correct \
  -H "Content-Type: application/json" \
  -d '{
    "order_no":"DEMO-002-NO-DOCS",
    "field_name":"receiver_id_expiry_date",
    "new_value":"2033-08-15",
    "corrected_by":"operator_01",
    "correction_reason":"客户补充有效期"
  }'

# 4. 重新校验（使用新的幂等键）
curl -X POST http://localhost:3000/api/documents/verify \
  -H "Content-Type: application/json" \
  -d '{"order_no":"DEMO-002-NO-DOCS","doc_type":"id_card","idempotent_key":"doc_verify_DEMO-002_v2"}'

# 5. 继续后续流程...
# 查看时间线验证人工修正记录
curl http://localhost:3000/api/reports/orders/DEMO-002-NO-DOCS/history
```

---

### 路径 3: 税号品类不匹配 → 修正 → 通过
**订单**: DEMO-003-BAD-TAXCODE (T恤用了手机税号 85171210)

```bash
# 1. 税号校验（失败：品类不匹配）
curl -X POST http://localhost:3000/api/taxcodes/verify \
  -H "Content-Type: application/json" \
  -d '{"order_no":"DEMO-003-BAD-TAXCODE","verified_by":"user_01"}'

# 查看错误详情
# 响应会显示: 税号 85171210 与品类 CLTH 不匹配，该税号对应品类为 ELEC

# 2. 修正商品税号
curl -X POST http://localhost:3000/api/taxcodes/update-item-tax \
  -H "Content-Type: application/json" \
  -d '{
    "order_no":"DEMO-003-BAD-TAXCODE",
    "sku_code":"T-SHIRT",
    "tax_code":"61091000",
    "category_code":"CLTH",
    "updated_by":"tax_operator",
    "update_reason":"税号品类不匹配，修正为服装类"
  }'

# 3. 重新校验
curl -X POST http://localhost:3000/api/taxcodes/verify \
  -H "Content-Type: application/json" \
  -d '{"order_no":"DEMO-003-BAD-TAXCODE","idempotent_key":"tax_verify_DEMO-003_v2"}'
```

---

### 路径 4: 幂等性演示 - 重复预检
**订单**: DEMO-004-IDEM

```bash
# 连续调用3次，使用相同 idempotent_key
for i in 1 2 3; do
  curl -X POST http://localhost:3000/api/customs/precheck \
    -H "Content-Type: application/json" \
    -d '{"order_no":"DEMO-004-IDEM","idempotent_key":"precheck_DEMO-004"}'
  echo ""
done

# 查看检查点记录数（应该只有1条）
curl http://localhost:3000/api/orders/DEMO-004-IDEM
```

---

## 八、失败路径演示

### 场景: 证件过期 + 强行出库被拦截
**订单**: DEMO-005-EXPIRED

```bash
# 1. 证件校验（失败：证件已过期）
curl -X POST http://localhost:3000/api/documents/verify \
  -H "Content-Type: application/json" \
  -d '{"order_no":"DEMO-005-EXPIRED","doc_type":"id_card"}'
# 响应: 证件已过期

# 2. 试图直接放行（失败：订单状态不对）
curl -X POST http://localhost:3000/api/customs/approve \
  -H "Content-Type: application/json" \
  -d '{"order_no":"DEMO-005-EXPIRED","approved_by":"manager_01"}'
# 响应: 订单状态不允许放行，当前必须为 ready

# 3. 试图强行出库（被拦截）
curl -X POST http://localhost:3000/api/customs/ship \
  -H "Content-Type: application/json" \
  -d '{"order_no":"DEMO-005-EXPIRED","shipped_by":"warehouse_01"}'
# 响应: 订单未通过清关审核，无法出库

# 4. 查看订单风险状态
curl http://localhost:3000/api/orders/DEMO-005-EXPIRED
# 响应中 risk_assessment.level = "high", canShip = false
```

---

## 九、业务规则实现

| 规则 | 实现位置 | 说明 |
|------|----------|------|
| **重复补件检测** | `rules.canRequestSupplement()` | 检查是否存在未完成补件、是否超过3次上限 |
| **证件过期校验** | `rules.validateIdExpiry()` | 比较有效期与当前日期 |
| **税号品类匹配** | `rules.validateTaxCodeCategory()` | 校验 tax_code 对应的 category_code |
| **资料未通过禁出库** | `rules.canShip()` | 检查 status=approved 且存在 approval 检查点 |
| **补件超时** | `rules.checkSupplementTimeout()` | 72小时超时判断（可配置） |
| **幂等性保护** | `recordCheckpoint()` | 所有关键操作支持 idempotent_key |
| **人工修正留痕** | `manual_corrections` 表 | 必须记录 old_value, new_value, corrected_by |

---

## 十、如何判断业务闭环

调用订单详情接口 `GET /api/orders/:orderNo`，查看以下字段：

```json
{
  "data": {
    "order": { "status": "shipped" },           // 最终状态
    "checkpoints": [...],                       // 每一步检查记录
    "supplements": [...],                       // 补件历史（如有）
    "status_history": [...],                    // 完整状态流转
    "manual_corrections": [...],                // 人工修正记录（含前后差异）
    "latest_failure": null,                     // 最近失败原因
    "risk_assessment": {
      "level": "low",                           // 风险等级
      "canShip": true                           // 是否允许出库
    }
  }
}
```

**判断标准**:
- ✅ **闭环成功**: status = shipped，risk_assessment.canShip = true，checkpoints 包含 approval + shipment 且 passed=1
- ⚠️ **处理中**: status = supplement_pending，查看 supplements 中的 deadline_at
- ❌ **闭环失败**: status = rejected/supplement_timeout，查看 latest_failure.error_message

---

## 十一、重置演示

```bash
# 1. 停止服务 (Ctrl+C)
# 2. 清空数据库
rm -rf data/customs.db*
# 3. 重新初始化
npm run seed
npm start
```

---

## 十二、常用查询

```bash
# 查看所有订单状态
curl "http://localhost:3000/api/orders"

# 查看统计
curl "http://localhost:3000/api/reports/statistics"

# 导出 CSV 报告
curl "http://localhost:3000/api/reports/reports/export?format=csv" -o report.csv

# 查看税号配置
curl "http://localhost:3000/api/taxcodes"
```
