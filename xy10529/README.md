# 会员权益冻结 API

处理会员权益在退款、风控、过期和人工补偿之间切换时的账本一致性。

## 本地启动

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm run dev
```

服务启动后访问: http://localhost:3000

### 3. 运行演示脚本（推荐）

```bash
npm run demo
```

演示脚本会自动执行所有业务场景并输出详细的状态变化。

## 核心业务规则

| 场景 | 规则说明 |
|------|----------|
| **正常使用** | 权益发放后状态为 active，可正常使用 |
| **风控冻结** | 临时冻结，剩余天数保留，解除后恢复 |
| **退款冻结** | 永久冻结，剩余天数清零，不可解冻 |
| **人工补偿** | 单次补偿上限90天，退款后不可补偿 |
| **幂等性** | 相同 requestId 返回相同结果，不重复执行 |
| **人工修正** | 必须记录前后差异和操作者 |

## API 接口

### 公共请求头

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| X-Request-Id | string | 否 | 用于幂等控制，不填自动生成 |

### 会员接口

#### POST /api/member/create - 创建会员

**请求体:**
```json
{
  "name": "张三",
  "phone": "13800138001"
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "memberId": "uuid",
    "name": "张三",
    "phone": "13800138001"
  },
  "message": "会员创建成功",
  "requestId": "req-id"
}
```

#### GET /api/member/:memberId - 查询会员

#### GET /api/member/:memberId/benefits - 查询会员所有权益

### 权益接口

#### POST /api/benefit/grant - 发放权益

**请求体:**
```json
{
  "memberId": "member-uuid",
  "benefitType": "VIP",
  "benefitName": "月度VIP会员",
  "totalDays": 30
}
```

#### GET /api/benefit/:benefitId - 查询权益详情

返回当前权益状态、历史记录、账本解释。

**响应包含:**
- `currentState`: 当前状态、剩余天数、冻结原因、可操作标志
- `ledgerExplanation`: 人类可读的账本解释列表

#### POST /api/benefit/:benefitId/freeze - 冻结权益

**请求体:**
```json
{
  "reason": "risk_control",
  "detail": "风控检测: 异常登录IP",
  "operator": "风控系统"
}
```

**冻结原因(reason)可选值:**
- `refund` - 退款（永久冻结）
- `risk_control` - 风控
- `manual` - 人工冻结
- `other` - 其他

#### POST /api/benefit/:benefitId/unfreeze - 解冻权益

**请求体:**
```json
{
  "reason": "风控审核通过",
  "operator": "风控专员-小李"
}
```

#### POST /api/benefit/:benefitId/refund - 退款处理

**请求体:**
```json
{
  "detail": "用户主动申请退款",
  "operator": "客服-小王"
}
```

> ⚠️ 退款后权益永久失效，剩余天数清零，不可解冻。

#### POST /api/benefit/:benefitId/compensate - 人工补偿

**请求体:**
```json
{
  "days": 7,
  "reason": "系统故障补偿",
  "operator": "客服-小张"
}
```

> ⚠️ 单次补偿上限 90 天，已退款权益不可补偿。

#### POST /api/benefit/:benefitId/correct - 人工修正

**请求体:**
```json
{
  "changes": {
    "remainingDays": 200,
    "status": "active",
    "name": "修正后的权益名称"
  },
  "operator": "运营经理-老刘",
  "reason": "历史数据迁移修正"
}
```

> 📝 人工修正会记录前后差异和操作者。

### 报告接口

#### GET /api/report/export - 导出报告

**可选参数:**
- `memberId`: 按会员筛选
- `benefitId`: 按权益筛选
- `format=csv`: 导出CSV格式

#### GET /api/report/all - 查看所有数据

## 主要演示路径

### 路径一: 正常使用流程

```bash
# 1. 创建会员
curl -X POST http://localhost:3000/api/member/create \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: req-demo-001" \
  -d '{"name":"张三","phone":"13800138001"}'

# 2. 发放权益（30天VIP）
curl -X POST http://localhost:3000/api/benefit/grant \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: req-demo-002" \
  -d '{"memberId":"<memberId>","benefitType":"VIP","benefitName":"月度VIP","totalDays":30}'

# 3. 查询权益（验证状态: active, 剩余30天）
curl http://localhost:3000/api/benefit/<benefitId>
```

### 路径二: 风控冻结与解除

```bash
# 1. 风控冻结（状态变为 frozen）
curl -X POST http://localhost:3000/api/benefit/<benefitId>/freeze \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: req-demo-003" \
  -d '{"reason":"risk_control","detail":"异常登录检测","operator":"风控系统"}'

# 2. 查询（验证冻结状态，剩余天数保留）
curl http://localhost:3000/api/benefit/<benefitId>

# 3. 解除冻结（恢复 active，剩余天数恢复）
curl -X POST http://localhost:3000/api/benefit/<benefitId>/unfreeze \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: req-demo-004" \
  -d '{"reason":"风控审核通过","operator":"风控专员"}'
```

### 路径三: 退款流程（失败路径演示）

```bash
# 1. 创建新会员并发放权益
curl -X POST http://localhost:3000/api/member/create \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: req-demo-005" \
  -d '{"name":"李四","phone":"13800138002"}'

curl -X POST http://localhost:3000/api/benefit/grant \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: req-demo-006" \
  -d '{"memberId":"<memberId>","benefitType":"SVIP","benefitName":"季度SVIP","totalDays":90}'

# 2. 执行退款（永久冻结，剩余天数清零）
curl -X POST http://localhost:3000/api/benefit/<benefitId>/refund \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: req-demo-007" \
  -d '{"detail":"用户主动退款","operator":"客服"}'

