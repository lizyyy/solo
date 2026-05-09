# 共享琴房练习时长结算器 - 验收标准与使用说明

## 一、系统概述

本系统用于解决共享琴房按预约、实际进出和会员套餐结算的问题，特别是临时续时容易算错的场景。

## 二、验收场景说明

### 场景1：正常处理 (status: success)

**触发条件：**
- 会员有足够的套餐时长
- 实际练琴时长 ≤ 预约时长
- 有完整的签到和签出记录

**输出含义（通过）：**
```json
{
  "success": true,
  "status": "success",
  "scheduled_hours": 2.0,
  "actual_hours": 1.5,
  "package_deduction": 1.5,
  "cash_payment": 0,
  "needsManualReview": false
}
```

**判定标准：**
- ✅ success = true
- ✅ status = "success"
- ✅ needsManualReview = false
- ✅ 会员剩余时长已自动扣减
- ✅ 无需人工介入

---

### 场景2：部分现金支付 (status: partial_cash)

**触发条件：**
- 实际练琴时长 > 预约时长
- 套餐剩余时长不足以覆盖超时时长

**输出含义（需确认）：**
```json
{
  "success": true,
  "status": "partial_cash",
  "package_deduction": 2.5,
  "cash_payment": 60.0
}
```

**判定标准：**
- ✅ success = true
- ✅ status = "partial_cash"
- ✅ cash_payment > 0
- ⚠️ 需要人工确认现金是否已收取

---

### 场景3：待人工审核 (status: needs_review)

**触发条件：**
- 缺少签到或签出记录

**输出含义（需人工处理）：**
```json
{
  "success": false,
  "status": "needs_review",
  "error_message": "缺少签到记录",
  "needsManualReview": true
}
```

**判定标准：**
- ❌ success = false
- ❌ status = "needs_review"
- ⚠️ 必须人工介入

---

### 场景4：结算失败 (status: failed)

**触发条件：**
- 会员套餐余额严重不足

**输出含义（失败，需人工处理）：**
```json
{
  "success": false,
  "status": "failed",
  "error_message": "套餐余额不足。需要扣除 2.0 小时，剩余 1.5 小时",
  "needsManualReview": true
}
```

**判定标准：**
- ❌ success = false
- ❌ status = "failed"
- ⚠️ 需要检查并修复问题后重试

## 三、验证数据说明

每次结算都会生成 `verification_data` 字段，用于对账和审计，包含：
- originalReservation：原始预约信息
- memberSnapshot：结算前会员余额快照
- accessLogs：进出记录
- timeCalculation：时间计算过程
- hoursCalculation：时长计算
- corrections（重试时）：修正记录

## 四、修正后重跑流程

**步骤1：识别问题**
1. 在"结算记录"页面找到状态为 `needs_review` 或 `failed` 的记录
2. 点击"详情"按钮查看详细
3. 检查 `verification_data` 中的问题定位

**步骤2：补充数据**
1. 点击"重新结算"按钮
2. 补充缺失的签到/签出记录

**步骤3：重新执行结算**
1. 系统重新执行结算逻辑
2. 生成新的 `verification_data`
3. 记录到 `settlement_history`

## 五、使用说明

### 安装依赖

```bash
# 安装依赖
npm install

# 启动开发模式
npm start

# 打包应用
npm run build
npm run electron-pack
```

### 数据持久化

数据存储在用户数据目录：
- macOS: `~/Library/Application Support/shared-piano-room-settlement/piano_room.db`
- 重启应用后数据自动恢复

## 六、边界测试场景

### 场景A：正常续时
- 创建2小时预约 → 签到 → 续时1小时 → 签出 → 结算
- 预期：生成两条关联预约，总时长正确扣减

### 场景B：超时结算
- 创建2小时预约 → 签到 → 3小时后签出（超时1小时）
- 预期：实际时长>预约时长，套餐扣减=实际时长

### 场景C：超时且余额不足
- 套餐剩余仅1小时 → 预约2小时 → 实际使用3小时
- 预期：套餐扣减1小时，现金支付（超时-可用）×60元

## 七、输出速查表

| 状态 | success | 含义 | 人工处理 |
|------|---------|------|----------|
| success | true | 正常完成 | ❌ 不需要 |
| partial_cash | true | 部分现金 | ⚠️ 确认收款 |
| needs_review | false | 数据不全 | ✅ 必须介入 |
| failed | false | 结算失败 | ✅ 必须介入 |

## 八、核心文件结构

```
├── electron/
│   ├── main.js              # Electron 主进程
│   ├── preload.js           # 预加载脚本
│   ├── database.js          # SQLite 数据库
│   └── settlementEngine.js  # 结算核心引擎
├── src/
│   ├── App.js               # React 主组件
│   ├── index.js             # 入口文件
│   └── index.css            # 样式
├── public/
│   └── index.html           # HTML模板
├── package.json
└── SETTLEMENT_ACCEPTANCE.md # 本文档
```
