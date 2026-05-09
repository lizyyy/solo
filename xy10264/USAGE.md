# 民宿噪音投诉证据 API - 使用说明

## 一、快速开始

### 1. 安装依赖

```bash
cd /Users/mac/pro/solo/workspaces/xy10264
npm install
```

### 2. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3005` 启动（使用内存数据库，进程重启后数据清空）。

### 3. 运行样例脚本

**新终端窗口执行（服务已启动时）：**

```bash
# 顺利流程样例（完整证据 → 自动赔付）
node examples/success-flow.js

# 拦截/待复核样例（证据不足 → 人工复核）
node examples/intercept-flow.js

# 或者使用 npm 脚本
npm run seed:success
npm run seed:intercept
```

---

## 二、核心流程

### 状态流转图

```
pending → investigating → verifying → approved → completed
              ↓              ↓
          withdrawn     pending_review
                             ↓
                          approved
                    (人工复核后)
```

### 状态说明

| 状态 | 说明 | 可流转到 |
|------|------|----------|
| pending | 待处理 | investigating, withdrawn |
| investigating | 调查中 | verifying, withdrawn, rejected |
| verifying | 验证中 | approved, pending_review, rejected, withdrawn |
| pending_review | 待复核 | approved, rejected, verifying |
| approved | 已批准 | completed |
| completed | 已完成 | - |
| rejected | 已拒绝 | - |
| withdrawn | 已撤回 | - |

---

## 三、完整操作指南

### 步骤 1：创建订单

**请求示例：**
```bash
curl -X POST http://localhost:3005/api/orders \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: order-key-001" \
  -d '{
    "property_id": "PROP-SH-001",
    "property_name": "上海静安区精品民宿",
    "guest_name": "张三",
    "guest_phone": "13800138001",
    "check_in_date": "2026-05-10",
    "check_out_date": "2026-05-12",
    "total_amount": 1580.00,
    "room_no": "302"
  }'
```

**关键点：**
- 使用 `x-idempotency-key` 防止重复创建订单
- `total_amount` 用于后续赔付计算

---

### 步骤 2：创建投诉单

**请求示例：**
```bash
curl -X POST http://localhost:3005/api/complaints \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "<订单ID>",
    "property_id": "PROP-SH-001",
    "reporter_type": "neighbor",
    "reporter_name": "王阿姨",
    "reporter_phone": "13900139002",
    "complaint_time": "2026-05-10T23:45:00.000Z",
    "description": "302房间深夜23点还在开派对，噪音很大",
    "priority": "high",
    "assigned_to": "客服-小李"
  }'
```

**reporter_type 取值：**
- `guest`：住客本人投诉
- `neighbor`：邻居投诉
- `staff`：工作人员上报

---

### 步骤 3：上传分贝记录

**关键差异点：必须有**连续**的超标记录才能触发赔付规则**

**请求示例（连续多条）：**
```bash
# 第1条：23:30 - 68dB
curl -X POST http://localhost:3005/api/decibel-records \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "<订单ID>",
    "property_id": "PROP-SH-001",
    "record_time": "2026-05-10T23:30:00.000Z",
    "db_value": 68,
    "duration_seconds": 60,
    "location": "302房间门口",
    "source": "智能噪音监测设备"
  }'

# 第2条：23:31 - 72dB
curl -X POST http://localhost:3005/api/decibel-records \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "<订单ID>",
    "property_id": "PROP-SH-001",
    "record_time": "2026-05-10T23:31:00.000Z",
    "db_value": 72,
    "duration_seconds": 60,
    "location": "302房间门口",
    "source": "智能噪音监测设备"
  }'

# ... 继续上传更多连续记录
```

**为什么需要连续？**
- 单次超标 ≠ 违规证据
- 系统会检查「连续多少秒/分钟」超过阈值
- 默认规则：夜间需要持续 3-5 分钟超标

---

### 步骤 4：上传证据片段

