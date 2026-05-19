# 团长运营对账系统

处理生鲜缺货后的退款、换货、补券自动对账系统，数据持久化存储，支持重启后数据保留。

## 功能特性

- ✅ **订单CSV导入** - 批量导入订单数据，含数据校验
- ✅ **缺货清单Excel导入** - 导入缺货商品清单
- ✅ **补偿规则JSON配置** - 灵活配置补偿规则
- ✅ **智能数据校验** - 坏数据不吞掉，保留原始位置、失败原因、修改建议
- ✅ **三种补偿方式** - 退款、换货、补券自动判断
- ✅ **状态变更追踪** - 完整的订单状态变更历史
- ✅ **SQLite本地持久化** - 重启服务数据不丢失
- ✅ **复核功能** - 数据概览、错误记录查看
- ✅ **报告导出** - 支持CSV/Excel格式导出

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 一键运行完整测试流程

```bash
npm test
```

这将自动完成：生成样例文件、导入数据、处理补偿、生成错误记录、导出报告。

### 3. 分步操作

#### 导入数据

```bash
# 导入订单CSV
npm run import -- --orders data/samples/orders.csv

# 导入缺货清单
npm run import -- --out-of-stock data/samples/out_of_stock.xlsx

# 导入补偿规则
npm run import -- --rules data/samples/compensation_rules.json
```

#### 处理缺货补偿

```bash
npm run process
```

#### 复核数据

```bash
# 查看数据概览
npm run review

# 查看错误记录
npm run review -- --errors
```

#### 导出报告

```bash
# 导出补偿报告(CSV)
npm run export -- --report exports/report.csv

# 导出补偿报告(Excel)
npm run export -- --report-xlsx exports/report.xlsx

# 导出错误记录
npm run export -- --errors exports/errors.csv

# 导出订单数据
npm run export -- --orders exports/orders.csv
```

## 数据格式说明

### 订单CSV格式

| 字段 | 说明 | 示例 |
|------|------|------|
| order_no | 订单号(必填) | DD20240101001 |
| user_id | 用户ID(必填) | U001 |
| user_name | 用户姓名(必填) | 张三 |
| phone | 联系电话 | 13800138001 |
| product_id | 商品ID(必填) | P001 |
| product_name | 商品名称(必填) | 新鲜草莓 |
| quantity | 数量(正整数) | 2 |
| price | 单价(非负数) | 59.9 |

### 缺货清单Excel格式

| 字段 | 说明 |
|------|------|
| product_id | 商品ID(必填) |
| product_name | 商品名称(必填) |
| stock_quantity | 库存数量 |
| affected_orders | 影响订单数 |

### 补偿规则JSON格式

```json
[
  {
    "rule_type": "refund",
    "condition": "total_amount > 100",
    "action": "full_refund",
    "value": 1,
    "description": "订单金额大于100元，全额退款"
  }
]
```

## 补偿规则说明

系统根据订单金额自动判断补偿方式：

- **退款**：订单金额 > 100元 → 全额退款
- **补券**：50元 < 订单金额 ≤ 100元 → 补偿10%优惠券（最高20元）
- **换货**：订单金额 ≤ 50元 → 换货处理

## 项目结构

```
.
├── src/
│   ├── database.js      # 数据库初始化
│   ├── importer.js      # 数据导入和校验
│   ├── processor.js     # 业务处理逻辑
│   ├── exporter.js      # 报告导出
│   ├── cli.js           # 命令行入口
│   └── index.js         # 主入口
├── models/
│   ├── Order.js
│   ├── OutOfStockItem.js
│   ├── CompensationRule.js
│   ├── ProcessingResult.js
│   └── ImportError.js
├── data/
│   ├── samples/         # 样例数据文件
│   └── database.db      # SQLite数据库文件(自动生成)
├── exports/             # 导出文件目录
├── scripts/             # 工具脚本
├── package.json
└── README.md
```

## 数据持久化验证

运行测试流程后：

```bash
npm run review
```

停止程序后重新运行，数据依然存在，证明持久化生效。

## 错误处理机制

系统不会简单丢弃错误数据，而是完整记录：

- **原始位置**：文件名 + 行号
- **失败原因**：具体的校验错误信息
- **修改建议**：针对该错误的修正建议

可通过 `npm run review -- --errors` 查看所有错误记录。
