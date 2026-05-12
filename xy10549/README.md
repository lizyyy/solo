# 物流异常赔付 API

一个完整的物流异常件赔付处理系统，支持延误、破损、丢件三种异常类型，按客户等级自动计算赔付金额，追踪责任判定、审核和申诉全流程。

---

## 🚀 快速开始

### 1. 本地启动

```bash
# 无需安装任何依赖，系统使用 Node.js 内置模块
npm start

# 或者开发模式（自动重启）
npm run dev
```

服务启动后访问：
- **文档首页**: http://localhost:3000/
- **健康检查**: http://localhost:3000/health
- **统计数据**: http://localhost:3000/api/shipments/statistics

### 2. 运行演示（造数）

```bash
# 运行完整演示脚本，生成所有样例数据
npm test
```

演示脚本会执行以下 7 个场景：
1. **延误赔付** - 普通客户完整流程
2. **破损待审** - VIP 客户 + 幂等回调
3. **丢件确认** - VIP+ 客户 + 责任前置检查
4. **证据不足** - 失败路径演示
5. **不可抗力** - 暴雨延误不予赔付
6. **重复申诉** - 申诉拦截 + 改判
7. **人工修正** - 前后差异记录

---

## 📋 主要演示路径

### 路径 1：标准赔付流程（延误 → 完成）

```
运单导入 → 异常登记 → 责任判定 → 赔付计算 → 提交审核 → 审核通过 → 结案
```

**关键 API 调用：**

```bash
# 1. 导入运单
curl -X POST http://localhost:3000/api/waybills/import \
  -H "Content-Type: application/json" \
  -d '{
    "waybills": [{
      "waybillId": "SF1001234567890",
      "customerName": "张三",
      "carrier": "顺丰速运",
      "insuredAmount": 5000,
      "trackingEvents": [
        {"location": "上海", "status": "已揽收"},
        {"location": "北京", "status": "派送中"}
      ]
    }]
  }'

# 2. 创建异常件
curl -X POST http://localhost:3000/api/shipments \
  -H "Content-Type: application/json" \
  -d '{
    "waybillId": "SF1001234567890",
    "type": "delay",
    "description": "快件延误3天未送达",
    "customerLevel": "normal",
    "operator": "客服小王"
  }'

# 3. 责任判定
curl -X POST "http://localhost:3000/api/shipments/SH000001/liability?operator=理赔专员" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "confirmed",
    "responsibleParty": "顺丰速运",
    "reason": "物流节点显示延误"
  }'

# 4. 赔付计算
curl -X POST "http://localhost:3000/api/shipments/SH000001/calculate?operator=理赔专员"

# 5. 提交审核
curl -X POST "http://localhost:3000/api/shipments/SH000001/review/submit?operator=理赔专员"

# 6. 审核通过
curl -X POST "http://localhost:3000/api/shipments/SH000001/review?operator=审核主管" \
  -H "Content-Type: application/json" \
  -d '{"decision": "approved", "reason": "符合赔付规则"}'

# 7. 结案
curl -X POST "http://localhost:3000/api/shipments/SH000001/complete"
```

### 路径 2：破损赔付流程（需上传证据）

```
运单导入 → 异常登记 → 上传证据（≥2张）→ 责任判定 → 赔付计算 → ...
```

```bash
# 上传证据（需要至少 2 张照片/视频）
curl -X POST "http://localhost:3000/api/shipments/SH000002/evidence?operator=客服" \
  -H "Content-Type: application/json" \
  -d '{"type": "photo", "url": "photo1.jpg", "description": "外包装破损正面"}'

curl -X POST "http://localhost:3000/api/shipments/SH000002/evidence?operator=客服" \
  -H "Content-Type: application/json" \
  -d '{"type": "photo", "url": "photo2.jpg", "description": "外包装破损侧面"}'
```

### 路径 3：丢件赔付（需先确认责任）

```
运单导入 → 异常登记 → 责任判定（必须confirmed）→ 赔付计算 → ...
```