**请求示例（音频片段）：**
```bash
curl -X POST http://localhost:3005/api/evidence-segments \
  -H "Content-Type: application/json" \
  -d '{
    "complaint_id": "<投诉单ID>",
    "segment_type": "audio",
    "segment_time": "2026-05-10T23:32:00.000Z",
    "duration_seconds": 120,
    "db_avg": 72,
    "db_max": 78,
    "db_min": 66,
    "description": "两分钟音频片段，包含派对音乐和人声喧哗",
    "file_url": "/evidence/audio/cmp_001_segment1.mp3",
    "is_verified": true,
    "verified_by": "质检-小王",
    "verified_at": "2026-05-11T00:15:00.000Z"
  }'
```

**segment_type 取值：**
| 类型 | 说明 | 对证据质量的影响 |
|------|------|-----------------|
| audio | 音频录音 | +20分 |
| video | 视频录像 | +20分 |
| decibel | 分贝数据 | +25分 |
| photo | 照片 | +10分 |
| text | 文字描述 | +5分 |
| neighbor_feedback | 邻居反馈 | +15分 |
| staff_note | 工作人员备注 | +10分 |

**证据质量评分规则：**
- excellent (≥80分)：无需复核，可直接批准
- good (60-79分)：一般无需复核
- fair (40-59分)：建议人工复核
- poor (<40分)：必须人工复核

---

### 步骤 5：推进投诉状态

**查询详情（会自动分析证据）：**
```bash
curl http://localhost:3005/api/complaints/<投诉单ID>
```

响应中包含关键分析：
```json
{
  "analysis": {
    "decibel_analysis": {
      "hasEvidence": true,
      "maxDb": 78,
      "avgDb": 71.4,
      "continuousViolations": [...],
      "triggeredRules": [...]
    },
    "evidence_quality": {
      "score": 85,
      "level": "excellent",
      "issues": []
    },
    "compensation_calculation": {
      "eligible": true,
      "amount": 790,
      "reason": "按订单金额的50%赔付",
      "appliedRule": {...}
    },
    "review_required": {
      "required": false,
      "reasons": []
    }
  }
}
```

**推进状态：**
```bash
# 从 pending → investigating
curl -X POST http://localhost:3005/api/complaints/<投诉单ID>/advance \
  -H "Content-Type: application/json" \
  -d '{
    "to_status": "investigating",
    "operator": "客服-小李",
    "remark": "已联系住客核实情况"
  }'

# 从 investigating → verifying
# ⚠️ 注意：如果没有有效证据会被拦截
curl -X POST http://localhost:3005/api/complaints/<投诉单ID>/advance \
  -H "Content-Type: application/json" \
  -d '{
    "to_status": "verifying",
    "operator": "质检-小王",
    "remark": "证据完整"
  }'

# 从 verifying → approved
# ⚠️ 注意：如果需要复核会被拦截，先推进到 pending_review
curl -X POST http://localhost:3005/api/complaints/<投诉单ID>/advance \
  -H "Content-Type: application/json" \
  -d '{
    "to_status": "approved",
    "operator": "主管-张经理",
    "remark": "证据确凿"
  }'

# 从 approved → completed
curl -X POST http://localhost:3005/api/complaints/<投诉单ID>/advance \
  -H "Content-Type: application/json" \
  -d '{
    "to_status": "completed",
    "operator": "财务-小刘",
    "remark": "赔付已到账"
  }'
```

---

### 步骤 6：人工复核流程（当需要时）

**场景：证据质量 fair 或有争议**

```bash
# 1. 先推进到 pending_review
curl -X POST http://localhost:3005/api/complaints/<投诉单ID>/advance \
  -H "Content-Type: application/json" \
  -d '{
    "to_status": "pending_review",
    "operator": "质检-小周",
    "remark": "证据存在争议，提交主管复核"
  }'

# 2. 主管复核后批准（从 pending_review 可直接 approved）
curl -X POST http://localhost:3005/api/complaints/<投诉单ID>/advance \
  -H "Content-Type: application/json" \
  -d '{
    "to_status": "approved",
    "operator": "主管-王经理",
    "remark": "人工复核通过，考虑客户体验给予赔付"
  }'
```

---

### 步骤 7：撤回投诉

