# 会员积分冻结 API

解决风控冻结积分后，消费、退款和解冻经常把余额算错的问题。

## 核心功能

- **积分流水**：所有操作都有完整的流水记录，可追溯
- **冻结桶**：每笔冻结独立记录，支持 ACTIVE/PARTIAL/RELEASED/USED 状态
- **解冻规则**：支持时间自动解冻和手动解冻
- **重复扣减拦截**：通过 requestId + action 做幂等键
- **余额快照**：每日快照用于报表对账
- **报表一致性**：流水冻结余额 vs 冻结桶实际冻结余额校验

## 快速开始

### 安装依赖

```bash
npm install
```

### 运行服务

```bash
npm start
```

服务启动后访问 `http://localhost:3000`

### 运行测试

```bash
npm test
```

### 导入种子数据

```bash
npm run seed
```

## 核心概念

### 三余额设计

| 余额类型 | 说明 |
|---------|------|
| `total_balance` | 总额 = 冻结余额 + 可用余额 |
| `freeze_balance` | 冻结余额 |
| `available_balance` | 可用余额 |

### 请求头

| Header | 说明 | 必填 |
|--------|------|------|
| `X-Request-Id` | 幂等请求 ID，相同 ID + action 只执行一次 | 推荐 |
| `X-Operator-Name` | 操作人名称 | 否 |
| `X-Operator-Id` | 操作人 ID | 否 |
| `X-Operator-Type` | 操作人类型 (api/system/risk) | 否 |

## API 接口

### 1. 健康检查

```bash
curl http://localhost:3000/health
```

### 2. 会员管理

#### 创建会员

```bash
curl -X POST http://localhost:3000/api/v1/members \
  -H "Content-Type: application/json" \
  -d '{"name": "张三"}'
```

#### 查询所有会员

```bash
curl http://localhost:3000/api/v1/members
```

#### 查询单个会员

```bash
curl http://localhost:3000/api/v1/members/<memberId>
```

### 3. 积分操作

#### 查询余额

```bash
curl http://localhost:3000/api/v1/points/<memberId>/balance
```

响应示例：
```json
{
  "success": true,
  "data": {
    "balance": {
      "totalBalance": 10000,
      "freezeBalance": 3000,
      "availableBalance": 7000
    },
    "consistency": {
      "isConsistent": true
    }
  }
}
```

#### 充值积分

```bash
curl -X POST http://localhost:3000/api/v1/points/<memberId>/recharge \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: recharge-001" \
  -H "X-Operator-Name: admin" \
  -H "X-Operator-Id: admin-001" \
  -d '{
    "amount": 10000,
    "reason": "初始充值"
  }'
```

#### 消费积分

```bash
curl -X POST http://localhost:3000/api/v1/points/<memberId>/consume \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: consume-001" \
  -d '{
    "amount": 2000,
    "refId": "ORD-20240101-001",
    "reason": "购买商品",
    "allowFreeze": false
  }'
```

参数说明：
- `allowFreeze`: 是否允许使用冻结积分，默认为 `false`

#### 退款积分

```bash
curl -X POST http://localhost:3000/api/v1/points/<memberId>/refund \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: refund-001" \
  -d '{
    "amount": 2000,
    "refId": "ORD-20240101-001",
    "reason": "订单取消"
  }'
```

### 4. 冻结/解冻

#### 创建冻结规则

```bash
curl -X POST http://localhost:3000/api/v1/points/rules \
  -H "Content-Type: application/json" \
  -d '{
    "code": "RISK_7D",
    "name": "风险冻结-7天",
    "releaseType": "TIME",
    "releaseDays": 7,
    "autoRelease": true,
    "priority": 100,
    "description": "风控触发，7天后自动解冻"
  }'
```

参数说明：
- `releaseType`: `TIME` 时间自动解冻，`MANUAL` 手动解冻
- `releaseDays`: 自动解冻天数（仅 TIME 类型有效）
- `autoRelease`: 是否自动解冻

#### 查询所有冻结规则

```bash
curl http://localhost:3000/api/v1/points/rules
```

#### 冻结积分

```bash
curl -X POST http://localhost:3000/api/v1/points/<memberId>/freeze \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: freeze-001" \
  -H "X-Operator-Name: risk_engine" \
  -H "X-Operator-Id: risk-001" \
  -H "X-Operator-Type: risk" \
  -d '{
    "amount": 3000,
    "freezeRuleCode": "RISK_7D",
    "reason": "异常交易检测"
  }'
```

#### 解冻积分

