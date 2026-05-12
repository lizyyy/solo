# 直播礼物分账 API

一个完整的直播礼物收入分账系统，支持主播、公会、平台三方分账，以及违规冻结、退款冲抵、比例变更、幂等处理等复杂业务场景。

## 项目特点

- **三方分账**: 主播、公会、平台按比例自动分成
- **违规冻结**: 违规期间收入全部冻结，可追溯
- **退款跨账期**: 退款冲抵下期结算，负余额自动结转
- **比例变更**: 支持分账规则按时间生效
- **幂等保证**: 重复回调只处理一次
- **人工修正**: 记录前后差异和操作者
- **状态追踪**: 每一步都有状态变化和历史记录

## 本地启动

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务启动后访问：http://localhost:3000

### 3. 运行演示脚本

```bash
npm test
```

## 核心概念

### 数据模型

- **Anchor (主播)**: 直播间主播，属于或不属于公会
- **Guild (公会)**: 主播所属公会，管理分账比例
- **Gift (礼物)**: 观众送的礼物，有类型、数量、单价
- **SettlementRule (分账规则)**: 定义主播/公会/平台分成比例，支持按时间生效
- **Freeze (冻结)**: 违规记录，指定冻结期间
- **Refund (退款)**: 用户退款，可跨账期冲抵
- **Settlement (结算)**: 某一账期某主播的结算单

### 账期规则

每半月为一个账期：
- 每月1-15日 → `YYYY-MM-01`
- 每月16-月末 → `YYYY-MM-16`

### 分账比例

典型比例配置：
```
主播: 50%
公会: 20%
平台: 30%
```

## API 接口

### 基础信息

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api` | API 信息 |
| GET | `/api/health` | 健康检查 |
| GET | `/api/dashboard` | 仪表盘概览 |

### 主播管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/anchors` | 创建主播 |
| GET | `/api/anchors` | 查看所有主播 |
| GET | `/api/anchors/:id` | 查看单个主播 |

### 公会管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/guilds` | 创建公会 |
| GET | `/api/guilds` | 查看所有公会 |

### 分账规则

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/rules` | 创建分账规则 |
| GET | `/api/rules` | 查看所有规则 |

### 礼物回调

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/gifts` | 提交礼物（幂等） |
| GET | `/api/gifts` | 查看所有礼物 |

### 冻结管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/freezes` | 创建冻结记录 |
| GET | `/api/freezes` | 查看所有冻结 |

### 退款管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/refunds` | 提交退款 |
| GET | `/api/refunds` | 查看所有退款 |

### 结算管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/settlements/create` | 创建结算单 |
| POST | `/api/settlements/:id/finalize` | 完成结算 |
| POST | `/api/settlements/:id/correct` | 人工修正 |
| GET | `/api/settlements` | 查询结算（支持筛选） |
| GET | `/api/settlements/:id` | 查看单个结算 |
| GET | `/api/settlements/:id/history` | 查看历史记录 |

### 报告导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/reports/settlement/:id` | 结算详情报告 |
| GET | `/api/reports/anchor-explanation/:id` | 主播解释报告（JSON） |
| GET | `/api/reports/anchor-explanation/:id/text` | 主播解释报告（文本） |

### 异常处理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/exceptions` | 查看异常结算 |
| POST | `/api/exceptions/:id/retry` | 重试异常结算 |
| GET | `/api/audit-logs` | 审计日志 |

## 演示路径

### 路径一：正常分账流程（推荐先试这个）

**步骤**：

1. **创建公会**
```bash
curl -X POST http://localhost:3000/api/guilds \
  -H "Content-Type: application/json" \
  -d '{"name": "星辰公会"}'
```

2. **创建主播**（关联公会）
```bash
curl -X POST http://localhost:3000/api/anchors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "主播小明",
    "guildId": "<guild_id_from_step_1>"
  }'
```

3. **配置分账规则**
```bash
curl -X POST http://localhost:3000/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "guildId": "<guild_id>",
    "effectiveDate": "2024-01-01T00:00:00.000Z",
    "anchorRatio": 0.50,
    "guildRatio": 0.20,
    "platformRatio": 0.30
  }'
```

4. **提交礼物**
```bash
curl -X POST http://localhost:3000/api/gifts \
  -H "Content-Type: application/json" \
  -d '{
    "streamerId": "<anchor_id>",
    "guildId": "<guild_id>",
    "giftType": "火箭",
    "amount": 5,
    "unitPrice": 100,
    "timestamp": "2024-06-10T20:00:00.000Z"
  }'
```

