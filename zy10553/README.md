# CSV金额对账CLI工具

财务对账工具，用于对比两个渠道CSV文件中的金额、税费、手续费和退款状态。

## 功能特性

- **多文件读取**: 支持两个CSV文件对比
- **金额归一化**: 自动处理千分位、货币符号（¥$€£）、括号负数
- **差异分组**: 按字段或交易号分组显示差异
- **坏行保留**: 记录解析失败的行号、原始内容和错误原因
- **多种输出**:
  - 终端摘要（Console）
  - 机器可读结果（JSON）
  - 适合发给同事的报告（Markdown）

## 安装

```bash
pip install poetry
poetry install
```

## 使用方法

### 基本对账

```bash
# 使用默认列名
csv-reconciler reconcile 渠道A.csv 渠道B.csv

# 指定列名
csv-reconciler reconcile 渠道A.csv 渠道B.csv \
  --tx-id "交易流水号" \
  --amount "交易金额" \
  --tax "税额" \
  --fee "服务费" \
  --refund "退款标记"
```

### 输出报告

```bash
# 同时输出JSON和Markdown报告
csv-reconciler reconcile 渠道A.csv 渠道B.csv \
  --output-json result.json \
  --output-md report.md
```

### 运行自检

```bash
csv-reconciler selfcheck
```

## 命令选项

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `--tx-id` | 交易号 | 交易号列名 |
| `--amount` | 金额 | 金额列名 |
| `--tax` | 税费 | 税费列名 |
| `--fee` | 手续费 | 手续费列名 |
| `--refund` | 退款状态 | 退款状态列名 |
| `--tolerance` | 0.01 | 金额容差 |
| `--encoding` | utf-8 | 文件编码 |
| `--output-json` | - | JSON结果输出路径 |
| `--output-md` | - | Markdown报告输出路径 |

## CSV文件格式要求

至少包含以下列（列名可自定义）：

- 交易号：唯一标识每笔交易
- 金额：交易金额
- 税费：税费金额
- 手续费：手续费金额
- 退款状态：退款状态标识

## 金额格式支持

- 千分位格式: `1,000.00`
- 带货币符号: `¥2,000.00`, `$500.00`
- 括号负数: `(100)` 表示 -100
- 前后空格: `  300  `
- 空值: 视为 0

## 退出码

- `0`: 对账通过（无差异、无不匹配、无坏行）
- `1`: 对账发现问题（有差异、不匹配或坏行）
