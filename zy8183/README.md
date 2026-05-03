# 四流一致性复核工具

财务共享中心月结前复核增值税电子发票、采购订单、收货单和付款流水是否四流一致的本地Python CLI工具。

## 功能特性

- **多模块架构**: 解析、规则引擎、匹配归因、导出、CLI独立模块
- **多格式支持**: CSV发票/采购订单/付款单、JSONL收货单、YAML规则配置
- **边界处理**: 发票拆分/合并、跨月付款、币种或税率缺失
- **可视化输出**: HTML时间线/关系图，直观展示单据关系
- **灵活配置**: 可自定义校验规则、容差、严重程度

## 安装

```bash
pip install -e .
```

或者使用开发模式：

```bash
pip install pandas pyyaml rich click
```

## 快速开始

### 1. 初始化样例数据

```bash
four-flow init -o ./sample_data
```

样例数据包含以下场景：
- ✅ 完全匹配的单据组（PO-2024-001）
- ⚠️ 数量不匹配（PO-2024-002: 订单4台 vs 收货3台）
- ⚠️ 金额不匹配 + 发票拆分（PO-2024-003: 订单¥10000 vs 发票¥5000）
- ⚠️ 税率缺失（PO-2024-004: 发票缺少税率字段）
- ⚠️ 币种不一致（PO-2024-006: 订单CNY vs 发票USD）
- ℹ️ 跨月付款（INV-2024-002: 1月业务，2月付款）
- ⚠️ 孤立单据（PO-2024-007: 有订单无发票/收货/付款）

### 2. 执行复核

```bash
four-flow verify \
  --invoices ./sample_data/invoices.csv \
  --po ./sample_data/po_lines.csv \
  --receipts ./sample_data/receipts.jsonl \
  --payments ./sample_data/payments.csv \
  --rules ./sample_data/rules.yaml \
  --output-dir ./output \
  --verbose
```

### 3. 查看输出

输出目录 `./output` 包含：

| 文件名 | 说明 |
|--------|------|
| `mismatch_report.md` | 不匹配报告（Markdown格式） |
| `issues.csv` | 问题清单（CSV格式） |
| `timeline.html` | 时间线/关系图（浏览器打开查看） |

## 输入文件格式

### invoices.csv (发票)

| 字段 | 说明 | 示例 |
|------|------|------|
| invoice_number | 发票号码 | INV-2024-001 |
| vendor_id | 供应商ID | V001 |
| vendor_name | 供应商名称 | 华为技术有限公司 |
| amount | 不含税金额 | 10000.00 |
| tax_amount | 税额 | 1300.00 |
| total_amount | 价税合计 | 11300.00 |
| currency | 币种 | CNY |
| tax_rate | 税率 | 0.13 |
| date | 发票日期 | 2024-01-15 |
| po_number | 关联采购订单号 | PO-2024-001 |
| is_split | 是否拆分发票 | false |
| is_merged | 是否合并发票 | false |
| split_from | 拆分自原发票号 | - |
| merged_invoices | 合并包含的发票号 | - |

### po_lines.csv (采购订单行)

| 字段 | 说明 | 示例 |
|------|------|------|
| po_number | 采购订单号 | PO-2024-001 |
| po_line_number | 行号 | 1 |
| vendor_id | 供应商ID | V001 |
| vendor_name | 供应商名称 | 华为技术有限公司 |
| item_code | 物料代码 | MAT001 |
| item_description | 物料描述 | 服务器主机 |
| quantity | 数量 | 2 |
| unit_price | 单价 | 5000.00 |
| currency | 币种 | CNY |
| tax_rate | 税率 | 0.13 |
| date | 订单日期 | 2024-01-10 |

### receipts.jsonl (收货单, 每行一个JSON)

```json
{
  "receipt_number": "REC-2024-001",
  "po_number": "PO-2024-001",
  "po_line_number": 1,
  "vendor_id": "V001",
  "vendor_name": "华为技术有限公司",
  "item_code": "MAT001",
  "received_quantity": 2,
  "unit_price": 5000.00,
  "currency": "CNY",
  "tax_rate": 0.13,
  "date": "2024-01-14",
  "warehouse": "WH-A"
}
```

### payments.csv (付款单)

| 字段 | 说明 | 示例 |
|------|------|------|
| payment_number | 付款单号 | PAY-2024-001 |
| vendor_id | 供应商ID | V001 |
| vendor_name | 供应商名称 | 华为技术有限公司 |
| amount | 金额 | 10000.00 |
| tax_amount | 税额 | 1300.00 |
| total_amount | 付款总金额 | 11300.00 |
| currency | 币种 | CNY |
| date | 付款日期 | 2024-01-20 |
| invoice_number | 关联发票号 | INV-2024-001 |
| payment_method | 付款方式 | 电汇 |
| bank_account | 银行账号 | ACC-001 |
| is_cross_month | 是否跨月付款 | false |

