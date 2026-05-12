# 客服机器人转人工 API

处理机器人会话转人工时的意图、情绪、排队优先级和处理结果的完整后端服务。

---

## 🚀 快速开始

### 1. 环境要求
- Node.js >= 16.0.0
- npm 或 yarn

### 2. 安装依赖
```bash
cd /Users/mac/pro/solo/workspaces/xy10545
npm install
```

### 3. 本地启动
```bash
npm start
```
服务将运行在 `http://localhost:3001`

### 4. 一键造数（示例数据）
```bash
npm run seed
```
创建3个客服账号和4个示例会话，覆盖各种业务场景。

### 5. 运行完整演示
```bash
npm run demo
```
这是最重要的命令！它将执行5个完整场景并展示报告。

---

## 📋 API 接口概览

| 模块 | 基础路径 | 说明 |
|------|---------|------|
| 会话管理 | `/api/conversations` | 创建、查询、消息、意图、情绪 |
| 转人工 | `/api/escalations` | 转人工申请、排队、客服管理 |
| 结果处理 | `/api/processing` | 提交结果、人工修正 |
| 报告导出 | `/api/reports` | 时间线、统计、导出 |

### 核心接口

**1. 创建会话**
```bash
POST http://localhost:3000/api/conversations
Content-Type: application/json

{
  "id": "conv_test_001",
  "user_id": "user_123",
  "channel": "web"
}
```

**2. 记录意图**
```bash
POST http://localhost:3000/api/conversations/conv_test_001/intents
{
  "intent_name": "refund_request",
  "confidence": 0.95,
  "slot_values": { "order_id": "ORD123" }
}
```

**3. 记录情绪**
```bash
POST http://localhost:3000/api/conversations/conv_test_001/emotions
{
  "emotion_type": "angry",
  "confidence": 0.90,
  "triggered_by": "负面词汇"
}
```

情绪类型优先级（从高到低）：
- `angry` (愤怒) - 优先级 10
- `frustrated` (沮丧) - 优先级 8
- `anxious` (焦虑) - 优先级 7
- `confused` (困惑) - 优先级 5
- `neutral` (中性) - 优先级 3
- `happy` (开心) - 优先级 1

**4. 申请转人工**
```bash
POST http://localhost:3000/api/escalations
{
  "conversation_id": "conv_test_001",
  "reason": "用户情绪升级",
  "idempotency_key": "esc_001"
}
```

**5. 客服上线**
```bash
POST http://localhost:3000/api/escalations/agents/online
{
  "agent_id": "agent_001"
}
```

**6. 客服接受会话**
```bash
POST http://localhost:3000/api/escalations/handlers/{handlerId}/accept
{
  "agent_id": "agent_001"
}
```

**7. 提交处理结果**
```bash
POST http://localhost:3000/api/processing/conversations/conv_test_001/results
{
  "resolution": "已为用户办理加急退款",
  "category": "refund_urgent",
  "satisfaction_score": 4,
  "follow_up_needed": 0,
  "idempotency_key": "res_001"
}
```

**8. 查看时间线**
```bash
GET http://localhost:3000/api/reports/timeline/conv_test_001
```

**9. 查看总体统计**
```bash
GET http://localhost:3000/api/reports/overview
```

**10. 导出报告（CSV）**
```bash
GET http://localhost:3000/api/reports/export?format=csv
```

---

## 🎬 主要演示路径

运行 `npm run demo` 将执行以下场景：

### 场景 1：机器人闭环（无需转人工）
```
用户: "我的优惠券怎么用？"
  ↓
意图: coupon_usage (0.96)
情绪: neutral (0.90)
  ↓
机器人回复解答
  ↓
会话关闭 → 机器人闭环 ✓
```
**结果**: 无需消耗人工资源

### 场景 2：情绪升级转人工（高优先级）
```
用户1: "我的退款什么时候到？已经5天了"
  ↓
意图: refund_status, 情绪: frustrated
  ↓
用户2: "已经第7天了！你们骗人！太差劲了！"
  ↓
意图: complaint (0.98), 情绪: angry (0.96)
  ↓
自动转人工，优先级=10（最高）
  ↓
排队位置=1，分配在线客服
  ↓
客服看到: 意图=complaint, 情绪=angry, 等待7天 ✓
```
**结果**: 高情绪用户获得优先处理

