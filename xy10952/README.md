# 社群订单分账 CLI 工具

一个功能完善的社群团购订单分账命令行工具，支持订单合并、退款冲抵、佣金阶梯计算、重复订单去重，并可生成多种格式的分账报告。

## 功能特性

- ✅ **参数解析**: 灵活的命令行参数配置
- ✅ **输入校验**: 完整的数据校验和错误提示
- ✅ **订单合并**: 按团长合并计算订单
- ✅ **退款冲抵**: 自动计算退款并冲抵订单金额
- ✅ **佣金阶梯**: 支持按销售额阶梯计算佣金比例
- ✅ **重复去重**: 自动识别并标记重复订单
- ✅ **多格式输出**: 终端摘要、JSON、CSV、Markdown报告
- ✅ **异常保留**: 坏行和异常样本保留原始行号位置
- ✅ **文件冲突处理**: 支持覆盖和追加模式

## 快速开始（零依赖！）

### 方式一：直接运行核心 CLI（推荐）

**核心 CLI 入口已完全零依赖，可以直接运行：

```bash
# 查看帮助
node src/index.js --help

# 查看版本
node src/index.js --version

# 基本运行
node src/index.js

# 强制覆盖输出
node src/index.js --force

# 自定义输入输出路径
node src/index.js --orders ./data/orders.csv --output ./output

# 追加模式
node src/index.js --append
```

这将直接运行分账工具，输出：
- 终端分账汇总报告
- JSON 汇总数据
- CSV 格式的订单明细、团长佣金、退款冲抵
- 异常数据记录
- Markdown 格式报告

**无需安装任何依赖！**

### 方式二：运行核心逻辑测试

验证金额校验等核心逻辑：

```bash
node test-simple.mjs
```

## 可选：npm 安装使用

项目也支持通过 npm 安装使用（可选，不影响核心功能）：

```bash
npm install

# 通过 npm start 运行
npm start -- --force
```

## 使用方法

### 基本用法

```bash
npm start
```

或使用完整参数：

```bash
node src/index.js --orders ./data/orders.csv --leaders ./data/leaders.csv --refunds ./data/refunds.csv --commission ./data/commission.json --output ./output
```

### 命令行参数

