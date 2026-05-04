# 股票模拟交易复盘和风控预警台

一个本地运行的全栈 Web 应用，用于个人或小投研小组练习纸面交易。不接真实券商，不做真实下单，专注于交易复盘和风控预警。

## 功能特性

### 核心功能
- **行情导入**：每日导入 quotes.csv 作为行情快照
- **交易计划**：维护 trade-plan.json 中的交易计划
- **模拟交易**：录入买入、卖出、撤单、部分成交、止损止盈触发等动作
- **持仓计算**：自动计算现金、持仓、市值、浮盈亏、已实现盈亏、最大回撤、单票仓位比例
- **风控预警**：超仓、连续亏损、止损未执行、追高买入等情况预警
- **复盘报告**：导出 Markdown、HTML、CSV 三种格式的复盘报告

### 前端页面
- **总览看板**：交易概览、持仓分析、风险提示
- **自选股/行情导入**：管理自选股、导入行情数据
- **交易计划**：创建和管理交易计划
- **订单流水**：查看订单历史、订单状态流转
- **持仓看板**：持仓详情、仓位分布、盈亏分析
- **风险预警**：预警列表、预警处理、风险检查
- **交易日时间线**：交易日管理、操作时间线
- **复盘笔记**：交易复盘、经验总结
- **报告导出**：生成和导出复盘报告

### 风控规则
| 规则类型 | 触发条件 | 默认阈值 |
|---------|---------|---------|
| 仓位超限 | 总仓位比例 > 阈值 | 80% |
| 连续亏损 | 连续 N 天亏损 | 3 天 |
| 止损未执行 | 跌破止损价未执行 | - |
| 追高买入 | 当日涨幅 > 阈值时买入 | 5% |
| 最大回撤 | 回撤比例 > 阈值 | 10% |
| 单票超配 | 单票仓位 > 阈值 | 30% |

## 技术栈

### 后端
- **Node.js** + **Express** - 服务器框架
- **SQLite** + **Sequelize** - 数据库和 ORM
- **Multer** - 文件上传
- **csv-parser** - CSV 解析
- **dayjs** - 日期处理
- **lodash** - 工具函数

### 前端
- **Vue 3** - 前端框架
- **Element Plus** - UI 组件库
- **Vue Router** - 路由管理
- **Pinia** - 状态管理
- **Axios** - HTTP 客户端
- **ECharts** - 图表可视化
- **dayjs** - 日期处理

## 快速开始

### 环境要求
- Node.js >= 16.0.0
- npm >= 8.0.0

### 安装依赖

```bash
# 安装后端依赖
npm install

# 安装前端依赖
cd client && npm install
```

或者一键安装所有依赖：

```bash
npm run init
```

### 初始化数据库

运行种子数据脚本初始化数据库并填充示例数据：

```bash
npm run seed
```

这将创建一个 SQLite 数据库（默认位于 `data/trading.db`），并填充以下数据：

**正常交易样例：**
- 比亚迪：按计划在 248 元买入 100 股
- 海康威视：按计划在 33 元买入 300 股
- 贵州茅台：按计划在 1690 元买入 10 股
- 紫金矿业：按计划在 15.5 元买入 600 股

**异常交易样例（用于风控测试）：**
- 追高买入：平安银行涨幅 3% 时买入
- 仓位超限：总仓位一度达到 92%
- 连续亏损：连续 2 个交易日亏损
- 止损未执行：中兴通讯跌破止损价未执行
- 最大回撤：账户回撤达到 8.5%
- 单票超配：比亚迪仓位接近上限

### 启动应用

**方式一：分别启动后端和前端**

```bash
# 启动后端服务器（端口 3000）
npm run dev

# 新终端：启动前端开发服务器（端口 5173）
npm run client
```

**方式二：一键启动（推荐）**

```bash
npm run dev-all
```

启动后访问：
- 前端：http://localhost:5173
- 后端 API：http://localhost:3000/api

## 使用指南

### 1. 导入行情数据

在「自选股/行情导入」页面：

1. 选择要导入的交易日
2. 点击「导入行情」按钮
3. 选择 CSV 格式的行情文件

**quotes.csv 格式要求：**
```csv
symbol,name,open,high,low,close,volume,change_percent
000001,平安银行,11.25,11.50,11.20,11.42,8560000,1.51
000002,万科A,8.50,8.65,8.42,8.58,12300000,0.94
```

字段说明：
- `symbol`: 股票代码（必填）
- `name`: 股票名称
- `open`: 开盘价
- `high`: 最高价
- `low`: 最低价
- `close`: 收盘价/现价
- `volume`: 成交量
- `change_percent`: 涨跌幅（百分比，如 1.51 表示 1.51%）

样例文件：`data/sample-quotes.csv`

### 2. 导入交易计划

在「交易计划」页面：

1. 选择交易日
2. 点击「导入计划」按钮
3. 选择 JSON 格式的交易计划文件