### 场景 3：重复转人工检测（幂等性）
```
第一次请求 (idempotency_key=XXX)
  ↓
创建转人工记录: ID=abc123
  ↓
第二次相同请求 (相同key)
  ↓
幂等性生效 → 返回已有记录 abc123
  ↓
检查活跃转人工 → 已有活跃请求，拒绝新请求
```
**结果**: 避免重复转人工和重复处理

### 场景 4：结果回写 + 人工修正
```
人工处理完成
  ↓
提交结果: 退货流程指导，满意度=5
  ↓
会话状态变为 completed
  ↓
主管修正: return_guidance → return_explanation
  ↓
记录差异: 旧值, 新值, 修正者(supervisor_001), 原因
  ↓
尝试向已结束会话写入消息 → 被拦截 ✓
```
**结果**: 修改有审计，结束后不可写

### 场景 5：失败路径 - 无可用客服 + 拒接重分配
```
所有客服忙碌/离线
  ↓
用户发起转人工
  ↓
无可用客服 → 进入排队
  ↓
排队原因: no_available_agents
  ↓
客服1上线 → 自动分配
  ↓
客服1拒接（不会处理）
  ↓
会话重新排队
  ↓
客服2上线（有对应技能）
  ↓
重新分配给客服2 ✓
```
**结果**: 系统自动处理异常，保证会话不丢失

---

## 🔍 如何验证业务闭环

运行演示后，通过以下方式验证（无需看源码）：

### 1. 查看时间线接口
```bash
curl http://localhost:3000/api/reports/timeline/demo_conv_emotion
```
你将看到：
- 完整的消息流
- 每个意图的检测记录
- 每个情绪的变化
- 转人工请求的触发点
- 排队、分配、处理的完整链路

### 2. 查看总体统计
```bash
curl http://localhost:3000/api/reports/overview
```
你将看到：
- 会话总数、已关闭数、进行中数
- 情绪分布（angry有多少，frustrated有多少）
- 意图分布（哪些问题最多）
- 客服在线/忙碌情况
- 平均满意度分数

### 3. 查看排队报告
```bash
curl http://localhost:3000/api/reports/queue
```
你将看到：
- 当前排队人数
- 每个排队会话的优先级
- 每个会话的主要意图和情绪
- 等待时间

### 4. 查看客服绩效
```bash
curl http://localhost:3000/api/reports/agents
```
你将看到：
- 每个客服处理了多少会话
- 完成率、拒接率
- 当前状态

---

## ⚠️ 失败路径演示

### 失败场景 1：无可用客服
**操作**: 将所有客服设为离线，然后发起转人工

**预期结果**:
- 会话进入排队
- 排队原因 = `no_available_agents`
- API 返回排队位置
- 客服上线后自动分配

### 失败场景 2：人工拒接
**操作**: 客服A拒接分配的会话

**预期结果**:
- 会话重新进入排队
- 自动寻找下一个可用客服
- 如果有客服B在线，分配给B
- 客服A的拒接记录在绩效中可见

### 失败场景 3：向已结束会话写入
**操作**: 对 status=completed 的会话调用 addMessage

**预期结果**:
- API 返回 400 错误
- 错误码 = `CONVERSATION_CLOSED`
- 消息不会被写入

### 失败场景 4：重复转人工
**操作**: 对已有活跃转人工的会话再次申请

**预期结果**:
- 返回 `duplicate: true`
- 附带着现有转人工的信息
- 不会创建新记录

---

## 📊 业务规则引擎

### 内置规则