5. **查看结算单**
```bash
curl "http://localhost:3000/api/settlements?anchorId=<anchor_id>"
```

6. **完成结算**
```bash
curl -X POST http://localhost:3000/api/settlements/<settlement_id>/finalize
```

7. **生成主播解释报告**
```bash
curl http://localhost:3000/api/reports/anchor-explanation/<settlement_id>/text
```

**预期结果**：
- 总礼物价值：500元
- 主播分成：250元（50%）
- 公会分成：100元（20%）
- 平台分成：150元（30%）
- 可打款金额：250元

---

### 路径二：违规冻结场景

**业务背景**：主播违规，平台冻结其违规期间所有收入

**步骤**：

1. 创建公会、主播（同路径一）
2. 配置分账规则（同路径一）

3. **创建冻结记录**
```bash
curl -X POST http://localhost:3000/api/freezes \
  -H "Content-Type: application/json" \
  -d '{
    "anchorId": "<anchor_id>",
    "reason": "直播内容违规，涉嫌低俗",
    "freezeStart": "2024-06-05T00:00:00.000Z",
    "freezeEnd": "2024-06-20T23:59:59.999Z"
  }'
```

4. **提交礼物（在冻结期间）**
```bash
curl -X POST http://localhost:3000/api/gifts \
  -H "Content-Type: application/json" \
  -d '{
    "streamerId": "<anchor_id>",
    "guildId": "<guild_id>",
    "giftType": "超级火箭",
    "amount": 10,
    "unitPrice": 500,
    "timestamp": "2024-06-10T20:00:00.000Z"
  }'
```

5. 完成结算、查看报告（同路径一）

**预期结果**：
- 总礼物价值：5000元
- 冻结金额：5000元
- 主播/公会/平台分成：0元
- 可打款金额：0元
- 结算状态：FROZEN

---

### 路径三：退款跨账期场景

**业务背景**：用户在上期充值送礼后申请退款，退款在本期结算中冲抵

**步骤**：

1. 创建公会、主播、配置规则（同路径一）

2. **上期礼物（6月上半月）**
```bash
curl -X POST http://localhost:3000/api/gifts \
  -H "Content-Type: application/json" \
  -d '{
    "streamerId": "<anchor_id>",
    "guildId": "<guild_id>",
    "giftType": "火箭",
    "amount": 10,
    "unitPrice": 100,
    "timestamp": "2024-06-10T20:00:00.000Z"
  }'
```

3. 完成上期结算

4. **本期礼物（6月下半月）**
```bash
curl -X POST http://localhost:3000/api/gifts \
  -H "Content-Type: application/json" \
  -d '{
    "streamerId": "<anchor_id>",
    "guildId": "<guild_id>",
    "giftType": "飞机",
    "amount": 5,
    "unitPrice": 100,
    "timestamp": "2024-06-20T20:00:00.000Z"
  }'
```

5. **创建退款**（退上期的火箭）
```bash
curl -X POST http://localhost:3000/api/refunds \
  -H "Content-Type: application/json" \
  -d '{
    "giftId": "<gift_id_from_step_2>",
    "originalPeriod": "2024-06-01",
    "refundPeriod": "2024-06-16",
    "amount": 500,
    "reason": "用户误操作，申请退款"
  }'
```

6. 完成本期结算、查看报告

**预期结果**：
- 本期礼物收入：500元
- 本期主播分成：250元
- 退款冲抵：-500元
- 可打款金额：0元
- 负余额结转至下期：-250元

---

### 路径四：比例变更场景

**业务背景**：公会调整分账比例，6月15日前主播50%，之后提升到55%

**步骤**：

1. 创建公会、主播

2. **旧规则（6月1-14日）**
```bash
curl -X POST http://localhost:3000/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "guildId": "<guild_id>",
    "effectiveDate": "2024-01-01T00:00:00.000Z",
    "endDate": "2024-06-14T23:59:59.999Z",
    "anchorRatio": 0.50,
    "guildRatio": 0.20,
    "platformRatio": 0.30
  }'
```

3. **新规则（6月15日起）**
```bash
curl -X POST http://localhost:3000/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "guildId": "<guild_id>",
    "effectiveDate": "2024-06-15T00:00:00.000Z",
    "anchorRatio": 0.55,
    "guildRatio": 0.15,
    "platformRatio": 0.30
  }'
```

