# 理财收益到账核对台

一个本地可运行的全栈 Web 应用，用于管理家庭多人购买理财产品时的收益核对问题。

## 功能特点

- 📦 **产品管理**：维护理财产品、账户、持有人、认购份额和收益规则
- 📥 **数据导入**：支持导入 products.csv、transactions.csv、payout-rules.json
- 💰 **收益计算**：根据起息日、到期日、年化收益率、持有天数、管理费/赎回费规则自动生成应到账计划
- 🔗 **流水匹配**：将实际银行流水与应到账计划进行匹配，标记未到账、少到账、多到账、提前赎回、费用扣减等差异
- 📋 **核对看板**：支持按账户、产品、持有人和状态筛选，查看差异详情
- 👥 **份额分摊**：多人合买时，按份额比例分摊收益、管理费、赎回费和差额
- 📤 **多格式导出**：支持 Markdown、HTML、CSV 三种格式导出
- 🗄️ **本地持久化**：使用 SQLite 本地数据库，数据不上传服务器

## 技术栈

### 后端
- Node.js + Express
- SQLite (better-sqlite3)
- Papa Parse (CSV 解析)
- Day.js (日期处理)

### 前端
- React + Vite
- Tailwind CSS
- React Query (状态管理)
- Axios (HTTP 客户端)

## 快速开始

### 环境要求
- Node.js >= 16.0.0
- npm 或 yarn

### 安装依赖

```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 初始化数据

```bash
cd backend

# 初始化数据库并加载种子数据
npm run seed
```

种子数据包含：
- 6 个理财产品（银行理财、货币基金、券商现金管理）
- 8 条交易流水
- 12 条认购记录（支持多人合买）
- 6 条收益规则
- 自动计算应到账计划、匹配流水、生成分摊记录

### 启动服务

```bash
# 启动后端服务 (端口 3001)
cd backend
npm run dev