```bash
curl -X POST http://localhost:3005/api/complaints/<投诉单ID>/withdraw \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "客服-小陈",
    "remark": "问题已解决，客户撤回投诉"
  }'
```

⚠️ **限制：** 已完成/已拒绝/已撤回的投诉无法撤回

---

### 步骤 8：修正投诉信息

```bash
curl -X POST http://localhost:3005/api/complaints/<投诉单ID>/amend \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "客服-小陈",
    "changes": {
      "description": "修正后的投诉描述",
      "priority": "high",
      "assigned_to": "客服-小李"
    },
    "remark": "客户补充了更详细的信息"
  }'
```

**可修正字段：** `description`, `priority`, `assigned_to`, `reporter_phone`

---

### 步骤 9：查询处理历史

```bash
curl http://localhost:3005/api/process-history/<投诉单ID>
```

---

### 步骤 10：查询汇总和导出

**投诉列表查询：**
```bash
# 全部
curl http://localhost:3005/api/complaints

# 按物业筛选
curl "http://localhost:3005/api/complaints?property_id=PROP-SH-001"

# 按状态筛选
curl "http://localhost:3005/api/complaints?status=pending"

# 组合筛选
curl "http://localhost:3005/api/complaints?property_id=PROP-SH-001&status=pending&priority=high"
```

**导出数据：**
```bash
# 导出 CSV
curl -o complaints.csv "http://localhost:3005/api/export/complaints?property_id=PROP-SH-001"

# 导出 JSON
curl -o complaints.json "http://localhost:3005/api/export/complaints?property_id=PROP-SH-001&format=json"
```

---

## 四、默认赔付规则

服务启动时会自动初始化 4 条默认规则：

| ID | 规则名称 | 条件 | 赔付 | 优先级 |
|----|----------|------|------|--------|
| rule-night-2 | 夜间高峰噪音≥75dB持续3分钟 | 22:00-06:00, ≥75dB, ≥3分钟 | 订单金额 50% | 20 |
| rule-neighbor-1 | 邻居投诉+验证证据+持续≥5分钟 | ≥60dB, ≥5分钟 | 固定 ¥200 | 15 |
| rule-night-1 | 夜间高峰噪音≥65dB持续5分钟 | 22:00-06:00, ≥65dB, ≥5分钟 | 订单金额 30% | 10 |
| rule-day-1 | 日间噪音≥70dB持续10分钟 | 06:00-22:00, ≥70dB, ≥10分钟 | 订单金额 20% | 5 |

**优先级越高，越先匹配**

**查看/管理规则：**
```bash
# 查询当前规则
curl http://localhost:3005/api/rules

# 创建/更新规则
curl -X POST http://localhost:3005/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "id": "rule-custom-1",
    "rule_name": "自定义规则",
    "db_threshold": 80,
    "time_slot_start": "23:00",
    "time_slot_end": "05:00",
    "duration_threshold_seconds": 180,
    "compensation_type": "percent",
    "compensation_value": 40,
    "priority": 25
  }'
```

---

## 五、关键差异点详解

### 差异点 1：噪音证据片段 vs 单次记录

| 维度 | 有效证据（连续） | 无效证据（单次） |
|------|-----------------|-----------------|
| 分贝记录 | 多条连续（时间间隔<10分钟） | 单条或分散 |
| 持续时长 | 达到规则阈值（3-10分钟） | 时间不够 |
| 时段匹配 | 在规则的时间窗口内 | 不在规则窗口 |
| 触发规则 | ✅ 有匹配的 rule | ❌ 无匹配 |
| 赔付判断 | eligible: true | eligible: false |

### 差异点 2：证据质量评分机制

```
总分 = 验证率(40) + 类型加分(音频20/分贝25/邻居15)

验证率加分：
- 100% 已验证 → +40
- 50%-99% 已验证 → +25
- 1%-49% 已验证 → +10
- 0% 已验证 → +0

类型加分：
- 有音频/视频 → +20
- 有分贝数据 → +25
- 有邻居反馈 → +15
```

### 差异点 3：赔付计算逻辑

