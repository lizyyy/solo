# 收银支付差异退款窗口重复流水排查CLI工具

一个用于自动化对账收银机流水和支付平台流水的命令行工具，支持时间窗口匹配、退款归因、重复流水检测、坏行追踪等功能。

## 功能特性

- ✅ **多文件批量处理**：支持同时处理多个收银机和支付平台CSV文件
- ✅ **时间窗口匹配**：可配置的交易时间窗口（默认5分钟）
- ✅ **退款归因**：支持退款与原交易匹配，单独的退款时间窗口（默认24小时）
- ✅ **重复流水检测**：自动识别并标记重复交易记录
- ✅ **坏行追踪**：保留无法解析的行及其原始位置（文件+行号）
- ✅ **门店编号校验**：支持门店一致性校验（可配置）
- ✅ **金额容差**：可配置的金额匹配容差（默认0.01）
- ✅ **双格式报告**：同时生成CSV和Markdown对账报告
- ✅ **结果稳定性**：排序规则确保重复运行结果一致

## 项目结构

```
.
├── models.py           # 数据模型定义
├── config.py           # 配置管理模块
├── parser.py           # CSV文件解析器
├── matcher.py          # 交易匹配核心逻辑
├── analyzer.py         # 差异分析模块
├── reporter.py         # 报告生成器
├── reconcile_cli.py    # CLI主程序入口
├── sample_data/        # 示例数据目录
│   ├── cash_register_001.csv
│   └── payment_gateway_001.csv
└── reports/            # 报告输出目录（自动创建）
```

## 快速开始

### 基本用法

```bash
python3 reconcile_cli.py --cash <收银机文件> --payment <支付平台文件>
```

### 示例

```bash
# 单文件对账
python3 reconcile_cli.py --cash sample_data/cash_register_001.csv --payment sample_data/payment_gateway_001.csv

# 多文件对账（支持通配符）
python3 reconcile_cli.py --cash "cash/*.csv" --payment "payment/*.csv"

# 自定义时间窗口为10分钟
python3 reconcile_cli.py --cash cash.csv --payment payment.csv --time-window 10

# 只生成CSV报告
python3 reconcile_cli.py --cash cash.csv --payment payment.csv --format csv

# 禁用门店校验
python3 reconcile_cli.py --cash cash.csv --payment payment.csv --no-store-check
```

## 命令行参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--cash, -c` | 收银机流水CSV文件路径（必填，支持多个） | - |
| `--payment, -p` | 支付平台流水CSV文件路径（必填，支持多个） | - |
| `--config` | JSON配置文件路径 | - |
| `--time-window` | 支付交易时间窗口（分钟） | 5 |
| `--refund-time-window` | 退款交易时间窗口（分钟） | 1440 (24小时) |
| `--amount-tolerance` | 金额匹配容差 | 0.01 |
| `--no-duplicate-check` | 禁用重复流水检测 | - |
| `--no-store-check` | 禁用门店编号校验 | - |
| `--output-dir, -o` | 报告输出目录 | ./reports |
| `--format, -f` | 输出格式: csv/markdown/all | all |

## CSV列名映射

工具自动识别以下列名（支持中英文别名）：

**收银机流水列：**
- 交易号: transaction_id, 交易号, 流水号
- 门店编号: store_id, 门店编号, 门店号
- 金额: amount, 金额, 交易金额
- 交易时间: transaction_time, 交易时间, 时间
- 交易类型: transaction_type, 交易类型, 类型
- 支付方式: payment_method, 支付方式, 渠道
- 订单号: order_no, 订单号
- 是否退款: is_refund, 是否退款, 退款标记
- 退款参考号: refund_reference, 退款参考号

**支付平台流水列：**
- 支付单号: transaction_id, 支付单号, 流水号
- 门店编号: store_id, 门店编号, 商户号
- 金额: amount, 金额, 交易金额
- 交易时间: transaction_time, 支付时间, 交易时间
- 交易类型: transaction_type, 交易类型, 类型
- 支付方式: payment_method, 支付方式
- 商户订单号: order_no, 商户订单号
- 是否退款: is_refund, 是否退款
- 原交易号: refund_reference, 原交易号

## 差异原因说明

| 原因代码 | 说明 |
|----------|------|
| `time_window_mismatch` | 时间窗口不匹配 |
| `amount_mismatch` | 金额不匹配 |
| `refund_not_found` | 退款未找到对应记录 |
| `duplicate_transaction` | 重复交易记录 |
| `missing_in_cash_register` | 支付平台有记录，收银机缺失 |
| `missing_in_payment_gateway` | 收银机有记录，支付平台缺失 |
| `store_mismatch` | 门店编号不匹配 |
| `unknown` | 未知原因 |

## 返回码

- `0`: 所有交易匹配成功，无异常
- `1`: 存在未匹配记录或重复流水

## 注意事项

1. 使用通配符时建议用引号包裹，避免shell提前解析
2. 坏行会保留原始文件路径和行号，方便回溯排查
3. 重复运行同一批数据，由于稳定的排序规则，结果可重现

## 许可证

MIT License
