# 发票红冲材料红票申请预审 CLI

自动化发票红冲预审工具，解决人工审核效率低、标准不统一的问题。

## 功能特性

- ✅ **6项预审规则**：覆盖部分退款、附件、税率、金额、有效期、发票号码
- 📊 **批量处理**：支持批量发票预审，自动统计通过率
- 📁 **多文件输出**：生成可红冲清单、驳回清单、违规明细、汇总报告
- 🔄 **规则可配置**：支持自定义阈值和启用/禁用特定规则
- 💻 **友好的CLI**：支持人类可读和JSON两种输出格式

## 项目结构

```
.
├── README.md                          # 本说明文件
├── package.json                       # 项目配置
├── src/
│   ├── cli.js                         # CLI入口程序
│   └── preaudit-engine.js             # 预审规则引擎
├── samples/
│   ├── README.md                      # 样例数据说明
│   ├── normal-case/invoices.json      # 正常路径样例（全部通过）
│   └── error-case/invoices.json       # 异常路径样例（包含各种违规）
├── tests/
│   └── run-tests.js                   # 自动化测试脚本
└── output/                            # 输出目录（运行时生成）
```

## 安装

```bash
npm install
```

## 快速开始

### 1. 查看可用命令

```bash
node src/cli.js --help
```

### 2. 查看所有预审规则

```bash
node src/cli.js list-rules
```

### 3. 运行正常路径测试

```bash
npm run sample
# 或
node src/cli.js run --input samples/normal-case/invoices.json --output output/normal --format human
```

### 4. 运行异常路径测试

```bash
npm run sample-error
# 或
node src/cli.js run --input samples/error-case/invoices.json --output output/error --format human
```

### 5. 运行自动化测试

```bash
npm test
```

## CLI 使用说明

### 基本语法

```bash
node src/cli.js [command] [options]
```

### 命令列表

| 命令 | 说明 |
|------|------|
| (默认) | 运行发票预审 |
| list-rules | 列出所有可用的预审规则 |
| sample | 生成样例发票数据文件 |

### 选项说明

| 选项 | 缩写 | 说明 | 默认值 |
|------|------|------|--------|
| --input | -i | 输入发票数据文件路径（JSON格式） | 必填 |
| --output | -o | 输出目录路径 | ./output |
| --rules | | 指定要启用的预审规则（空格分隔） | 全部启用 |
| --partial-refund-threshold | | 部分退款阈值比例（0-1） | 0.8 |
| --validity-days | | 红冲有效期天数 | 360 |
| --format | | 输出格式：json 或 human | json |

### 使用示例

```bash
# 使用 human 格式输出，便于阅读
node src/cli.js run -i invoices.json -o output --format human

# 只启用特定规则
node src/cli.js run -i invoices.json --rules partial_refund missing_attachment

# 自定义部分退款阈值为 70%
node src/cli.js run -i invoices.json --partial-refund-threshold 0.7

# 自定义红冲有效期为 180 天
node src/cli.js run -i invoices.json --validity-days 180
```

## 预审规则详解

### 1. partial_refund（部分退款超额）
- **触发条件**：部分退款金额超过原发票金额的 80%
- **驳回原因**：部分退款比例过高，建议改为全额红冲

### 2. missing_attachment（缺少附件）
- **触发条件**：缺少必要的红冲证明材料
- **必须附件**：
  - `red_flush_agreement`（红冲协议）
  - `proof_of_return`（退货证明）
- **部分退款额外需要**：
  - `partial_refund_agreement`（部分退款协议）

### 3. tax_rate_mismatch（税率不符）
- **触发条件**：红冲税率与原发票税率不一致
- **说明**：红冲税率必须与原发票税率保持一致

### 4. invoice_amount_exceeded（金额超额）
- **触发条件**：红冲金额超过原发票剩余可冲金额
- **说明**：红冲金额不能超过原发票未红冲的金额

### 5. expired_invoice（发票过期）
- **触发条件**：发票开具日期距今超过 360 天
- **说明**：超过红冲有效期的发票不能红冲

### 6. invalid_invoice_number（发票号码无效）
- **触发条件**：发票号码格式不符合要求
- **要求**：12-20 位纯数字

## 输出文件说明

运行预审后，输出目录会生成以下文件：

| 文件名 | 说明 |
|--------|------|
| **00-预审汇总报告.json** | 预审总体汇总，包含统计数据、规则违规统计和生成文件清单 |
| **01-可红冲发票清单.json** | 通过预审的发票详细列表，包含完整的发票信息 |
| **02-驳回发票清单.json** | 预审驳回的发票列表，包含详细的驳回原因和违规规则 |
| **03-N-{rule}-违规明细.json** | 每个违规规则的详细发票清单（仅在有该类型违规时生成） |