**注意**：如果未确认责任直接计算赔付，会返回失败：
```json
{
  "amount": 0,
  "status": "rejected",
  "reason": "承运商责任待确认"
}
```

### 路径 4：申诉改判流程

```
审核通过/驳回 → 客户申诉 → 申诉处理 → 改判 → 结案
```

```bash
# 客户申诉
curl -X POST "http://localhost:3000/api/shipments/SH000006/appeal?operator=客户" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "认为赔付金额过低",
    "requestedAmount": 3000
  }'

# 处理申诉（改判）
curl -X POST "http://localhost:3000/api/shipments/SH000006/appeal/process?operator=申诉专员" \
  -H "Content-Type: application/json" \
  -d '{
    "decision": "approved",
    "reason": "客户提供新凭证，调整赔付金额",
    "newCompensation": {"amount": 2500}
  }'
```

---

## ❌ 失败路径演示

### 失败场景 1：证据不足

**触发条件**：破损类型只上传 1 张照片

```bash
# 只上传 1 张照片
curl -X POST "http://localhost:3000/api/shipments/SH000004/evidence" \
  -d '{"type": "photo", "url": "only_one.jpg"}'

# 计算赔付（失败）
curl -X POST "http://localhost:3000/api/shipments/SH000004/calculate"
```

**预期结果**：
```json
{
  "amount": 0,
  "status": "rejected",
  "reason": "证据不足，需要至少 2 张破损照片"
}
```

### 失败场景 2：不可抗力

**触发条件**：轨迹中包含台风、暴雨、疫情等关键词

运单轨迹示例：
```json
{
  "trackingEvents": [
    {"location": "重庆", "status": "已到达（因暴雨延误）"}
  ]
}
```

**预期结果**：
```json
{
  "amount": 0,
  "status": "rejected",
  "forceMajeure": true,
  "reason": "不可抗力因素：暴雨",
  "calculation": "因不可抗力 暴雨 造成的延误，不予赔付"
}
```

### 失败场景 3：重复申诉

**触发条件**：已有待处理申诉时再次提交

**预期结果**：
```json
{
  "success": false,
  "error": "已有待处理或已通过的申诉"
}
```

### 失败场景 4：责任待确认

**触发条件**：丢件类型未确认承运商责任

**预期结果**：
```json
{
  "amount": 0,
  "status": "rejected",
  "reason": "承运商责任待确认"
}
```

---

## 📊 赔付规则详解

### 客户等级与赔付上限

| 客户等级 | 延误（元/天） | 延误上限 | 破损比例 | 破损上限 | 丢件比例 | 丢件上限 |
|---------|-------------|---------|---------|---------|---------|---------|
| normal  | 20          | ¥500    | 30%     | ¥1,000  | 100%    | ¥2,000  |
| vip     | 30          | ¥1,000  | 50%     | ¥2,000  | 100%    | ¥5,000  |
| vip_plus| 50          | ¥2,000  | 70%     | ¥3,000  | 100%    | ¥10,000 |

### 特殊规则

1. **延误计算**：`赔付金额 = min(延误天数 × 每日赔付, 上限)`
2. **破损计算**：`赔付金额 = min(保价金额 × 破损比例, 上限)`，至少 ¥100-300
3. **丢件计算**：`赔付金额 = min(保价金额 × 100%, 上限)`
4. **证据要求**：破损需要至少 2 张照片/视频
5. **责任前置**：丢件必须先确认承运商责任
6. **不可抗力**：台风、暴雨、疫情、交通管制等延误不予赔付
7. **申诉限制**：7 天内最多申诉 2 次，不能有待处理申诉

---

## 🔄 状态流转图

```
created
    ↓
awaiting_evidence ─┬─→ evidence_rejected ─┬─→ closed
                   │                      │
                   └─→ pending_liability ─┼─→ liability_pending_carrier
                                          │       ↓
                                          ├─→ liability_confirmed
                                          │       ↓
                                          ├─→ liability_rejected
                                          │
liability_confirmed
    ↓
compensation_calculated
    ↓
pending_review ─┬─→ review_approved ─┬─→ completed
               │                     │
               └─→ review_rejected ─┼─→ closed
                                     │
review_approved ─┬─→ appealed ─┬─→ appeal_approved ─→ completed
                │              │
                │              └─→ appeal_rejected ─┬─→ review_approved
                │                                   │
                └─→ completed                       └─→ closed
```