# 3. 尝试解冻（应该失败！）
curl -X POST http://localhost:3000/api/benefit/<benefitId>/unfreeze \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: req-demo-008" \
  -d '{"reason":"尝试解冻已退款权益"}'
```

**预期结果:** 第三步返回 `success: false`，提示"权益已退款失效，不可解冻"

### 路径四: 人工补偿

```bash
# 1. 创建会员并发放365天权益
curl -X POST http://localhost:3000/api/member/create \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: req-demo-009" \
  -d '{"name":"王五","phone":"13800138003"}'

curl -X POST http://localhost:3000/api/benefit/grant \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: req-demo-010" \
  -d '{"memberId":"<memberId>","benefitType":"VIP","benefitName":"年度VIP","totalDays":365}'

# 2. 补偿7天（变为372天）
curl -X POST http://localhost:3000/api/benefit/<benefitId>/compensate \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: req-demo-011" \
  -d '{"days":7,"reason":"系统故障补偿","operator":"客服"}'

# 3. 尝试补偿100天（超限失败）
curl -X POST http://localhost:3000/api/benefit/<benefitId>/compensate \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: req-demo-012" \
  -d '{"days":100,"reason":"测试超限","operator":"测试"}'
```

### 路径五: 幂等性验证

```bash
# 用相同 requestId 重复调用补偿
curl -X POST http://localhost:3000/api/benefit/<benefitId>/compensate \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: req-demo-011" \
  -d '{"days":7,"reason":"系统故障补偿","operator":"客服"}'
```

**预期结果:** 返回 `isIdempotent: true`，剩余天数仍为372天（只补偿一次）

## 失败路径说明

### 失败场景一: 退款后尝试解冻

**操作:** 退款后调用 `/unfreeze`

**预期响应:**
```json
{
  "success": false,
  "message": "权益已退款失效，不可解冻",
  "requestId": "..."
}
```

**账本记录:** 会记录失败操作及原因

### 失败场景二: 补偿超限

**操作:** 调用 `/compensate` 传入 days > 90

**预期响应:**
```json
{
  "success": false,
  "message": "补偿天数必须在1-90天之间",
  "requestId": "..."
}
```

### 失败场景三: 重复解冻

**操作:** 权益已处于 active 状态时调用 `/unfreeze`

**预期响应:**
```json
{
  "success": false,
  "message": "权益未处于冻结状态",
  "requestId": "..."
}
```

### 失败场景四: 重复冻结

**操作:** 权益已处于 frozen 状态时调用 `/freeze`

**预期响应:**
```json
{
  "success": false,
  "message": "权益已处于冻结状态，不允许重复冻结",
  "requestId": "..."
}
```

## 如何验证业务闭环

查询权益详情时，返回的 `ledgerExplanation` 字段包含完整的人类可读解释：

```json
{
  "ledgerExplanation": [
    "[2024/1/1 12:00:00] 发放权益: 月度VIP会员 (状态: 无效 → 正常, 天数: 0 → 30)",
    "[2024/1/1 12:05:00] 临时冻结: 原因=risk_control (状态: 正常 → 冻结, 天数: 30 → 30)",
    "[2024/1/1 12:10:00] 解冻成功: 恢复剩余天数=30天 (状态: 冻结 → 正常, 天数: 30 → 30)",
    "[2024/1/1 12:15:00] 人工补偿: +7天 (状态: 正常 → 正常, 天数: 30 → 37)"
  ]
}
```

通过账本解释可以验证：
1. ✅ 状态变化是否符合预期
2. ✅ 剩余天数是否正确计算
3. ✅ 失败操作是否有记录
4. ✅ 幂等操作是否生效

## 项目结构

```
.
├── src/
│   ├── index.ts              # 服务入口
│   ├── types/
│   │   └── index.ts          # 类型定义
│   ├── storage/
│   │   └── index.ts          # 内存存储
│   ├── services/
│   │   └── benefitService.ts # 核心业务逻辑
│   └── routes/
│       ├── memberRoutes.ts   # 会员路由
│       ├── benefitRoutes.ts  # 权益路由
│       └── reportRoutes.ts   # 报告路由
├── scripts/
│   └── demo.ts               # 演示脚本
├── package.json
├── tsconfig.json
└── README.md
```

## 状态流转图

```
           ┌─────────────────────────────────────────┐
           │                                         │
           │                                         ▼
   ┌───────┴───────┐      风控冻结        ┌───────────────────┐
   │    active     │ ────────────────►  │      frozen       │
   │   (正常状态)   │                      │   (临时冻结)       │
   └───────┬───────┘ ◄────────────────   └─────────┬─────────┘
           │            解除冻结                     │
           │                                        │
           │ 退款                                    │
           ▼                                        │ 退款
   ┌───────────────┐ ◄─────────────────────────────┘
   │   refunded    │
   │  (已退款失效)  │ ─────────► 永久冻结，不可操作
   └───────────────┘
```

## 关键验证点

| 验证项 | 验证方式 |
|--------|----------|
| 退款后不可解冻 | 执行退款后调用解冻，验证失败 |
| 风控解除恢复天数 | 冻结前查询剩余天数，解除后验证一致 |
| 补偿上限生效 | 传入100天，验证失败 |
| 幂等性生效 | 相同requestId重复调用，验证isIdempotent=true且数据不变 |
| 人工修正留痕 | 检查返回的diffs数组和账本记录 |
| 账本一致 | 查看ledgerExplanation，每步都有状态变化记录 |