### rules.yaml (校验规则)

```yaml
rules:
  - rule_id: R001
    rule_name: 金额一致性校验
    rule_type: amount
    description: 校验发票、采购订单、收货单、付款单的金额是否一致
    severity: critical
    enabled: true
    conditions:
      tolerance: 0.01
      check_tax: true

  - rule_id: R002
    rule_name: 供应商一致性校验
    rule_type: vendor
    severity: critical
    enabled: true
    conditions: {}

  - rule_id: R003
    rule_name: 数量一致性校验
    rule_type: quantity
    severity: warning
    enabled: true
    conditions:
      tolerance: 0

  - rule_id: R004
    rule_name: 税率一致性校验
    rule_type: tax_rate
    severity: warning
    enabled: true
    conditions: {}

  - rule_id: R005
    rule_name: 币种一致性校验
    rule_type: currency
    severity: warning
    enabled: true
    conditions: {}

  - rule_id: R006
    rule_name: 日期逻辑校验
    rule_type: date
    severity: info
    enabled: true
    conditions:
      allow_cross_month: true

  - rule_id: R007
    rule_name: 必填字段校验
    rule_type: required
    severity: warning
    enabled: true
    conditions:
      fields: ["currency", "tax_rate"]
```

## 模块架构

```
four_flow_verifier/
├── __init__.py          # 版本信息
├── models.py            # 数据模型定义
│   ├── Invoice          # 发票
│   ├── PurchaseOrderLine # 采购订单行
│   ├── Receipt          # 收货单
│   ├── Payment          # 付款单
│   ├── Issue            # 问题
│   ├── MatchResult      # 匹配结果
│   └── ValidationRule   # 校验规则
├── parsers.py           # 解析模块
│   ├── InvoiceParser
│   ├── PurchaseOrderParser
│   ├── ReceiptParser
│   ├── PaymentParser
│   └── RulesParser
├── rules_engine.py      # 规则引擎
│   └── RulesEngine      # 7种规则校验
├── matcher.py           # 匹配归因
│   └── DocumentMatcher  # 单据匹配
├── exporter.py          # 导出模块
│   └── ReportExporter   # 报告/CSV/HTML导出
└── cli.py               # CLI入口
    ├── init             # 初始化样例数据
    └── verify           # 执行复核
```

## 问题类型

| 类型 | 严重程度 | 说明 |
|------|----------|------|
| amount_mismatch | CRITICAL | 金额不一致 |
| vendor_mismatch | CRITICAL | 供应商不一致 |
| quantity_mismatch | WARNING | 数量不一致 |
| tax_rate_mismatch | WARNING | 税率不一致 |
| currency_mismatch | WARNING | 币种不一致 |
| date_mismatch | INFO | 日期逻辑错误 |
| missing_currency | WARNING | 币种缺失 |
| missing_tax_rate | WARNING | 税率缺失 |
| unmatched_document | WARNING | 孤立单据 |
| split_invoice | INFO | 拆分发票 |
| merged_invoice | INFO | 合并发票 |
| cross_month_payment | INFO | 跨月付款 |

## 可视化功能

打开 `timeline.html` 可以查看：

### 时间线视图
- 按时间顺序展示所有单据
- 不同颜色区分单据类型（订单/收货/发票/付款）
- 问题单据标注警告/严重标签
- 可按类型筛选查看

### 关系图视图
- 可视化展示单据关联关系
- 节点颜色：绿色(正常)、黄色(有警告)、红色(有严重问题)
- 箭头方向：订单→收货→发票→付款
- 悬停显示详细信息
- 支持拖拽、缩放

## 边界场景处理

### 发票拆分/合并
- 发票记录中设置 `is_split=true` 或 `is_merged=true`
- 系统自动标记为INFO级别提示
- 不影响金额匹配校验（需用户确认拆分/合并逻辑）

### 跨月付款
- 付款记录中设置 `is_cross_month=true`
- 或规则R006设置 `allow_cross_month: false` 时自动检测
- 标记为INFO级别提示

### 币种/税率缺失
- 规则R007自动检测
- 标记为WARNING级别
- 不影响其他规则执行

## Demo命令完整流程

```bash
# 1. 安装
pip install -e .

# 2. 初始化样例数据
four-flow init -o ./demo_data

# 3. 执行复核
four-flow verify \
  -i ./demo_data/invoices.csv \
  -p ./demo_data/po_lines.csv \
  -r ./demo_data/receipts.jsonl \
  -y ./demo_data/payments.csv \
  -l ./demo_data/rules.yaml \
  -o ./demo_output \
  -v

# 4. 查看结果
ls -la ./demo_output/
# - mismatch_report.md
# - issues.csv
# - timeline.html

# 5. 打开可视化
open ./demo_output/timeline.html
```

## 许可证

MIT License