# 新终端：启动前端开发服务器 (端口 5173)
cd frontend
npm run dev
```

然后打开浏览器访问：http://localhost:5173

## 项目结构

```
zy1128/
├── backend/                    # 后端服务
│   ├── src/
│   │   ├── config/            # 配置文件
│   │   │   └── database.js    # SQLite 数据库配置
│   │   ├── models/            # 数据模型
│   │   │   ├── productModel.js
│   │   │   ├── transactionModel.js
│   │   │   ├── subscriptionModel.js
│   │   │   ├── expectedPayoutModel.js
│   │   │   ├── reconciliationModel.js
│   │   │   ├── allocationModel.js
│   │   │   ├── accountModel.js
│   │   │   ├── holderModel.js
│   │   │   └── payoutRuleModel.js
│   │   ├── routes/            # API 路由
│   │   │   └── api.js
│   │   ├── services/          # 业务逻辑
│   │   │   ├── importService.js      # 数据导入
│   │   │   ├── calculationService.js # 收益计算
│   │   │   ├── matchingService.js    # 流水匹配
│   │   │   ├── allocationService.js  # 份额分摊
│   │   │   └── exportService.js      # 数据导出
│   │   ├── utils/             # 工具函数
│   │   │   ├── validators.js         # 数据验证
│   │   │   ├── dateUtils.js          # 日期处理
│   │   │   └── calculationUtils.js   # 计算工具
│   │   ├── scripts/           # 脚本
│   │   │   ├── init-db.js     # 数据库初始化
│   │   │   └── seed.js        # 种子数据加载
│   │   ├── tests/             # 测试
│   │   │   └── validators.test.js
│   │   └── server.js          # Express 服务器入口
│   ├── data/                   # 数据文件
│   │   ├── seed/              # 种子数据
│   │   │   ├── products.csv
│   │   │   ├── transactions.csv
│   │   │   ├── subscriptions.csv
│   │   │   └── payout-rules.json
│   │   └── examples/          # 样例数据
│   │       ├── invalid-products.csv
│   │       ├── invalid-transactions.csv
│   │       └── invalid-subscriptions.csv
│   └── package.json
├── frontend/                   # 前端应用
│   ├── src/
│   │   ├── pages/             # 页面组件
│   │   │   ├── Dashboard.jsx      # 仪表板
│   │   │   ├── Reconciliations.jsx # 核对看板
│   │   │   ├── Import.jsx          # 数据导入
│   │   │   ├── Export.jsx          # 导出报告
│   │   │   ├── Holders.jsx         # 持有人
│   │   │   └── Settings.jsx        # 设置
│   │   ├── services/          # API 服务
│   │   │   └── api.js
│   │   ├── utils/             # 工具函数
│   │   │   └── format.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
└── README.md
```

## 使用流程

### 1. 数据导入

在「数据导入」页面导入以下文件：

#### products.csv - 产品数据
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| product_code | 字符串 | 是 | 产品代码，唯一标识 |
| product_name | 字符串 | 是 | 产品名称 |
| product_type | 枚举 | 是 | 产品类型: bank_wealth, money_market, broker_cash |
| annual_return_rate | 小数 | 是 | 年化收益率，如 0.035 表示 3.5% |
| management_fee_rate | 小数 | 否 | 管理费率 |
| redemption_fee_rate | 小数 | 否 | 赎回费率 |
| day_count_convention | 枚举 | 否 | 计息方式: actual/360, actual/365, 30/360 |
| payout_frequency | 枚举 | 否 | 付息频率: at_maturity, daily, monthly, quarterly |

#### transactions.csv - 交易流水
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| transaction_date | 日期 | 是 | 交易日期，支持多种格式 |
| transaction_amount | 金额 | 是 | 交易金额 |
| description | 字符串 | 否 | 交易描述 |
| account_name | 字符串 | 否 | 账户名称 |
| transaction_type | 枚举 | 否 | 交易类型 |

#### subscriptions.csv - 认购份额
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| product_code | 字符串 | 是 | 产品代码 |
| holder_name | 字符串 | 是 | 持有人名称 |
| share_amount | 金额 | 是 | 认购份额 |
| share_ratio | 小数 | 否 | 分摊比例，如 0.5 表示 50% |
| start_date | 日期 | 否 | 起息日 |
| maturity_date | 日期 | 否 | 到期日 |
| account_name | 字符串 | 否 | 账户名称 |

#### payout-rules.json - 收益规则
```json
{
  "rules": [
    {
      "product_code": "BW001",
      "day_count_convention": "actual/365",
      "payout_frequency": "at_maturity",
      "management_fee_rate": 0.003,
      "redemption_fee_rate": 0.001
    }
  ]
}
```

### 2. 计算应到账计划

在「仪表板」页面点击「计算应到账计划」，系统会根据：
- 认购份额
- 起息日和到期日
- 年化收益率
- 管理费率和赎回费率
- 计息方式（actual/360、actual/365、30/360）

自动计算每条认购记录的预期收益。

### 3. 匹配银行流水

点击「自动匹配流水」，系统会按以下规则匹配：
- 金额完全一致
- 日期在合理范围内

如果自动匹配失败，可以在「核对看板」中手工匹配。

### 4. 生成分摊记录

点击「生成分摊记录」，系统会按份额比例自动分摊：
- 本金
- 利息
- 管理费
- 赎回费
- 差额（少到账/多到账）

### 5. 核对看板

在「核对看板」页面可以：
- 按账户、产品、持有人、状态筛选
- 查看每条记录的详情（应到账金额、实际到账金额、计算过程、分摊明细）
- 手工匹配未匹配的流水
- 添加手工调整说明
- 导出报告

### 6. 导出报告

在「导出报告」页面可以：
- 导出核对报告（CSV/HTML/Markdown）
- 导出持有人分摊明细（CSV/HTML/Markdown）

## 状态说明

| 状态 | 说明 |
|------|------|
| ✅ 已匹配 | 应到账金额与实际到账金额完全一致 |
| ❌ 未到账 | 未找到对应的交易流水 |
| ⚠️ 少到账 | 实际到账金额少于应到账金额 |
| 📈 多到账 | 实际到账金额多于应到账金额 |
| ⏳ 待处理 | 等待确认或处理 |
| 📝 手工调整 | 已添加手工调整说明 |

## 异常处理

系统会自动检测以下异常情况：

### 数据导入时
- 日期格式错误（支持多种格式自动解析）
- 必填字段缺失
- 金额格式错误
- 枚举值无效

### 分摊比例验证
- 同一产品的所有持有人分摊比例合计必须为 100%（允许 1% 以内的误差）

### 流水匹配
- 金额无法匹配时标记为「未到账」
- 金额有差异时标记为「少到账」或「多到账」

## 测试

### 运行验证器测试

```bash
cd backend
node src/tests/validators.test.js
```

### 使用异常样例测试

在 `backend/data/examples/` 目录下提供了异常样例数据：
- `invalid-products.csv` - 包含缺失字段、无效类型、无效金额
- `invalid-transactions.csv` - 包含无效日期、无效金额
- `invalid-subscriptions.csv` - 包含分摊比例合计超过 100%、负比例

可以在「数据导入」页面导入这些文件，测试系统的错误处理能力。

## 数据库设计

### 核心表

| 表名 | 说明 |
|------|------|
| products | 理财产品 |
| accounts | 账户（银行卡、支付宝、微信等） |
| holders | 持有人（家庭成员） |
| subscriptions | 认购份额 |
| payout_rules | 收益规则 |
| expected_payouts | 应到账计划 |
| transactions | 实际交易流水 |
| reconciliations | 核对记录 |
| allocations | 分摊记录 |

### 关联关系

```
products 1:N subscriptions
subscriptions 1:N expected_payouts
expected_payouts 1:1 reconciliations
transactions 1:1 reconciliations
reconciliations 1:N allocations
holders 1:N subscriptions
accounts 1:N transactions
```

## 常见问题

### Q: 数据存储在哪里？
A: 所有数据存储在本地 SQLite 数据库文件中：`backend/data/finance.db`，不会上传到任何服务器。

### Q: 如何添加新的持有人？
A: 在导入 `subscriptions.csv` 时，如果持有人名称不存在，系统会自动创建新的持有人。

### Q: 分摊比例如何计算？
A: 如果 `subscriptions.csv` 中没有指定 `share_ratio`，系统会根据 `share_amount` 自动计算比例。比例合计必须为 100%（允许 1% 误差）。

### Q: 支持哪些计息方式？
A: 支持三种计息方式：
- `actual/360`：实际天数 / 360
- `actual/365`：实际天数 / 365
- `30/360`：每月 30 天 / 360

### Q: 如何重置数据库？
A: 删除 `backend/data/finance.db` 文件，然后重新运行 `npm run seed`。

## 许可证

MIT License
