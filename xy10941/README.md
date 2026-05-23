# 门店收银差异对账 CLI

本地可运行的门店收银差异对账工具，自动对比收银机流水与支付平台流水，识别差异记录。

## 功能特性

- ✅ **多文件读取**: 支持目录下多个CSV文件自动读取
- ✅ **时间窗口匹配**: 可配置时间窗口，处理两边退款时间不同的问题
- ✅ **退款归因**: 区分普通交易和退款交易，独立匹配
- ✅ **重复流水去重**: 自动识别并记录重复流水
- ✅ **输入校验**: 完整的数据格式校验，坏行保留原始位置
- ✅ **多种输出格式**: CSV机器可读结果 + Markdown友好报告
- ✅ **终端摘要**: 友好的终端彩色输出
- ✅ **差异原因分析**: 自动识别差异原因（金额不匹配、时间超窗口等）

## 安装

### 环境要求

- Python 3.8+

### 安装依赖

```bash
pip install -r requirements.txt
```

### 安装 CLI 工具（可选）

```bash
pip install -e .
```

## 快速开始

### 1. 准备输入数据

创建数据目录，放置收银流水和支付流水CSV文件：

```
data/
├── cashier/          # 收银流水目录
│   ├── 20240101.csv
│   └── 20240102.csv
└── payment/          # 支付流水目录
    ├── alipay_01.csv
    └── wechat_01.csv
```

### 2. 输入文件格式

#### 收银流水 CSV 格式

| 字段 | 说明 | 示例 |
|------|------|------|
| trade_no | 收银订单号 | POS2024010100001 |
| amount | 交易金额 | 99.50 |
| time | 交易时间 | 2024-01-01 10:30:00 |
| is_refund | 是否退款（1/0, true/false, 是/否） | 0 |
| store_id | 门店编号 | STORE001 |

示例：
```csv
trade_no,amount,time,is_refund,store_id
POS2024010100001,99.50,2024-01-01 10:30:00,0,STORE001
POS2024010100002,50.00,2024-01-01 11:00:00,1,STORE001
```

#### 支付流水 CSV 格式

| 字段 | 说明 | 示例 |
|------|------|------|
| trade_no | 支付订单号 | ALIPAY202401010001 |
| amount | 交易金额 | 99.50 |
| time | 交易时间 | 2024-01-01 10:30:05 |
| is_refund | 是否退款 | 0 |
| platform | 支付平台 | 支付宝 |

示例：
```csv
trade_no,amount,time,is_refund,platform
ALIPAY202401010001,99.50,2024-01-01 10:30:05,0,支付宝
WECHAT202401010001,88.00,2024-01-01 12:00:10,0,微信支付
```

### 3. 运行对账

方式一：使用 Python 直接运行（推荐）

```bash
python -m store_reconcile.cli \
  --cash-dir ./data/cashier \
  --payment-dir ./data/payment \
  --store-id STORE001 \
  --output-dir ./output \
  --time-window 300
```

方式二：如果已安装 CLI

```bash
store-reconcile \
  -c ./data/cashier \
  -p ./data/payment \
  -s STORE001 \
  -o ./output \
  -t 300
```

## 命令行参数

| 参数 | 简写 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `--cash-dir` | `-c` | ✅ | - | 收银流水CSV文件目录 |
| `--payment-dir` | `-p` | ✅ | - | 支付平台流水CSV文件目录 |
| `--store-id` | `-s` | ✅ | - | 门店编号 |
| `--output-dir` | `-o` | ❌ | `./output` | 输出目录 |
| `--time-window` | `-t` | ❌ | `300` | 时间匹配窗口（秒） |
| `--amount-tolerance` | `-a` | ❌ | `0.01` | 金额容忍度（元） |
| `--encoding` | `-e` | ❌ | `utf-8` | CSV文件编码 |
| `--verbose` | `-v` | ❌ | - | 显示详细日志 |

## 输出文件说明

工具运行后，输出目录会生成以下文件：

```
output/
├── STORE001_matched_20240101_120000.csv      # 成功匹配记录
├── STORE001_unmatched_20240101_120000.csv    # 差异记录（单边）
├── STORE001_duplicates_20240101_120000.csv   # 重复记录
├── STORE001_errors_20240101_120000.csv       # 坏行/异常记录
└── STORE001_report_20240101_120000.md        # 对账汇总报告
```

### 1. 匹配记录 (`*_matched_*.csv`)

包含收银和支付两边成功匹配的交易记录，包含：
- 交易类型（普通交易/退款）
- 两边的订单号、交易时间
- 时间差（秒）
- 原始文件位置

### 2. 差异记录 (`*_unmatched_*.csv`)

未能匹配的单边记录，包含：
- 来源系统（收银/支付）
- 差异原因
- 原始文件位置

**常见差异原因**：
- `金额不匹配` - 对方系统无相同金额记录
- `时间差异超出窗口` - 时间差超过配置的窗口
- `订单号不匹配` - 订单号无法对应
- `退款记录在对方系统不存在` - 退款仅在单边存在

### 3. 重复记录 (`*_duplicates_*.csv`)

识别出的重复流水，包含：
- 重复次数
- 所有重复行的原始位置

### 4. 错误记录 (`*_errors_*.csv`)

坏行或异常样本，**保留原始位置和原始内容**，便于追溯：
- 文件名和行号
- 错误信息（缺少字段、格式错误等）
- 原始行内容

### 5. 对账报告 (`*_report_*.md`)

给同事看的友好报告，包含：
- 记录统计（原始数、去重后、重复数）
- 匹配结果汇总
- 差异记录统计
- 金额汇总与差异
- 差异原因分布
- 输出文件说明

## 示例

### 基础使用

```bash
# 使用默认参数
python -m store_reconcile.cli \
  -c ./examples/cashier \
  -p ./examples/payment \
  -s STORE001
```

### 自定义时间窗口

```bash
# 设置10分钟时间窗口
python -m store_reconcile.cli \
  -c ./data/cashier \
  -p ./data/payment \
  -s STORE001 \
  -t 600
```

### GBK 编码文件

```bash
python -m store_reconcile.cli \
  -c ./data/cashier \
  -p ./data/payment \
  -s STORE001 \
  -e gbk
```

### 显示详细日志

```bash
python -m store_reconcile.cli \
  -c ./data/cashier \
  -p ./data/payment \
  -s STORE001 \
  -v
```

## 目录结构

```
store-reconcile-cli/
├── store_reconcile/          # 核心代码
│   ├── __init__.py
│   ├── cli.py                # CLI 入口
│   ├── data_loader.py        # 数据读取与校验
│   ├── reconciler.py         # 对账核心逻辑
│   └── reporter.py           # 报告输出
├── examples/                 # 示例数据
│   ├── cashier/
│   └── payment/
├── requirements.txt
├── setup.py
└── README.md
```

## 常见问题

### Q: 提示"目录中没有找到CSV文件"

A: 请检查目录路径是否正确，目录下是否有 `.csv` 后缀的文件。

### Q: CSV 文件读取乱码

A: 使用 `--encoding gbk` 或其他编码参数指定文件编码。

### Q: 很多"时间差异超出窗口"的记录

A: 适当调大 `--time-window` 参数的值（单位秒）。

### Q: 金额明明相等却提示不匹配

A: 检查金额精度，可适当调大 `--amount-tolerance` 参数。

### Q: 坏数据在哪里看

A: 输出目录的 `*_errors_*.csv` 文件中保留了所有坏行的原始位置和原始内容，不会只在终端闪一下就消失。

## License

MIT
