# 本地经营周报一致性复核工具

用于连锁咖啡运营在发周报前进行数据一致性复核的工具。

## 功能特性

- **数据解析**：支持读取 CSV 业务数据、YAML 指标规则、Markdown/JSON 格式的周报
- **指标计算**：自动复算 GMV、净销售额、客单价、退款率、人工成本率等核心指标
- **问题检测**：识别以下类型的问题：
  - 🔴 容差超出（数值差异过大）
  - 🔴 漏扣退款（净销售额未扣除退款）
  - 🔴 门店汇总方向错误（汇总值与门店明细之和不一致）
  - 🟡 四舍五入不一致
  - 🟡 缺失指标
  - 🟡 额外指标
- **CLI 命令**：提供 `validate`、`audit`、`export` 三个核心命令
- **本地 API**：提供轻量 FastAPI 服务，支持上传文件复核
- **报告导出**：支持导出 Markdown 差异报告和 CSV 明细

## 安装

```bash
# 安装依赖
pip install -e .

# 或者
pip install -r requirements.txt
```

## 快速开始

### 使用示例数据测试

项目包含示例数据文件（在 `samples/` 目录下）：

- `orders.csv` - 订单数据
- `refunds.csv` - 退款数据
- `labor_costs.csv` - 人工成本数据
- `metric_rules.yaml` - 指标计算规则
- `weekly_report.md` - 有问题的周报（用于测试检测能力）
- `weekly_report_correct.md` - 正确的周报
- `report.json` - JSON 格式的报告

### 1. validate 命令 - 验证报告

```bash
# 验证有问题的周报（会检测出问题）
report-audit validate \
  --orders samples/orders.csv \
  --refunds samples/refunds.csv \
  --labor-costs samples/labor_costs.csv \
  --metric-rules samples/metric_rules.yaml \
  --report samples/weekly_report.md \
  --verbose

# 验证正确的周报（应该通过）
report-audit validate \
  --orders samples/orders.csv \
  --refunds samples/refunds.csv \
  --labor-costs samples/labor_costs.csv \
  --metric-rules samples/metric_rules.yaml \
  --report samples/weekly_report_correct.md
```

### 2. audit 命令 - 完整审计并生成报告

```bash
# 执行完整审计，导出所有报告到 output 目录
report-audit audit \
  --orders samples/orders.csv \
  --refunds samples/refunds.csv \
  --labor-costs samples/labor_costs.csv \
  --metric-rules samples/metric_rules.yaml \
  --report samples/weekly_report.md \
  --output-dir output \
  --name week1_audit
```

执行后会生成三个文件：
- `output/week1_audit.md` - Markdown 格式的差异报告
- `output/week1_audit_issues.csv` - 问题明细 CSV
- `output/week1_audit_metrics.csv` - 指标对比 CSV

### 3. export 命令 - 导出报告

```bash
# 导出 Markdown 报告
report-audit export \
  --orders samples/orders.csv \
  --refunds samples/refunds.csv \
  --labor-costs samples/labor_costs.csv \
  --metric-rules samples/metric_rules.yaml \
  --report samples/weekly_report.md \
  --format markdown \
  --output output/

# 导出 CSV 明细
report-audit export \
  --orders samples/orders.csv \
  --refunds samples/refunds.csv \
  --labor-costs samples/labor_costs.csv \
  --metric-rules samples/metric_rules.yaml \
  --report samples/weekly_report.md \
  --format csv \
  --output output/
```

### 4. api 命令 - 启动本地 API 服务器

```bash
# 启动 API 服务器
report-audit api

# 带自动重载（开发模式）
report-audit api --reload

# 指定端口
report-audit api --host 0.0.0.0 --port 8080
```

启动后访问：
- API 文档：http://127.0.0.1:8000/docs
- ReDoc：http://127.0.0.1:8000/redoc
- 健康检查：http://127.0.0.1:8000/health

## API 使用示例

### 使用 curl 调用 API

```bash
# 验证报告（返回 JSON）
curl -X POST "http://127.0.0.1:8000/validate" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "orders=@samples/orders.csv" \
  -F "refunds=@samples/refunds.csv" \
  -F "labor_costs=@samples/labor_costs.csv" \
  -F "metric_rules=@samples/metric_rules.yaml" \
  -F "report=@samples/weekly_report.md"

# 导出 Markdown 报告
curl -X POST "http://127.0.0.1:8000/export/markdown" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "orders=@samples/orders.csv" \
  -F "refunds=@samples/refunds.csv" \
  -F "labor_costs=@samples/labor_costs.csv" \
  -F "metric_rules=@samples/metric_rules.yaml" \
  -F "report=@samples/weekly_report.md" \
  --output audit_report.md
```