**trade-plan.json 格式要求：**
```json
[
  {
    "symbol": "002594",
    "name": "比亚迪",
    "plan_type": "long",
    "direction": "buy",
    "entry_price_min": 245.00,
    "entry_price_max": 250.00,
    "stop_loss_price": 235.00,
    "target_price": 280.00,
    "planned_quantity": 100,
    "status": "pending",
    "reason": "新能源板块反弹，技术形态走好",
    "risk_reward_ratio": 3.50
  }
]
```

字段说明：
- `symbol`: 股票代码（必填）
- `name`: 股票名称
- `plan_type`: 计划类型（long/short）
- `direction`: 方向（buy/sell）
- `entry_price_min/max`: 买入价格区间
- `stop_loss_price`: 止损价
- `target_price`: 目标价
- `planned_quantity`: 计划数量
- `reason`: 买入理由
- `risk_reward_ratio`: 风险收益比

样例文件：`data/sample-trade-plan.json`

### 3. 模拟交易

在「订单流水」页面：

1. 点击「新建订单」
2. 选择方向（买入/卖出）
3. 输入股票代码、价格、数量
4. 选择订单类型（限价单/市价单）
5. 提交订单

**订单状态流转：**
```
pending（待提交）→ submitted（已提交）→ partially_filled（部分成交）→ filled（已成交）
                                                  ↓
                                            cancelled（已撤单）
                                                  ↓
                                            rejected（已拒绝）
                                                  ↓
                                            expired（已过期）
```

**支持的操作：**
- 买入/卖出
- 撤单
- 部分成交
- 止损止盈触发

### 4. 风险检查

在「风险预警」页面：

1. 选择交易日
2. 点击「风险检查」按钮
3. 查看触发的预警
4. 处理预警（确认/解决/忽略）

**预警处理流程：**
1. 系统自动检测或手动触发风险检查
2. 生成风险预警记录
3. 用户确认预警（acknowledge）
4. 用户处理预警（resolve），填写处理说明

### 5. 导出复盘报告

在「报告导出」页面：

1. 选择导出选项：
   - 交易日/日期范围
   - 报告包含的内容
   - 导出格式（Markdown/HTML/CSV）

2. 点击「预览报告」查看效果
3. 点击「导出报告」下载文件

**报告包含内容：**
- 交易概览：当日交易统计、盈亏汇总
- 持仓变化：持仓明细、仓位分布
- 风险命中：触发的风险预警列表
- 盈亏归因：各标的盈亏分析
- 复盘订单：需要复盘的订单列表
- 复盘笔记：用户记录的复盘内容

## 项目结构

```
stock-sim-trader/
├── client/                    # 前端项目
│   ├── src/
│   │   ├── api/              # API 封装
│   │   ├── assets/           # 静态资源
│   │   ├── router/           # 路由配置
│   │   ├── stores/           # 状态管理
│   │   ├── views/            # 页面组件
│   │   ├── App.vue           # 根组件
│   │   └── main.js           # 入口文件
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── config/                    # 配置文件
│   └── database.js           # 数据库配置
├── controllers/               # 控制器
│   ├── ExportController.js
│   ├── ImportController.js
│   ├── PositionController.js
│   ├── ReviewNoteController.js
│   ├── RiskController.js
│   ├── TradingController.js
│   ├── TradingDayController.js
│   └── WatchlistController.js
├── data/                      # 数据文件
│   ├── sample-quotes.csv     # 样例行行情
│   └── sample-trade-plan.json # 样例交易计划
├── models/                    # 数据模型
│   ├── CashAccount.js
│   ├── Order.js
│   ├── Position.js
│   ├── Quote.js
│   ├── ReviewNote.js
│   ├── RiskAlert.js
│   ├── TradeHistory.js
│   ├── TradePlan.js
│   ├── TradingDay.js
│   ├── Watchlist.js
│   └── index.js              # 模型关联
├── routes/                    # 路由配置
│   └── index.js
├── seeders/                   # 种子数据
│   └── seedData.js           # 数据填充脚本
├── services/                  # 业务逻辑
│   ├── ExportService.js
│   ├── ImportService.js
│   ├── OrderService.js
│   ├── PositionService.js
│   ├── RiskService.js
│   ├── TradingDayService.js
│   └── TradingService.js
├── server.js                  # 服务器入口
├── package.json
└── README.md
```

## API 接口

### 交易日管理
- `GET /api/trading-days` - 获取交易日列表
- `GET /api/trading-days/:id` - 获取交易日详情
- `POST /api/trading-days` - 创建交易日
- `PUT /api/trading-days/:id/open` - 开盘
- `PUT /api/trading-days/:id/close` - 收盘
- `PUT /api/trading-days/:id/review` - 标记复盘

### 交易管理
- `GET /api/orders` - 获取订单列表
- `GET /api/orders/:id` - 获取订单详情
- `POST /api/orders` - 创建订单
- `POST /api/orders/:id/submit` - 提交订单
- `POST /api/orders/:id/fill` - 成交订单
- `POST /api/orders/:id/cancel` - 撤单

### 持仓管理
- `GET /api/positions` - 获取持仓列表
- `GET /api/positions/:symbol` - 获取单只股票持仓
- `GET /api/positions/summary` - 获取持仓汇总