4. **6月10日的礼物**（用旧规则）
```bash
curl -X POST http://localhost:3000/api/gifts \
  -H "Content-Type: application/json" \
  -d '{
    "streamerId": "<anchor_id>",
    "guildId": "<guild_id>",
    "giftType": "火箭",
    "amount": 10,
    "unitPrice": 100,
    "timestamp": "2024-06-10T20:00:00.000Z"
  }'
```

5. **6月20日的礼物**（用新规则）
```bash
curl -X POST http://localhost:3000/api/gifts \
  -H "Content-Type: application/json" \
  -d '{
    "streamerId": "<anchor_id>",
    "guildId": "<guild_id>",
    "giftType": "火箭",
    "amount": 10,
    "unitPrice": 100,
    "timestamp": "2024-06-20T20:00:00.000Z"
  }'
```

6. 完成两个账期的结算，对比查看

**预期结果**：
- 6月10日礼物（旧规则）：主播分成 500元（50%），公会 200元（20%）
- 6月20日礼物（新规则）：主播分成 550元（55%），公会 150元（15%）

---

### 路径五：失败路径（无分账规则导致异常）

**业务背景**：主播收到礼物但没有配置分账规则，导致结算失败

**步骤**：

1. **创建主播（不配置规则）**
```bash
curl -X POST http://localhost:3000/api/anchors \
  -H "Content-Type: application/json" \
  -d '{"name": "无规则主播"}'
```

2. **提交礼物**（会触发错误）
```bash
curl -X POST http://localhost:3000/api/gifts \
  -H "Content-Type: application/json" \
  -d '{
    "streamerId": "<anchor_id>",
    "giftType": "火箭",
    "amount": 5,
    "unitPrice": 100,
    "timestamp": "2024-06-10T20:00:00.000Z"
  }'
```

3. **查看异常列表**
```bash
curl http://localhost:3000/api/exceptions
```

4. **查看失败原因**
```bash
curl "http://localhost:3000/api/settlements?status=FAILED"
```

5. **人工补救 - 补充分账规则**
```bash
curl -X POST http://localhost:3000/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "anchorId": "<anchor_id>",
    "effectiveDate": "2024-01-01T00:00:00.000Z",
    "anchorRatio": 0.60,
    "guildRatio": 0,
    "platformRatio": 0.40
  }'
```

6. **重试异常结算**
```bash
curl -X POST http://localhost:3000/api/exceptions/<settlement_id>/retry
```

**预期结果**：
- 第一步：礼物创建成功
- 第二步：抛出异常 "No active settlement rule for anchor"
- 第三步：异常列表显示 1 条失败记录
- 第四步：历史记录显示失败原因
- 第六步：重试后状态变为 COMPLETED

---

### 路径六：幂等性验证

**业务背景**：礼物回调可能重复发送，系统要保证只处理一次

**步骤**：

1. 创建公会、主播、配置规则（同路径一）

2. **第一次提交礼物**
```bash
curl -X POST http://localhost:3000/api/gifts \
  -H "Content-Type: application/json" \
  -d '{
    "streamerId": "<anchor_id>",
    "guildId": "<guild_id>",
    "giftType": "火箭",
    "amount": 5,
    "unitPrice": 100,
    "timestamp": "2024-06-10T20:00:00.000Z"
  }'
```
返回：`isDuplicate: false`

3. **第二次提交相同的礼物**（模拟网络重试）
```bash
curl -X POST http://localhost:3000/api/gifts \
  -H "Content-Type: application/json" \
  -d '{
    "streamerId": "<anchor_id>",
    "guildId": "<guild_id>",
    "giftType": "火箭",
    "amount": 5,
    "unitPrice": 100,
    "timestamp": "2024-06-10T20:00:00.000Z"
  }'
```
返回：`isDuplicate: true`

4. **查看结算单**，确认只有1个礼物

**预期结果**：
- 两次提交返回同一个礼物ID
- 结算单中只有1个礼物
- 总金额是 500 元，不是 1000 元

---

### 路径七：人工修正

**业务背景**：运营人员需要人工调整结算金额，必须记录前后差异和操作者

**步骤**：

1. 完成一笔正常结算（同路径一）