## 数据文件格式说明

### 1. 订单数据 (orders.csv)

| 字段名 | 说明 | 示例 |
|--------|------|------|
| order_id | 订单ID | ORD001 |
| store_id | 门店ID | S001 |
| store_name | 门店名称 | 朝阳门店 |
| order_date | 订单日期 | 2024-01-01 |
| order_time | 订单时间 | 08:30:00 |
| total_amount | 订单金额 | 35.5 |
| items_count | 商品数量 | 2 |
| customer_id | 客户ID（可选） | C001 |
| payment_method | 支付方式（可选） | 微信 |

### 2. 退款数据 (refunds.csv)

| 字段名 | 说明 | 示例 |
|--------|------|------|
| refund_id | 退款ID | R001 |
| order_id | 关联订单ID | ORD003 |
| store_id | 门店ID | S001 |
| refund_date | 退款日期 | 2024-01-02 |
| refund_amount | 退款金额 | 28.8 |
| refund_reason | 退款原因（可选） | 口味不满意 |

### 3. 人工成本数据 (labor_costs.csv)

| 字段名 | 说明 | 示例 |
|--------|------|------|
| store_id | 门店ID | S001 |
| store_name | 门店名称 | 朝阳门店 |
| date | 日期 | 2024-01-01 |
| hours_worked | 工作小时数 | 8 |
| hourly_rate | 时薪 | 25 |
| total_cost | 总成本 | 200 |
| role | 岗位（可选） | 店长 |

### 4. 指标规则 (metric_rules.yaml)

```yaml
metrics:
  - name: gmv
    display_name: GMV
    formula: "sum(orders.total_amount)"
    description: 总商品交易额
    tolerance: 0.01          # 容差 1%
    rounding_method: ROUND_HALF_UP  # 四舍五入方式
    decimal_places: 2         # 小数位数
    store_aggregation: SUM    # 门店汇总方式
```

### 5. 周报格式

支持两种格式：

#### Markdown 格式 (.md)

工具会自动从文本中提取以下模式的指标：
- `GMV: xxx` 或 `总销售额: xxx`
- `净销售额: xxx` 或 `净营收: xxx`
- `客单价: xxx` 或 `平均客单价: xxx`
- `退款率: xxx%` 或 `退货率: xxx%`
- `人工成本率: xxx%` 或 `人力成本率: xxx%`

同时支持从 Markdown 表格中提取门店级数据。

#### JSON 格式 (.json)

```json
{
  "metrics": [
    {
      "metric_name": "gmv",
      "display_name": "GMV",
      "value": 871.80,
      "source_text": "GMV: 871.80元"
    }
  ],
  "store_metrics": {
    "S001": {
      "gmv": { "value": 195.80 }
    }
  }
}
```

## 示例数据中的问题说明

`weekly_report.md` 文件中故意设置了以下问题，用于测试工具的检测能力：

1. **GMV 容差超出**：报告写 900.0，实际应为 871.80
2. **净销售额漏扣退款**：报告写 900.0（等于GMV），实际应为 798.00
3. **客单价容差超出**：报告写 60.0，实际应为 58.12
4. **退款率容差超出**：报告写 5.0%，实际应为 8.47%
5. **人工成本率容差超出**：报告写 450.0%，实际应为 497.74%

`weekly_report_correct.md` 是正确的版本，用于对比测试。

## 项目结构

```
.
├── audit_tool/              # 主包目录
│   ├── __init__.py         # 包初始化
│   ├── models.py           # 数据模型定义
│   ├── parsers.py          # 数据解析器
│   ├── calculator.py       # 指标计算引擎
│   ├── validator.py        # 差异检测逻辑
│   ├── exporter.py         # 报告导出器
│   ├── service.py          # 核心服务类
│   ├── cli.py              # CLI 命令定义
│   └── api.py              # FastAPI 服务
├── samples/                # 示例数据
│   ├── orders.csv
│   ├── refunds.csv
│   ├── labor_costs.csv
│   ├── metric_rules.yaml
│   ├── weekly_report.md
│   ├── weekly_report_correct.md
│   └── report.json
├── requirements.txt
├── setup.py
└── README.md
```

## 依赖

- Python >= 3.8
- PyYAML >= 6.0
- click >= 8.0
- fastapi >= 0.100.0
- uvicorn >= 0.23.0
- python-multipart >= 0.0.6

## 许可证

MIT License
