# 发票红冲材料红票申请预审 - 样例数据目录

## 目录结构

```
samples/
├── README.md                          # 本说明文件
├── normal-case/
│   └── invoices.json                  # 正常情况样例（全部可通过预审）
└── error-case/
    └── invoices.json                  # 异常情况样例（包含各种违规）
```

## 字段说明

### 发票数据字段

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
| redFlushType | string | 是 | 红冲类型：full（全额红冲）/ partial（部分红冲） |
| refundType | string | 是 | 退款类型：full（全额退款）/ partial（部分退款） |
| originalInvoiceAmount | number | 否 | 原发票总金额（用于部分退款比例校验） |
| remainingAmount | number | 否 | 原发票剩余可冲金额 |
| attachments | string[] | 是 | 附件列表，必须包含：red_flush_agreement, proof_of_return |

## 预审规则说明

### 1. partial_refund（部分退款超额）
- 触发条件：部分退款金额超过原发票金额的80%
- 说明：部分退款比例过高，建议改为全额红冲

### 2. missing_attachment（缺少附件）
- 触发条件：缺少必要的红冲证明材料
- 必须附件：red_flush_agreement（红冲协议）、proof_of_return（退货证明）
- 部分退款额外需要：partial_refund_agreement（部分退款协议）

### 3. tax_rate_mismatch（税率不符）
- 触发条件：红冲税率与原发票税率不一致
- 说明：红冲税率必须与原发票税率保持一致

### 4. invoice_amount_exceeded（金额超额）
- 触发条件：红冲金额超过原发票剩余可冲金额
- 说明：红冲金额不能超过原发票未红冲的金额

### 5. expired_invoice（发票过期）
- 触发条件：发票开具日期距今超过360天
- 说明：超过红冲有效期的发票不能红冲

### 6. invalid_invoice_number（发票号码无效）
- 触发条件：发票号码格式不符合要求
- 要求：12-20位纯数字

## 期望输出

运行预审后，输出目录会生成以下文件：

| 文件名 | 说明 |
|--------|------|
| 00-预审汇总报告.json | 预审总体汇总，包含统计数据和生成文件清单 |
| 01-可红冲发票清单.json | 通过预审的发票详细列表 |
| 02-驳回发票清单.json | 预审驳回的发票列表及详细驳回原因 |
| 03-N-{rule}-违规明细.json | 每个违规规则的详细发票清单（仅在有违规时生成） |

## 使用示例

```bash
# 正常路径测试
npm run sample

# 异常路径测试
npm run sample-error

# 或直接使用CLI
node src/cli.js run --input samples/normal-case/invoices.json --output output/normal --format human
```