---

## 🔌 API 完整列表

### 运单管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/waybills/import` | 批量导入运单 |
| GET | `/api/waybills` | 获取所有运单 |
| GET | `/api/waybills/:waybillId` | 获取单个运单 |

### 异常件管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/shipments` | 创建异常件 |
| GET | `/api/shipments` | 获取列表（支持筛选） |
| GET | `/api/shipments/statistics` | 获取统计数据 |
| GET | `/api/shipments/:shipmentId` | 获取详情 |
| GET | `/api/shipments/:shipmentId/history` | 操作历史 |

### 流程推进

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/shipments/:shipmentId/evidence` | 上传证据 |
| POST | `/api/shipments/:shipmentId/liability` | 责任判定 |
| POST | `/api/shipments/:shipmentId/calculate` | 赔付计算 |
| POST | `/api/shipments/:shipmentId/review/submit` | 提交审核 |
| POST | `/api/shipments/:shipmentId/review` | 审核处理 |
| POST | `/api/shipments/:shipmentId/appeal` | 提交申诉 |
| POST | `/api/shipments/:shipmentId/appeal/process` | 处理申诉 |
| POST | `/api/shipments/:shipmentId/complete` | 结案 |

### 特殊功能

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/shipments/:shipmentId/edit` | 人工修正（记录差异） |
| POST | `/api/shipments/:shipmentId/callback` | 承运商回调（幂等） |

### 报告导出

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/reports/summary` | 汇总报告 |
| GET | `/api/reports/rules` | 规则配置 |
| GET | `/api/reports/export` | 导出数据（?format=json/csv） |

---

## 🔍 查询与筛选

### 筛选异常件

```bash
# 按状态筛选
curl "http://localhost:3000/api/shipments?status=completed"

# 按类型筛选
curl "http://localhost:3000/api/shipments?type=damage"

# 按客户等级筛选
curl "http://localhost:3000/api/shipments?customerLevel=vip"

# 组合筛选
curl "http://localhost:3000/api/shipments?status=pending_review&type=damage"
```

### 查看操作历史

```bash
curl "http://localhost:3000/api/shipments/SH000001/history"
```

返回示例：
```json
[
  {
    "time": "2026-05-12T07:19:22.070Z",
    "operator": "审核主管老张",
    "action": "review_approved",
    "summary": "审核通过",
    "details": {
      "reason": "符合延误赔付规则"
    }
  }
]
```

### 查看完整详情

```bash
curl "http://localhost:3000/api/shipments/SH000001"
```

返回包含：
- 基本信息（运单、异常类型、客户等级）
- 轨迹摘要
- 证据列表
- 责任判定
- 赔付计算结果
- 审核/申诉记录
- 完整操作历史
- 下一步可执行状态

---

## 📈 报表输出

### JSON 格式

```bash
curl "http://localhost:3000/api/reports/export"
```

### CSV 格式

```bash
curl "http://localhost:3000/api/reports/export?format=csv" -o report.csv
```

### 汇总报告

```bash
curl "http://localhost:3000/api/reports/summary"
```

返回示例：
```json
{
  "generatedAt": "2026-05-12T07:19:22.070Z",
  "statistics": {
    "totalShipments": 7,
    "statusCounts": {
      "completed": 3,
      "pending_review": 1,
      "closed": 2,
      "created": 1
    },
    "typeCounts": {
      "delay": 3,
      "damage": 3,
      "lost": 1
    },
    "compensationAmounts": {
      "approved": 10980,
      "pending": 11880,
      "rejected": 0,
      "total": 22860
    }
  },
  "byCustomerLevel": {
    "normal": { "count": 3, "statuses": {...} },
    "vip": { "count": 3, "statuses": {...} },
    "vip_plus": { "count": 1, "statuses": {...} }
  }
}
```

---

## 🔒 幂等性保证

### 承运商回调幂等

```bash
# 第一次调用
curl -X POST "http://localhost:3000/api/shipments/SH000002/callback" \
  -H "Content-Type: application/json" \
  -d '{
    "idempotencyKey": "callback_001",
    "type": "liability_confirmation",
    "status": "confirmed"
  }'

