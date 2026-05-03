# 夜市对账工具 (Night Market Reconciler)

一个本地命令行工具，帮助夜市摊位或周末快闪摊的人收摊后把账对清楚。

## 功能特性

- ✅ **数据验证**：检查字段缺失、重复订单、收款金额对不上、库存扣成负数、退货没对应原订单、营业时间跨天等问题
- 💰 **对账计算**：输出每天、每个摊位、每个商品的收入、成本、损耗、退货、手续费、摊位费和净利润
- 📊 **对比分析**：对比两晚或两个摊位的利润差异
- 📄 **多格式导出**：支持 Markdown、CSV、JSON 报告格式
- ⚙️ **灵活配置**：可配置平台手续费、摊位费、税费、损耗预警阈值和跨天营业截止时间

## 快速开始

### 安装依赖

```bash
npm install
```

### 构建项目

```bash
npm run build
```

### 运行测试

```bash
npm test
```

## 目录结构

```
.
├── data/
│   ├── normal/          # 正常示例数据
│   │   ├── sales.csv      # 销售记录
│   │   ├── payments.csv   # 收款记录
│   │   ├── inventory.json # 库存信息
│   │   ├── fees.csv       # 费用记录
│   │   └── returns.csv    # 退货记录
│   └── abnormal/        # 异常示例数据（用于测试验证功能）
├── src/
│   ├── types.ts         # 类型定义
│   ├── config.ts        # 配置模块
│   ├── utils.ts         # 工具函数
│   ├── data-loader.ts   # 数据加载器
│   ├── validator.ts     # 数据验证器
│   ├── reconciler.ts    # 对账核心
│   ├── comparer.ts      # 对比分析
│   ├── exporter.ts      # 报告导出
│   └── index.ts         # CLI 入口
├── tests/               # 测试用例
├── dist/                # 编译输出
├── nm-reconciler.json   # 配置文件
├── package.json
└── tsconfig.json
```

## 数据文件格式

### 1. sales.csv - 销售记录

| 字段 | 说明 | 示例 |
|------|------|------|
| orderId | 订单号 | ORD-2024-001 |
| timestamp | 交易时间 | 2024-05-01 18:30:00 |
| date | 营业日期 | 2024-05-01 |
| stallId | 摊位ID | stall-001 |
| stallName | 摊位名称 | 主摊位 |
| productId | 商品ID | PRD-001 |
| productName | 商品名称 | 珍珠奶茶 |
| quantity | 销售数量 | 2 |
| unitPrice | 单价 | 15 |
| totalAmount | 总金额 | 30 |
| paymentMethod | 支付方式 | wechat / alipay / cash / other |
| paymentId | 收款ID | PAY-001 (现金可空) |
| notes | 备注 | |

### 2. payments.csv - 收款记录

| 字段 | 说明 | 示例 |
|------|------|------|
| paymentId | 收款ID | PAY-001 |
| orderId | 关联订单号 | ORD-2024-001 |
| timestamp | 收款时间 | 2024-05-01 18:30:00 |
| date | 日期 | 2024-05-01 |
| stallId | 摊位ID | stall-001 |
| amount | 金额 | 30 |
| method | 支付方式 | wechat / alipay / cash |
| status | 状态 | success / pending / failed / refunded |
| fee | 手续费 | 0.18 (可选) |
| notes | 备注 | |

### 3. inventory.json - 库存信息

```json
{
  "items": [
    {
      "productId": "PRD-001",
      "productName": "珍珠奶茶",
      "category": "饮品",
      "unitCost": 5,
      "unitPrice": 15,
      "initialStock": 100,
      "currentStock": 80,
      "minStock": 20,
      "unit": "杯",
      "supplier": "奶茶原料供应商",
      "lastRestockDate": "2024-04-28"
    }
  ],
  "records": [
    {
      "recordId": "REC-001",
      "type": "damage",
      "productId": "PRD-003",
      "quantity": 2,
      "unitCost": 8,
      "totalCost": 16,
      "reason": "机器故障导致冰沙融化"
    }
  ]
}
```

### 4. fees.csv - 费用记录

| 字段 | 说明 | 示例 |
|------|------|------|
| feeId | 费用ID | FEE-001 |
| date | 日期 | 2024-05-01 |
| stallId | 摊位ID | stall-001 |
| stallName | 摊位名称 | 主摊位 |
| type | 费用类型 | rental / utility / cleaning / marketing / other |
| amount | 金额 | 500 |
| description | 描述 | 摊位租金 |
| paidBy | 支付人 | 张三 |
| paymentMethod | 支付方式 | 微信 |
| notes | 备注 | |

### 5. returns.csv - 退货记录

| 字段 | 说明 | 示例 |
|------|------|------|
| returnId | 退货ID | RET-001 |
| timestamp | 时间 | 2024-05-01 21:15:00 |
| date | 日期 | 2024-05-01 |
| stallId | 摊位ID | stall-001 |
| originalOrderId | 原订单号 | ORD-2024-006 |
| productId | 商品ID | PRD-002 |
| productName | 商品名称 | 手打柠檬茶 |
| quantity | 退货数量 | 1 |
| refundAmount | 退款金额 | 18 |
| reason | 退货原因 | 太酸了 |
| paymentMethod | 退款方式 | wechat |
| refundId | 退款ID | REF-001 |
| notes | 备注 | 顾客要求退款 |

## 配置文件 (nm-reconciler.json)