### 输出文件示例 - 汇总报告

```json
{
  "toolName": "发票红冲材料红票申请预审 CLI",
  "version": "1.0.0",
  "auditDate": "2026-05-18T...",
  "statistics": {
    "totalInvoices": 6,
    "approvedCount": 0,
    "rejectedCount": 6,
    "approvalRate": "0.00%"
  },
  "ruleStatistics": [
    {
      "ruleCode": "partial_refund",
      "ruleDescription": "部分退款金额超过原发票金额的80%",
      "violationCount": 1
    }
  ],
  "generatedFiles": [
    {
      "fileName": "00-预审汇总报告.json",
      "description": "预审总体汇总报告..."
    }
  ]
}
```

## 输入数据格式

### 发票数据字段说明

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| invoiceNumber | string | 是 | 发票号码，12-20位数字 |
| invoiceDate | string | 是 | 发票日期，格式：YYYY-MM-DD |
| originalInvoiceNumber | string | 是 | 原蓝字发票号码 |
| buyerName | string | 是 | 购买方名称 |
| sellerName | string | 是 | 销售方名称 |
| amount | number | 是 | 红冲金额（不含税） |
| taxAmount | number | 是 | 红冲税额 |
| taxRate | number | 是 | 红冲税率（如 0.13 表示13%） |
| originalTaxRate | number | 否 | 原发票税率（用于税率不符校验） |
| redFlushType | string | 是 | 红冲类型：full / partial |
| refundType | string | 是 | 退款类型：full / partial |
| originalInvoiceAmount | number | 否 | 原发票总金额（用于部分退款比例校验） |
| remainingAmount | number | 否 | 原发票剩余可冲金额 |
| attachments | string[] | 是 | 附件列表 |

### 输入文件示例

```json
[
  {
    "invoiceNumber": "44032311301234567890",
    "invoiceDate": "2026-03-01",
    "originalInvoiceNumber": "44032311301111111111",
    "buyerName": "深圳XX科技有限公司",
    "sellerName": "广州YY贸易有限公司",
    "amount": 10000.00,
    "taxAmount": 1300.00,
    "taxRate": 0.13,
    "originalTaxRate": 0.13,
    "redFlushType": "full",
    "refundType": "full",
    "originalInvoiceAmount": 10000.00,
    "remainingAmount": 10000.00,
    "attachments": ["red_flush_agreement", "proof_of_return"]
  }
]
```

## 规则变更后的差异对比

当预审规则变更后，可以使用 `diff` 工具对比输出结果：

```bash
# 运行旧规则预审
node src/cli.js run -i invoices.json -o output/old --partial-refund-threshold 0.8

# 运行新规则预审
node src/cli.js run -i invoices.json -o output/new --partial-refund-threshold 0.7

# 对比差异
diff output/old/02-驳回发票清单.json output/new/02-驳回发票清单.json
```

可以观察到以下变化：
- **部分退款**：更多高比例的部分退款会被驳回
- **附件缺失**：新增的附件要求会导致更多驳回
- **税率不符**：严格的税率校验会增加驳回数量

## 测试说明

项目包含完整的自动化测试覆盖：

1. **核心业务逻辑测试**：验证 6 项预审规则的正确性
2. **批量预审功能测试**：验证批量处理和统计功能
3. **输出文件生成测试**：验证输出文件格式和内容
4. **CLI 命令测试**：验证正常路径和异常路径的 CLI 执行

运行测试：

```bash
npm test
```

## 验收标准

运行验收时，请执行以下命令并验证输出：

```bash
# 1. 运行正常路径验收
node src/cli.js run --input samples/normal-case/invoices.json --output output/acceptance-normal --format human

# 验证要点：
# - 工具名称显示为"发票红冲材料红票申请预审 CLI"
# - 3 张发票全部通过
# - 通过率 100%
# - 生成 3 个输出文件

# 2. 运行异常路径验收
node src/cli.js run --input samples/error-case/invoices.json --output output/acceptance-error --format human

# 验证要点：
# - 工具名称显示为"发票红冲材料红票申请预审 CLI"
# - 6 张发票全部或部分被驳回
# - 可以看到具体的驳回原因
# - 可以看到规则违规统计
# - 生成 3+N 个输出文件（N为触发的规则数）
```

## License

ISC