```bash
curl -X POST http://localhost:3000/api/v1/points/<memberId>/unfreeze \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: unfreeze-001" \
  -d '{
    "bucketId": "<bucketId>",
    "amount": 3000,
    "reason": "风险解除"
  }'
```

#### 自动解冻到期冻结

```bash
curl -X POST http://localhost:3000/api/v1/points/<memberId>/auto-unfreeze
```

### 5. 查询流水和快照

#### 查询积分流水

```bash
curl "http://localhost:3000/api/v1/points/<memberId>/ledgers?limit=50"
```

#### 查询冻结桶

```bash
curl http://localhost:3000/api/v1/points/<memberId>/buckets
```

#### 创建余额快照

```bash
curl http://localhost:3000/api/v1/points/<memberId>/snapshot/2024-01-01
```

#### 查询幂等记录

```bash
curl http://localhost:3000/api/v1/points/idempotency/<requestId>/<action>
```

`action` 可选值：`recharge`, `freeze`, `consume`, `refund`, `unfreeze`

## 完整调用示例

### 场景：正常消费流程

```bash
# 1. 创建会员
MEMBER_ID=$(curl -s -X POST http://localhost:3000/api/v1/members \
  -H "Content-Type: application/json" \
  -d '{"name": "测试用户"}' | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin').toString()).data.id)")

echo "会员ID: $MEMBER_ID"

# 2. 充值 10000 积分
curl -X POST http://localhost:3000/api/v1/points/$MEMBER_ID/recharge \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: demo-recharge-001" \
  -d '{"amount": 10000, "reason": "初始充值"}'

# 3. 查看余额（总:10000, 冻结:0, 可用:10000）
curl http://localhost:3000/api/v1/points/$MEMBER_ID/balance

# 4. 消费 2000 积分
curl -X POST http://localhost:3000/api/v1/points/$MEMBER_ID/consume \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: demo-consume-001" \
  -d '{"amount": 2000, "refId": "DEMO-ORD-001", "reason": "购买商品"}'

# 5. 查看余额（总:8000, 冻结:0, 可用:8000）
curl http://localhost:3000/api/v1/points/$MEMBER_ID/balance

# 6. 查看流水
curl http://localhost:3000/api/v1/points/$MEMBER_ID/ledgers
```

### 场景：风控冻结后消费

```bash
# 1. 创建冻结规则
curl -X POST http://localhost:3000/api/v1/points/rules \
  -H "Content-Type: application/json" \
  -d '{
    "code": "DEMO_RISK_7D",
    "name": "演示风险冻结-7天",
    "releaseType": "TIME",
    "releaseDays": 7,
    "autoRelease": true,
    "priority": 100,
    "description": "演示用"
  }'

# 2. 冻结 3000 积分
FREEZE_RESULT=$(curl -s -X POST http://localhost:3000/api/v1/points/$MEMBER_ID/freeze \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: demo-freeze-001" \
  -H "X-Operator-Type: risk" \
  -d '{"amount": 3000, "freezeRuleCode": "DEMO_RISK_7D", "reason": "风险检测"}')

echo "冻结结果: $FREEZE_RESULT"

# 3. 查看余额（总:8000, 冻结:3000, 可用:5000）
curl http://localhost:3000/api/v1/points/$MEMBER_ID/balance

# 4. 查看冻结桶
curl http://localhost:3000/api/v1/points/$MEMBER_ID/buckets

# 5. 尝试消费 6000（可用余额不足，失败）
curl -X POST http://localhost:3000/api/v1/points/$MEMBER_ID/consume \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: demo-consume-002" \
  -d '{"amount": 6000, "allowFreeze": false}'

# 6. 允许使用冻结积分消费（成功）
curl -X POST http://localhost:3000/api/v1/points/$MEMBER_ID/consume \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: demo-consume-003" \
  -d '{"amount": 6000, "allowFreeze": true, "reason": "紧急消费"}'

# 7. 查看余额（总:2000, 冻结:2000, 可用:0）
curl http://localhost:3000/api/v1/points/$MEMBER_ID/balance
```

### 场景：幂等性演示

```bash
# 首次充值（成功）
curl -X POST http://localhost:3000/api/v1/points/$MEMBER_ID/recharge \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: demo-idempotent-001" \
  -d '{"amount": 1000, "reason": "幂等测试"}'

# 重复充值（同样的 X-Request-Id，返回幂等结果，不重复加款）
curl -X POST http://localhost:3000/api/v1/points/$MEMBER_ID/recharge \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: demo-idempotent-001" \
  -d '{"amount": 1000, "reason": "幂等测试"}'

# 查看余额（只增加了一次 1000）
curl http://localhost:3000/api/v1/points/$MEMBER_ID/balance
```