| 规则 | 说明 | 代码位置 |
|------|------|----------|
| 重复转人工检测 | 2小时内已有转人工记录时拦截 | `EscalationService.js:56-64` |
| 情绪优先级 | 高情绪自动获得高排队优先级 | `EscalationService.js:69-75` |
| 无客服排队 | 无可用客服时进入队列等待 | `EscalationService.js:124-136` |
| 拒接重分配 | 客服拒接后自动找下一个 | `EscalationService.js:298-303` |
| 结束后不可写 | 已结束会话拒绝写入 | 各Service的 `Conversation.isClosed` 检查 |
| 幂等性保证 | 相同idempotency_key返回相同结果 | 各Service的key检查 |
| 修正审计 | 所有人工修改记录前后差异 | `ProcessingService.js:93-147` |

### 状态流转

```
bot → escalating → queued → assigned → in_progress → completed
                         ↓
                   (等待客服)
```

---

## 🗄️ 数据模型

核心表结构：
- `conversations` - 会话主表
- `messages` - 消息记录
- `intents` - 意图识别记录
- `emotions` - 情绪检测记录
- `escalation_requests` - 转人工申请
- `queue_entries` - 排队记录
- `agent_handlers` - 客服处理记录
- `processing_results` - 处理结果
- `corrections` - 人工修正审计
- `timeline_events` - 时间线事件

---

## 🎯 关键设计点

### 1. 意图和情绪如何传递给人工？
转人工请求创建时，metadata 字段保存：
- `primary_intent` - 主要意图
- `emotion_detected` - 检测到的情绪
- 置信度和历史计数

客服接入时通过 `/api/escalations/context/{conversationId}` 获取完整上下文。

### 2. 排队优先级如何计算？
优先级 = 情绪优先级（最高10）
- angry=10, frustrated=8, anxious=7
- 可通过 `priority_override` 参数手动覆盖

### 3. 如何保证幂等？
- 转人工请求支持 `idempotency_key`
- 处理结果提交支持 `idempotency_key`
- 重复请求返回已有记录

### 4. 人工修正如何审计？
`corrections` 表记录：
- `field_type` - 修正的字段
- `old_value` - 修正前的值（JSON）
- `new_value` - 修正后的值（JSON）
- `corrected_by` - 修正者ID
- `reason` - 修正原因

---

## 📝 目录结构

```
src/
├── config.js              # 配置
├── server.js              # 服务器入口
├── seed.js                # 造数脚本
├── demo.js                # 演示脚本
├── database/
│   ├── db.js              # 数据库连接
│   └── schema.js          # 表结构
├── models/                # 数据模型（10个）
├── services/              # 业务服务（4个）
│   ├── ConversationService.js  # 会话管理
│   ├── EscalationService.js    # 转人工逻辑
│   ├── ProcessingService.js    # 结果处理
│   └── ReportService.js        # 报告导出
├── routes/                # API路由（5个）
└── utils/                 # 工具模块
```

---

## 🧪 快速验证清单

运行 `npm run demo` 后，检查以下点：

- [ ] 场景1: 机器人闭环会话状态 = closed
- [ ] 场景2: 情绪升级会话优先级 = 10
- [ ] 场景3: 重复请求返回 duplicate: true
- [ ] 场景4: 已完成会话拒绝写入
- [ ] 场景5: 拒接后重新分配
- [ ] 报告: 时间线包含所有关键事件
- [ ] 报告: 统计包含各情绪数量
- [ ] 报告: 客服绩效显示处理数量

---

## 🔧 调试技巧

### 查看数据库
数据库文件位置：`./data/conversations.db`

使用 SQLite 客户端查看：
```bash
sqlite3 ./data/conversations.db
.tables
SELECT * FROM conversations;
SELECT * FROM timeline_events ORDER BY created_at;
```

### 清空数据重新开始
```bash
rm -rf ./data
npm run seed
```

### 查看日志
所有操作都会输出结构化日志到控制台，包含：
- 时间戳
- 操作类型
- 会话ID
- 关键参数

---

## ✅ 业务闭环验证

不看源码，只需运行：

```bash
npm run demo
```

然后检查输出中的 **"业务闭环验证"** 部分：
- ✓ 意图和情绪在转人工时被保存和传递
- ✓ 情绪决定排队优先级
- ✓ 人工能看到完整上下文
- ✓ 处理结果被记录，修改有审计
- ✓ 时间线完整可追溯

这5个复选框全部出现 = 业务闭环验证通过！