# 第二次调用（相同 idempotencyKey）
# 返回相同结果，不会重复处理
curl -X POST "http://localhost:3000/api/shipments/SH000002/callback" \
  -d '{"idempotencyKey": "callback_001", ...}'
```

返回（幂等调用）：
```json
{
  "success": true,
  "idempotent": true,
  "result": { ... 首次调用结果 ... }
}
```

---

## 📝 人工修正追踪

所有人工修改都会记录：
- 操作者
- 修改原因
- 修改前的值
- 修改后的值
- 差异对比

```bash
curl -X POST "http://localhost:3000/api/shipments/SH000007/edit?operator=客服主管老王" \
  -H "Content-Type: application/json" \
  -d '{
    "changes": {
      "description": "修正后的描述",
      "statusReason": "客服人工介入"
    },
    "reason": "客户反馈描述不准确"
  }'
```

---

## 🎯 内置样例数据

运行 `npm test` 后会生成以下样例：

| 异常件ID | 类型 | 客户 | 状态 | 赔付金额 | 说明 |
|---------|------|------|------|---------|------|
| SH000001 | 延误 | 张三（普通） | completed | ¥80 | 完整流程演示 |
| SH000002 | 破损 | 李四（VIP） | pending_review | ¥900 | 待审核 + 幂等回调 |
| SH000003 | 丢件 | 王五（VIP+） | completed | ¥10,000 | 责任前置检查 |
| SH000004 | 破损 | 赵六（普通） | closed | ¥0 | 证据不足失败 |
| SH000005 | 延误 | 孙七（VIP） | closed | ¥0 | 不可抗力失败 |
| SH000006 | 破损 | 李四（VIP） | completed | ¥900 | 申诉改判 |
| SH000007 | 延误 | 张三（普通） | created | - | 人工修正演示 |

---

## 🛠️ 项目结构

```
src/
├── server.js              # 主服务器（原生 Node.js，零依赖）
├── data/
│   └── store.js           # 内存数据存储
├── services/
│   ├── shipmentService.js # 核心业务逻辑
│   ├── rules.js           # 赔付规则引擎
│   └── history.js         # 历史记录与差异追踪
├── routes/                # 路由模块（可扩展）
│   ├── waybills.js
│   ├── shipments.js
│   └── reports.js
├── examples/
│   ├── sampleData.js      # 样例数据
│   └── run-demo.js        # 演示脚本
└── utils/
    └── date.js            # 日期工具
```

---

## ⚠️ 注意事项

1. **内存存储**：当前使用内存存储，重启服务数据会清空（演示用）
2. **零依赖**：系统使用 Node.js 原生模块，无需 `npm install`
3. **Node 版本**：需要 Node.js 16.0+
4. **端口**：默认 3000，可在 `src/server.js` 中修改

---

## 📖 验证业务闭环

不看源码，通过以下步骤验证业务：

1. **运行演示**：`npm test`
2. **查看统计**：启动服务后访问 `/api/shipments/statistics`
3. **查看详情**：访问 `/api/shipments/SH000001` 检查：
   - 轨迹摘要是否正确
   - 赔付计算是否符合规则
   - 责任方是否明确
   - 状态流转是否完整
4. **导出报表**：访问 `/api/reports/export?format=csv`
5. **验证失败**：查看 SH000004（证据不足）和 SH000005（不可抗力）状态为 `closed`

通过以上步骤，无需查看源码即可验证：
- ✅ 轨迹摘要正确展示
- ✅ 赔付金额按规则计算
- ✅ 责任方明确判定
- ✅ 异常报表统计准确
- ✅ 成功/失败路径都有明确结果