| 参数 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--orders` | `-o` | 订单数据文件路径 (CSV/JSON) | `./data/orders.csv` |
| `--leaders` | `-l` | 团长数据文件路径 (CSV/JSON) | `./data/leaders.csv` |
| `--refunds` | `-r` | 退款数据文件路径 (CSV/JSON) | `./data/refunds.csv` |
| `--commission` | `-c` | 佣金配置文件路径 (JSON) | `./data/commission.json` |
| `--output` | `-O` | 输出目录 | `./output` |
| `--format` | | 输出格式，逗号分隔: terminal,json,csv,report | `terminal,json,csv,report` |
| `--force` | | 强制模式：覆盖已有报告文件 | - |
| `--append` | | 追加模式：不覆盖已有报告，追加新数据 | - |
| `--quiet` | | 静默模式，仅输出错误和关键信息 | - |

### 示例

#### 1. 基本运行（使用默认配置）

```bash
npm start
```

#### 2. 强制覆盖输出文件

```bash
npm start -- --force
```

#### 3. 追加模式（多次运行合并结果）

```bash
npm start -- --append
```

#### 4. 仅生成 JSON 和 CSV 格式

```bash
npm start -- --format json,csv
```

#### 5. 自定义输入输出路径

```bash
npm start -- --orders ~/my-orders.csv --output ~/my-reports
```

## 输入数据格式

### 1. 订单数据 (orders.csv)

| 字段 | 说明 | 必填 |
|------|------|------|
| 订单ID / orderId | 订单唯一标识 | ✅ |
| 团长ID / leaderId | 团长标识 | ✅ |
| 商品名称 / productName | 商品名称 | - |
| 数量 / quantity | 购买数量 | - |
| 金额 / amount | 订单金额 | ✅ |

### 2. 团长数据 (leaders.csv)

| 字段 | 说明 | 必填 |
|------|------|------|
| 团长ID / leaderId | 团长唯一标识 | ✅ |
| 姓名 / name | 团长姓名 | - |

### 3. 退款数据 (refunds.csv)

| 字段 | 说明 | 必填 |
|------|------|------|
| 订单ID / orderId | 关联订单ID | ✅ |
| 退款金额 / amount | 退款金额 | ✅ |
| 退款原因 / reason | 退款原因说明 | - |

### 4. 佣金配置 (commission.json)

```json
{
  "platformFeeRate": 0.05,
  "commissionTiers": [
    { "minSales": 0, "rate": 0.10 },
    { "minSales": 500, "rate": 0.12 },
    { "minSales": 1000, "rate": 0.15 }
  ]
}
```

## 输出文件说明

工具会在输出目录生成以下文件：

| 文件名 | 说明 |
|--------|------|
| `split-summary.json` | 完整的分账汇总数据（机器可读） |
| `split-details.csv` | 订单明细，包含退款冲抵信息 |
| `leader-commission.csv` | 团长佣金明细 |
| `refund-offsets.csv` | 退款冲抵明细 |
| `errors.json` | 异常数据记录，包含原始行号 |
| `report.md` | 给同事看的 Markdown 格式报告 |

## 核心业务逻辑

### 1. 输入校验与异常处理

- **必填字段校验**：订单ID、团长ID、金额为必填字段
- **缺失金额识别**：金额字段为空、空字符串、null 均标记为"缺少订单/退款金额"错误
- **金额有效性校验**：负数、非数字字符串标记为"金额无效"错误
- **原始位置保留**：所有异常记录保留原始 CSV 行号，方便回溯
- **异常不中断**：单条数据异常不影响整体计算，坏行存入 `errors.json`

### 2. 订单去重

- 按订单ID识别重复订单
- 重复订单标记为异常，保留原始行号
- 只计算唯一订单

### 3. 退款冲抵

- 自动匹配退款订单
- 支持一笔订单多次退款
- 净金额 = 原金额 - 退款金额（最小为0）

### 4. 佣金阶梯计算

- 按团长净销售额匹配佣金档位
- 佣金 = 净销售额 × 佣金比例
- 平台服务费 = 净销售额 × 平台费率
- 实得金额 = 佣金 - 平台服务费

## 项目结构

```
.
├── src/
│   └── index.js          # 核心 CLI 入口（零依赖！直接运行）
├── data/                 # 示例输入数据（包含测试坏行）
│   ├── orders.csv        # 订单数据（含缺失金额、空金额等测试用例）
│   ├── leaders.csv       # 团长数据
│   ├── refunds.csv       # 退款数据
│   └── commission.json   # 佣金配置
├── output/               # 输出目录
├── test-simple.mjs       # 核心逻辑测试（无需依赖）
├── package.json          # 可选 npm 支持
└── README.md
```

## 开发说明

### 技术栈

- Node.js ES Modules
- Commander: 命令行参数解析
- csv-parse/csv-stringify: CSV 读写
- chalk: 终端彩色输出
- cli-table3: 终端表格

### 扩展开发

如需添加新的分账规则，可修改 `src/processor.js` 中的 `processOrders` 函数。

如需添加新的输出格式，可在 `src/reporter.js` 中扩展 `generateReports` 函数。

## 常见问题

### Q: 运行时报错 `ERR_MODULE_NOT_FOUND: Cannot find package 'commander'`？

A: 需要先安装依赖：
```bash
npm install
```
安装完成后再运行 CLI。

### Q: 不安装依赖能验证代码吗？

A: 可以！运行核心校验逻辑的独立测试：
```bash
node test-simple.mjs
```
这将验证金额校验等核心逻辑，无需任何外部依赖。

### Q: 如何处理数据异常？

A: 异常数据（缺少必填字段、金额无效等）会被记录在 `errors.json` 文件中，同时保留原始行号，不会中断正常计算。

**金额相关的异常包括：**
- 金额字段缺失（undefined/null）→ 报错"缺少订单/退款金额"
- 金额字段为空字符串 → 报错"缺少订单/退款金额"
- 金额为负数 → 报错"订单/退款金额无效"
- 金额为非数字字符串 → 报错"订单/退款金额无效"

### Q: 多次运行工具会覆盖之前的报告吗？

A: 默认会检查文件冲突并提示错误。使用 `--force` 强制覆盖，或 `--append` 追加模式。

### Q: 支持中文列名吗？

A: 支持，工具会自动识别中英文列名（如"订单ID"或"orderId"都可以）。

## License

MIT