```
赔付金额 = 
  如果是 percent 类型：订单金额 × (compensation_value / 100)
  如果是 fixed 类型：compensation_value（固定金额）
```

**示例：**
- 订单金额 ¥1,580，规则 50% → ¥790
- 订单金额 ¥680，规则 30% → ¥204
- 规则固定 ¥200 → ¥200

### 差异点 4：复核触发条件

满足以下**任一**条件需人工复核：
1. 证据质量为 poor
2. 证据片段未经过验证
3. 缺少分贝数据证据
4. 证据片段数量不足（<3条且无音频）
5. 无有效噪音数据证据
6. 邻居投诉但缺少噪音验证数据
7. 多段违规噪音（>3段）
8. 噪音峰值过高（≥90dB）

---

## 六、幂等性使用

**防止重复请求写乱状态：**

```bash
# 第一次请求，创建新资源
curl -X POST http://localhost:3005/api/orders \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: my-unique-key-123" \
  -d '{...}'

# 第二次请求（网络重试），使用相同 key
# 返回已有资源，不创建新的
curl -X POST http://localhost:3005/api/orders \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: my-unique-key-123" \
  -d '{...}'

# 响应中会有 idempotent: true 标识
```

**支持幂等的接口：**
- `POST /api/orders`
- `POST /api/decibel-records`
- `POST /api/complaints`
- `POST /api/evidence-segments`

**Key 生成建议：** `{业务类型}-{业务ID}-{时间戳}`

---

## 七、完整 API 列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |
| POST | /api/orders | 创建订单 |
| GET | /api/orders/:id | 查询订单详情 |
| GET | /api/orders | 查询订单列表 |
| POST | /api/decibel-records | 上传分贝记录 |
| GET | /api/decibel-records/:id | 查询分贝记录 |
| POST | /api/complaints | 创建投诉单 |
| GET | /api/complaints/:id | 查询投诉详情（含分析） |
| GET | /api/complaints | 查询投诉列表/汇总 |
| POST | /api/complaints/:id/advance | 推进投诉状态 |
| POST | /api/complaints/:id/withdraw | 撤回投诉 |
| POST | /api/complaints/:id/amend | 修正投诉信息 |
| POST | /api/evidence-segments | 上传证据片段 |
| GET | /api/evidence-segments/:id | 查询证据片段 |
| POST | /api/evidence-segments/:id/verify | 验证证据片段 |
| GET | /api/rules | 查询赔付规则 |
| POST | /api/rules | 创建/更新赔付规则 |
| GET | /api/process-history/:complaintId | 查询处理历史 |
| GET | /api/export/complaints | 导出投诉数据 |

---

## 八、故障排查

### 问题 1：推进状态被拦截

**原因：** 缺少证据或需要复核

**解决：**
```bash
# 1. 先查询详情，看分析结果
curl http://localhost:3005/api/complaints/<ID>

# 2. 检查 review_required.reasons
# 3. 补充证据或走 pending_review 流程
```

### 问题 2：分贝记录未触发规则

**原因检查：**
1. 单条记录？→ 需要连续多条
2. 时间间隔 >10 分钟？→ 会被判定为不连续
3. 不在规则时间窗口？→ 检查 time_slot_start/end
4. 持续时长不够？→ 检查 duration_threshold_seconds

### 问题 3：赔付金额为 0

**原因检查：**
1. `eligible: false` → 查看 reason
2. 无匹配规则 → 检查分贝分析
3. 规则 is_active = 0 → 检查规则状态

---

## 九、项目结构

```
.
├── index.js              # 服务入口
├── package.json
├── USAGE.md              # 本文档
├── data/
│   └── complaints.db     # SQLite 数据库（自动生成）
├── src/
│   ├── database.js       # 数据库初始化和表结构
│   ├── routes.js         # API 路由定义
│   ├── middleware.js     # 中间件（幂等性、参数校验）
│   ├── utils.js          # 工具函数
│   └── decibel-service.js # 核心业务逻辑（分贝分析、赔付计算、复核判断）
└── examples/
    ├── success-flow.js   # 顺利流程样例
    └── intercept-flow.js # 拦截/待复核样例
```