```json
{
  "stallIds": ["stall-001", "stall-002"],
  "stallNames": {
    "stall-001": "主摊位",
    "stall-002": "副摊位"
  },
  
  "fees": {
    "defaultRentalFee": 500,
    "utilityFeePerDay": 50,
    "cleaningFeePerDay": 30,
    "marketingFeePerDay": 20
  },
  
  "platformFees": {
    "wechat": 0.006,
    "alipay": 0.006,
    "cash": 0,
    "other": 0
  },
  
  "taxes": {
    "rate": 0.03,
    "threshold": 100000,
    "enabled": false
  },
  
  "inventory": {
    "damageWarningThreshold": 0.05,
    "negativeStockWarning": true,
    "autoAdjust": false
  },
  
  "businessHours": {
    "crossDayCutoff": "06:00",
    "startHour": 18,
    "endHour": 2
  },
  
  "currency": {
    "symbol": "¥",
    "decimalPlaces": 2
  }
}
```

### 配置说明

| 配置项 | 说明 |
|--------|------|
| `fees.defaultRentalFee` | 默认摊位费（当费用记录缺失时使用） |
| `platformFees` | 各支付平台手续费率（微信/支付宝默认 0.6%） |
| `businessHours.crossDayCutoff` | 跨天截止时间（如 06:00 表示凌晨6点前的交易归为前一天） |
| `taxes.enabled` | 是否启用税费计算 |

## 使用命令

### 1. 验证数据

```bash
# 使用默认数据目录
npm run start -- validate

# 指定数据目录
npm run start -- validate -i ./data/normal

# 同时导出验证报告
npm run start -- validate -i ./data/normal -o ./reports
```

### 2. 对账计算

```bash
# 基本对账
npm run start -- reconcile -i ./data/normal

# 指定日期范围
npm run start -- reconcile -i ./data/normal --start-date 2024-05-01 --end-date 2024-05-02

# 导出报告
npm run start -- reconcile -i ./data/normal -o ./reports --format markdown

# 包含所有详细信息
npm run start -- reconcile -i ./data/normal --all-details
```

### 3. 对比分析

```bash
# 对比两个时段
npm run start -- compare \
  --base-start 2024-05-01 --base-end 2024-05-01 \
  --compare-start 2024-05-02 --compare-end 2024-05-02

# 对比两个摊位
npm run start -- compare \
  --base-start 2024-05-01 --base-end 2024-05-02 --base-stall stall-001 \
  --compare-start 2024-05-01 --compare-end 2024-05-02 --compare-stall stall-002
```

### 4. 导出报告

```bash
# 导出对账报告
npm run start -- export -i ./data/normal -o ./reports --type reconciliation --format markdown

# 导出验证报告
npm run start -- export -i ./data/abnormal -o ./reports --type validation --format json
```

### 5. 完整流程（推荐）

```bash
# 一键运行：验证 -> 对账 -> 导出
npm run start -- run-all -i ./data/normal -o ./reports
```

## 完整命令链示例

### 场景1：正常对账流程

```bash
# 1. 先验证数据
npm run start -- validate -i ./data/normal

# 2. 计算利润
npm run start -- reconcile -i ./data/normal

# 3. 导出报告
npm run start -- export -i ./data/normal -o ./reports --format markdown
```

### 场景2：发现异常并处理

```bash
# 1. 验证异常数据
npm run start -- validate -i ./data/abnormal

# 2. 查看问题详情
# （根据验证报告修正数据）

# 3. 重新验证
npm run start -- validate -i ./data/normal

# 4. 对账并导出
npm run start -- run-all -i ./data/normal -o ./reports
```

### 场景3：对比分析

```bash
# 对比 5月1日 和 5月2日 的业绩
npm run start -- compare \
  -i ./data/normal \
  --base-start 2024-05-01 --base-end 2024-05-01 \
  --compare-start 2024-05-02 --compare-end 2024-05-02 \
  -o ./reports --format markdown
```

## 验证功能说明

### 检查项

| 检查类型 | 说明 | 影响利润 |
|----------|------|----------|
| `missing_field` | 缺少必填字段 | 无法正确计算收入/成本 |
| `duplicate_order` | 重复订单 | 虚高利润 |
| `payment_mismatch` | 收款金额不符 | 实际收入与账面不符 |
| `negative_stock` | 负库存 | 成本计算错误 |
| `return_no_order` | 退货无对应原订单 | 错误退款，减少利润 |
| `cross_day_hours` | 跨天营业时间 | 日期归属可能不准确 |
| `invalid_value` | 无效数值（如负数、零） | 计算错误 |

### 异常示例

`data/abnormal/` 目录包含以下异常场景：

- 重复订单号
- 缺少商品ID
- 销售数量为0
- 收款金额与订单金额不符
- 商品不存在于库存
- 库存不足
- 售价低于成本
- 退货无对应原订单
- 退货数量超过原订单
- 退款金额过高

## 对账计算公式

```
总营收 = 所有销售订单金额之和
总成本 = (销售数量 × 单位成本) 之和
总退款 = 所有退货退款金额之和
总损耗 = 所有损耗记录金额之和
总费用 = 摊位费 + 水电费 + 清洁费 + ...
平台手续费 = (微信/支付宝收款 × 手续费率) 之和
预估税费 = (营收 - 退款 - 阈值) × 税率（如启用）

毛利润 = 总营收 - 总退款 - 总成本
营业利润 = 毛利润 - 总损耗 - 总费用 - 平台手续费
净利润 = 营业利润 - 预估税费
利润率 = 净利润 / 总营收 × 100%
```

## 测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- --testNamePattern "validator"
```

## 开发

```bash
# 编译 TypeScript
npm run build

# 监听模式
npx tsc --watch
```

## 许可证

MIT