### 风控管理
- `GET /api/risk/alerts` - 获取预警列表
- `POST /api/risk/checks` - 运行风险检查
- `PUT /api/risk/alerts/:id/acknowledge` - 确认预警
- `PUT /api/risk/alerts/:id/resolve` - 解决预警

### 数据导入
- `POST /api/import/quotes` - 导入行情数据
- `POST /api/import/trade-plans` - 导入交易计划

### 报告导出
- `GET /api/export/preview` - 预览报告
- `GET /api/export` - 导出报告
- `GET /api/export/stats` - 获取统计数据

### 复盘笔记
- `GET /api/review-notes` - 获取笔记列表
- `GET /api/review-notes/:id` - 获取笔记详情
- `POST /api/review-notes` - 创建笔记
- `PUT /api/review-notes/:id` - 更新笔记
- `DELETE /api/review-notes/:id` - 删除笔记

### 自选股
- `GET /api/watchlist` - 获取自选股列表
- `POST /api/watchlist` - 添加自选股
- `DELETE /api/watchlist/:symbol` - 移除自选股

## 运行测试

### 运行所有测试

```bash
npm test
```

### 测试说明

测试文件位于 `tests/` 目录下，包含：

- `unit/` - 单元测试
  - `OrderService.test.js` - 订单服务测试
  - `PositionService.test.js` - 持仓计算测试
  - `RiskService.test.js` - 风控规则测试
- `integration/` - 集成测试
  - `api.test.js` - API 接口测试

### 测试覆盖的场景

**正常交易测试：**
- 限价单买入/卖出
- 市价单成交
- 部分成交
- 撤单操作
- 止损止盈触发

**风控规则测试：**
- 仓位超限检测
- 连续亏损检测
- 止损未执行检测
- 追高买入检测
- 最大回撤检测
- 单票超配检测

**数据导入测试：**
- CSV 行情数据导入
- JSON 交易计划导入

**报告导出测试：**
- Markdown 格式导出
- HTML 格式导出
- CSV 格式导出

## 交易费用说明

系统采用国内 A 股交易费用标准：

| 费用类型 | 费率 | 最低收费 | 适用方向 |
|---------|------|---------|---------|
| 佣金 | 0.03% | 5 元 | 买入/卖出 |
| 印花税 | 0.1% | - | 仅卖出 |
| 过户费 | 0.001% | - | 买入/卖出 |

**示例计算：**

买入 1000 股，价格 10 元：
- 成交金额：10000 元
- 佣金：10000 × 0.03% = 3 元 → 按最低 5 元收取
- 过户费：10000 × 0.001% = 0.1 元
- 总费用：5 + 0.1 = 5.1 元
- 实际支出：10000 + 5.1 = 10005.1 元

卖出 1000 股，价格 11 元：
- 成交金额：11000 元
- 佣金：11000 × 0.03% = 3.3 元 → 按最低 5 元收取
- 印花税：11000 × 0.1% = 11 元
- 过户费：11000 × 0.001% = 0.11 元
- 总费用：5 + 11 + 0.11 = 16.11 元
- 实际收入：11000 - 16.11 = 10983.89 元

## 常见问题

### Q1: 数据库文件在哪里？

默认位置：`data/trading.db`

如需修改路径，可以设置环境变量：
```bash
export DB_PATH=/custom/path/trading.db
```

### Q2: 如何重置数据库？

运行种子数据脚本会重置数据库（注意：这会删除所有现有数据）：

```bash
npm run seed
```

### Q3: 支持做空吗？

目前系统主要支持做多（买入-卖出）。做空（融券卖出）功能可以根据需要扩展。

### Q4: 如何修改风控阈值？

风控阈值定义在 `services/RiskService.js` 中，可以根据需要修改：

```javascript
// 默认风控阈值
const DEFAULT_RULES = {
  max_position_ratio: 0.8,      // 最大仓位比例 80%
  max_continuous_loss_days: 3,   // 最大连续亏损天数
  max_drawdown: -0.1,            // 最大回撤 -10%
  max_single_stock_ratio: 0.3,   // 单票最大仓位 30%
  chase_high_threshold: 0.05      // 追高买入阈值 5%
};
```

### Q5: 支持 T+1 吗？

系统目前不限制 T+0 或 T+1，可以根据需要在持仓计算中加入卖出限制。

## 开发说明

### 添加新的风控规则

1. 在 `services/RiskService.js` 中添加检查方法
2. 在 `RiskAlert.js` 模型中添加预警类型枚举
3. 在前端 `Risk.vue` 中添加预警类型映射

### 扩展报告内容

1. 在 `services/ExportService.js` 中添加新的报告区块
2. 更新报告格式生成逻辑

### 添加新的页面

1. 在 `client/src/views/` 创建新的 Vue 组件
2. 在 `client/src/router/index.js` 中添加路由配置
3. 在 `client/src/App.vue` 中添加菜单项

## 更新日志

### v1.0.0 (2024-01-17)

- 初始版本发布
- 实现核心交易功能
- 实现风控预警系统
- 实现复盘报告导出
- 提供种子数据和样例

## 许可证

MIT License

## 联系方式

如有问题或建议，请提交 Issue 或 PR。
