# 民宿保洁排班验收回放链路 - 实操手册

## 🔧 快速开始：5步跑通完整流程

### 前置准备
```bash
# 1. 安装依赖
npm install

# 2. 创建必要目录
mkdir -p data exports
```

---

## 🚀 标准流程（按顺序执行）

### 步骤1: 启动服务（终端A）
```bash
npm run dev
```
**预期输出:**
```
[DB] Connected to SQLite database
[DB] All tables created/verified
[Server] Running on http://localhost:3000
```

### 步骤2: 造数并发送请求（终端B）
```bash
npm run test-request
```

**🎯 关键观察点:**
- 订单接入: 6条，其中2条会触发脏记录检测
- 保洁接入: 7条，其中2条有异常
- 维修接入: 4条，其中1条缺上报人
- 审批接入: 4条，其中1条金额异常
- **幂等性验证:** 最后重复提交同一条订单，isNew=false说明幂等生效

**📊 造数包含的异常场景:**
| 类型 | 示例 | 预期行为 |
|------|------|----------|
| 缺字段 | ORD-2024-004(缺客人姓名) | 标记为missing_fields |
| 数量冲突 | ORD-2024-005(声明5晚实际2晚) | 标记为quantity_conflict |
| 保洁类型冲突 | CLN-2024-004(连住客人安排换布草) | 对账时标记不匹配 |
| 金额异常 | APV-2024-004(-50元退款) | 标记为amount_conflict |
| 跨日/找不到 | STMT-2024-001 房间999 | 标记为cross_day |

### 步骤3: 对账
```bash
npm run reconcile
```

**📈 对账报告示例:**
```
=== 对账报告: 2024-01-10 至 2024-01-14
事实记录总数: 8
  - 已匹配: 4 (50.0%)
  - 不匹配: 3
  - 待处理: 1
验证总金额: ¥340.00
账单总金额: ¥400.00
差额: ¥-60.00
```

**❌ 不匹配原因分类:**
1. **保洁类型不匹配** - 退房日应安排退房保洁
2. **保洁任务未完成** - status不是completed
3. **连住换布草冲突** - 客人未要求但安排了换布草

### 步骤4: 回放异常修复
```bash
npm run replay
```

**🔧 修复策略:**
| 脏数据类型 | 自动修复方案 | 需要人工介入 |
|-----------|-------------|-------------|
| missing_fields(guestName) | 填充"未知客人(补录)" | 否 |
| missing_fields(cleanerName) | 填充"待分配" | 是 |
| quantity_conflict(nights) | 记录修正建议 | 是 |
| amount_conflict(负数) | 取绝对值 | 否 |
| cross_day | 标记待核实 | 是 |
| name_change | 记录变更历史 | 否 |

### 步骤5: 导出报表
```bash
npm run export
```

**📁 输出文件位置:**
```
exports/
├── facts_2024-01-10_2024-01-14.json    # 事实记录(原始数据)
├── facts_2024-01-10_2024-01-14.csv     # 事实记录(表格)
├── dirty_records_all_*.json            # 所有脏记录
├── dirty_records_all_*.csv             # 所有脏记录(表格)
├── reconciliation_*.json               # 对账报告
└── reconciliation_*.csv                # 对账摘要
```

---

## 🎯 店长重点关注

### 1. 命令脚本总览
```bash
# 核心命令
npm run dev          # 启动服务
npm run test-request # 造数+接入
npm run reconcile    # 执行对账
npm run replay       # 修复异常
npm run export       # 导出报表
```

### 2. HTTP读写日志
查看服务终端的请求日志:
```
[HTTP] POST /api/ingest/order      # 订单接入
[HTTP] POST /api/ingest/cleaning   # 保洁接入
[HTTP] POST /api/ingest/maintenance # 维修接入
[HTTP] POST /api/ingest/approval   # 审批接入
[HTTP] POST /api/ingest/statement  # 对账单接入
[HTTP] POST /api/reconcile         # 执行对账
```

**幂等性关键:** 同一sourceType+sourceId重复POST时，自动执行UPDATE而非INSERT

### 3. 本地持久化结构
```
data/cleaning-audit.db (SQLite)
├── source_records      # 原始接入记录(全部留痕)
│   ├── order_calendar
│   ├── cleaning_group
│   ├── maintenance_note
│   └── approval_email
├── fact_records        # 聚合后的事实记录(单一真相)
│   └── UNIQUE(room_id, date)  # 房间+日期唯一约束
├── dirty_records       # 脏记录明细表
├── audit_logs          # 完整变更审计
└── supplier_statements # 供应商对账单
```

---

## ❌ 失败路径 & 修正方式