2. **人工修正**
```bash
curl -X POST http://localhost:3000/api/settlements/<settlement_id>/correct \
  -H "Content-Type: application/json" \
  -d '{
    "changes": {
      "anchorShare": 600,
      "platformShare": 200
    },
    "operator": "ZHANG_MANAGER"
  }'
```

3. **查看修正记录**
```bash
curl http://localhost:3000/api/settlements/<settlement_id>
```

4. **查看审计日志**
```bash
curl "http://localhost:3000/api/audit-logs?entityType=SETTLEMENT&entityId=<settlement_id>"
```

**预期结果**：
- 修正前：主播 500元，平台 300元
- 修正后：主播 600元，平台 200元
- 记录操作人：ZHANG_MANAGER
- 审计日志包含完整的 before/after 快照

## 运行内置样例

项目包含 7 个完整的内置样例场景，直接运行演示脚本即可查看：

```bash
npm test
```

样例场景：
1. **正常分账** - 主播、公会、平台按比例分账
2. **违规冻结** - 违规期间收入全部冻结
3. **退款跨账期** - 退款冲抵下期结算款
4. **比例变更** - 不同时间点按不同规则计算
5. **重复回调** - 幂等性保证
6. **失败路径** - 无规则导致失败及重试机制
7. **人工修正** - 记录前后差异和操作者

## 状态机

### 结算状态

| 状态 | 说明 | 可转换到 |
|------|------|----------|
| CREATED | 已创建 | PROCESSING, FAILED |
| PROCESSING | 处理中 | PARTIAL, COMPLETED, FROZEN, FAILED |
| PARTIAL | 部分完成（持续收礼中） | COMPLETED, FROZEN, FAILED |
| COMPLETED | 已完成（可打款） | - |
| FROZEN | 有冻结金额 | COMPLETED（解冻后） |
| FAILED | 处理失败 | COMPLETED（重试后） |

### 礼物状态

| 状态 | 说明 |
|------|------|
| PENDING | 待结算 |
| SETTLED | 已结算 |
| FROZEN | 已冻结 |
| REFUNDED | 已退款 |

## 审计日志

所有关键操作都会记录审计日志，可通过以下接口查询：

```bash
curl http://localhost:3000/api/audit-logs
```

支持按实体类型和实体ID筛选：
```bash
curl "http://localhost:3000/api/audit-logs?entityType=SETTLEMENT"
curl "http://localhost:3000/api/audit-logs?entityType=GIFT&entityId=<gift_id>"
```

审计事件类型：
- `GIFT_CREATED` - 礼物创建
- `IDEMPOTENT_DUPLICATE` - 幂等重复
- `SETTLEMENT_CREATED` - 结算单创建
- `SETTLEMENT_STATUS_CHANGE` - 状态变更
- `SETTLEMENT_FINALIZED` - 结算完成
- `REFUND_PROCESSED` - 退款处理
- `MANUAL_CORRECTION` - 人工修正
- `RETRY_ATTEMPT` - 重试尝试

## 项目结构

```
live-gift-settlement-api/
├── package.json
├── README.md
├── src/
│   ├── server.js              # 服务入口
│   ├── models/
│   │   └── store.js           # 内存存储和数据模型
│   ├── engine/
│   │   └── settlementEngine.js # 核心分账引擎
│   └── routes/
│       └── index.js           # API 路由
└── tests/
    └── run-samples.js         # 演示脚本（7个场景）
```

## 注意事项

1. **内存存储**: 本项目使用内存存储，重启后数据会清空。生产环境请替换为真实数据库。

2. **账期计算**: 默认每半月结算一次，可根据业务需求修改 `getSettlementPeriod` 函数。

3. **四舍五入**: 金额计算采用四舍五入保留两位小数，分账差异会自动调整到主播端。

4. **负余额结转**: 当退款冲抵导致本期可打款金额为负时，负余额自动结转至下期。

5. **幂等键**: 礼物幂等检查使用 `streamerId + giftType + amount + timestamp` 组合键。

## 验证业务闭环

通过以下步骤验证业务是否真正闭环：

1. **创建一笔正常结算** → 确认各方分成正确
2. **查看主播解释报告** → 确认不看源码也能理解账单
3. **查看审计日志** → 确认所有操作都有记录
4. **模拟失败场景** → 确认异常可追踪、可重试
5. **人工修正** → 确认前后差异和操作者都有记录
6. **运行演示脚本** → `npm test`，所有场景验证通过

## License

MIT