### 场景：退款流程

```bash
# 1. 消费
curl -X POST http://localhost:3000/api/v1/points/$MEMBER_ID/consume \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: demo-consume-refund-001" \
  -d '{"amount": 1000, "refId": "DEMO-REFUND-ORD-001", "reason": "测试退款商品"}'

# 2. 查看消费后余额
curl http://localhost:3000/api/v1/points/$MEMBER_ID/balance

# 3. 退款
curl -X POST http://localhost:3000/api/v1/points/$MEMBER_ID/refund \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: demo-refund-001" \
  -d '{"amount": 1000, "refId": "DEMO-REFUND-ORD-001", "reason": "订单取消"}'

# 4. 查看退款后余额（恢复）
curl http://localhost:3000/api/v1/points/$MEMBER_ID/balance
```

### 场景：手动解冻

```bash
# 1. 先获取冻结桶ID
BUCKET_ID=$(curl -s http://localhost:3000/api/v1/points/$MEMBER_ID/buckets | \
  node -e "const data = JSON.parse(require('fs').readFileSync('/dev/stdin').toString()); console.log(data.data[0]?.id || '')")

echo "冻结桶ID: $BUCKET_ID"

# 2. 解冻 2000 积分
if [ -n "$BUCKET_ID" ]; then
  curl -X POST http://localhost:3000/api/v1/points/$MEMBER_ID/unfreeze \
    -H "Content-Type: application/json" \
    -H "X-Request-Id: demo-unfreeze-001" \
    -d "{\"bucketId\": \"$BUCKET_ID\", \"amount\": 2000, \"reason\": \"风险解除\"}"
fi

# 3. 查看余额
curl http://localhost:3000/api/v1/points/$MEMBER_ID/balance
```

## 错误码

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| `MEMBER_NOT_FOUND` | 404 | 会员不存在 |
| `INSUFFICIENT_BALANCE` | 400 | 可用余额不足 |
| `IDEMPOTENT_CONFLICT` | 409 | 幂等冲突（请求处理中） |
| `FREEZE_RULE_NOT_FOUND` | 404 | 冻结规则不存在 |
| `FREEZE_BUCKET_NOT_FOUND` | 404 | 冻结桶不存在 |
| `INVALID_AMOUNT` | 400 | 无效金额 |
| `VALIDATION_ERROR` | 400 | 参数校验失败 |
| `CONSUMPTION_NOT_FOUND` | 404 | 未找到对应消费记录 |
| `REFUND_EXCEEDS_CONSUMPTION` | 400 | 退款金额超过已消费金额 |
| `DUPLICATE_REFUND` | 409 | 已存在相同订单的退款 |
| `NOT_FOUND` | 404 | 接口不存在 |

## 数据一致性校验

每次查询余额时会自动校验一致性：

```bash
curl http://localhost:3000/api/v1/points/<memberId>/balance
```

响应中的 `consistency.isConsistent` 表示流水冻结余额与冻结桶实际冻结余额是否一致。

## 项目结构

```
src/
├── app.js                  # Express 应用工厂
├── index.js                # 服务入口
├── config/
│   └── database.js         # 数据库配置（sql.js）
├── database/
│   └── schema.js           # 数据库表结构
├── repositories/           # 数据访问层
│   ├── MemberRepository.js
│   ├── PointLedgerRepository.js
│   ├── FreezeBucketRepository.js
│   ├── FreezeRuleRepository.js
│   ├── BalanceSnapshotRepository.js
│   └── IdempotencyRepository.js
├── services/               # 业务逻辑层
│   ├── PointService.js     # 核心积分服务
│   └── BalanceService.js   # 余额计算服务
├── routes/                 # 路由层
│   ├── members.js
│   └── points.js
├── middleware/
│   └── errorHandler.js     # 错误处理中间件
├── errors/
│   └── ApiError.js         # 自定义错误类
├── seeders/
│   └── seed.js             # 种子数据脚本
└── __tests__/              # 测试
    ├── api.test.js
    └── pointService.test.js
```

## 数据库表

- `members` - 会员表
- `point_ledgers` - 积分流水表
- `freeze_buckets` - 冻结桶表
- `freeze_rules` - 冻结规则表
- `balance_snapshots` - 余额快照表
- `idempotency_keys` - 幂等键表