### 场景A: 连住客人换布草冲突
**现象:**
```
脏记录: [quantity_conflict] 连住客人未要求换布草, 但安排了换布草保洁
对账状态: mismatch
```

**根因分析:**
- 订单: isContinuousStay=true, linenChangeRequired=false
- 保洁: cleaningType=linen_change

**修正方式:**
```bash
# 1. 查看事实详情
curl "http://localhost:3000/api/facts/fact_103_20240111"

# 2. 方案一: 修正保洁类型(更新保洁消息)
curl -X POST http://localhost:3000/api/ingest/cleaning \
  -H "Content-Type: application/json" \
  -d '{
    "messageId": "CLN-2024-004",
    "roomId": "103",
    "cleanerName": "王阿姨",
    "scheduledDate": "2024-01-11",
    "cleaningType": "daily",
    "status": "completed"
  }'

# 3. 重新对账
npm run reconcile
```

**报表变化:**
- 不匹配记录数: -1
- 已匹配记录数: +1
- 验证金额: 从¥30(换布草)变为¥50(日常保洁)

---

### 场景B: 入住晚数数量冲突
**现象:**
```
脏记录: [quantity_conflict] 订单ORD-2024-005入住天数冲突: 声明5晚, 实际计算2晚
```

**根因分析:**
- checkIn: 2024-01-12, checkOut: 2024-01-14 → 实际2晚
- 订单声明nights=5

**修正方式:**
```bash
# 修正订单后重新接入(幂等自动更新)
curl -X POST http://localhost:3000/api/ingest/order \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORD-2024-005",
    "roomId": "101",
    "guestName": "钱七",
    "checkInDate": "2024-01-12",
    "checkOutDate": "2024-01-14",
    "nights": 2,
    "isContinuousStay": true,
    "linenChangeRequired": true
  }'
```

**报表变化:**
- 脏记录: 1条resolved
- 事实记录nights字段: 5→2

---

### 场景C: 供应商账单金额不符
**现象:**
```
对账差额: ¥-60.00
不匹配明细: ITEM-004 小计计算错误: 1*30=30, 当前为60
```

**修正方式:**
```bash
# 1. 标记脏记录已解决
curl -X POST http://localhost:3000/api/dirty-records/<dirty_id>/resolve \
  -H "Content-Type: application/json" \
  -d '{"resolution": "供应商多收30元, 已协商在下期抵扣"}'

# 2. 更新对账单(可选)
curl -X POST http://localhost:3000/api/ingest/statement \
  -H "Content-Type: application/json" \
  -d '{...修正后的对账单...}'
```

---

## 📊 样例材料

### 订单日历样例
```json
{
  "orderId": "ORD-2024-001",
  "roomId": "101",
  "guestName": "张三",
  "checkInDate": "2024-01-10",
  "checkOutDate": "2024-01-11",
  "nights": 1,
  "isContinuousStay": false,
  "linenChangeRequired": true
}
```

### 保洁群消息样例
```json
{
  "messageId": "CLN-2024-001",
  "roomId": "101",
  "cleanerName": "张阿姨",
  "scheduledDate": "2024-01-10",
  "cleaningType": "checkout",
  "status": "completed",
  "qualityScore": 95
}
```

### 维修备注样例
```json
{
  "noteId": "MNT-2024-001",
  "roomId": "101",
  "reportedBy": "张阿姨",
  "reportedAt": "2024-01-10T15:30:00Z",
  "issueType": "plumbing",
  "description": "淋浴头漏水",
  "priority": "medium",
  "status": "reported"
}
```

---

## 🔍 常用调试命令

```bash
# 查看所有事实记录
curl "http://localhost:3000/api/facts?startDate=2024-01-10&endDate=2024-01-14"

# 查看单条事实+审计日志
curl "http://localhost:3000/api/facts/fact_101_20240110"

# 查看未解决脏记录
curl "http://localhost:3000/api/dirty-records?resolved=false"

# 查看供应商对账单
curl "http://localhost:3000/api/statements"

# 重新执行对账
curl -X POST http://localhost:3000/api/reconcile \
  -H "Content-Type: application/json" \
  -d '{"startDate":"2024-01-10","endDate":"2024-01-14"}'
```

---

## ✅ 数据一致性保证

### 幂等性机制
- **Key:** sourceType + sourceId 联合唯一约束
- **行为:** 重复请求自动UPDATE，不产生新记录
- **验证:** test-request 步骤10可观察到 isNew=false

### 单一真相来源
- 所有接口读取同一套 fact_records 表
- 导出、详情、历史查询 数据完全一致
- 任何修改自动写入 audit_logs 留痕

### 脏记录保留
- 原始数据完整保留在 source_records.raw_data
- 处理意见写入 processing_notes
- 修正后可重新触发汇总
