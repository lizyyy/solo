# 多币种套利路径搜索工具

从历史汇率样本中自动搜索套利路径，保留原始备注和来源，标记无法计算的记录及原因。

## 快速开始

```bash
# 校验数据（检查单位、缺失值等）
python main.py validate data/sample_rates.csv -v

# 搜索套利路径
python main.py search data/sample_rates.csv

# 搜索并导出结果到 output/ 目录
python main.py search data/sample_rates.csv -o output -f csv

# 只看收益率 > 0.5% 的路径
python main.py search data/sample_rates.csv --min-profit 0.5

# 补录备注（给行索引 3 的记录加备注，并显示补录前后差异）
python main.py annotate data/sample_rates.csv --row 3 --text "已电话确认汇率" --by 阿乔 -o output
```

## 输入格式

支持 CSV 和 JSON 两种格式。字段名不要求完全统一，工具会自动识别常见别名。

### CSV 格式

```csv
from_currency,to_currency,rate,unit,source,备注
USD,CNY,7.25,1,老师讲义-2024Q3,
CNY,EUR,0.127,1,业务表-外汇组,间接报价待确认
EUR,GBP,0.856,1,临时截图-手机拍,屏幕反光可能看错
```

### JSON 格式

```json
[
  {"from": "USD", "to": "CNY", "rate": 7.25, "unit": 1, "src_file": "老师讲义", "备注": "基础汇率"}
]
```

### 字段别名映射

| 标准字段 | 可识别的别名 |
|---|---|
| `from_currency` | from, source, base, base_currency, src, 源币种, 起始币种 |
| `to_currency` | to, target, quote, quote_currency, dst, 目标币种, 报价币种 |
| `rate` | price, exchange_rate, fx_rate, 汇率, 兑换率, 报价 |
| `unit` | 单位, denomination, 面额 |
| `original_source` | source, 来源, src_file, 数据源 |
| `original_notes` | notes, 备注, remark, comment, 说明, note |

**必填字段**: `from_currency`、`to_currency`、`rate`。其余可选。

## 输出文件说明

导出目录下会生成以下文件：

| 文件 | 内容 |
|---|---|
| `arbitrage_paths_*.csv` | 套利路径列表（含收益率、分析建议、原始来源和备注） |
| `anomalies_*.csv` | 异常提醒（单位可疑、同方向汇率冲突等） |
| `uncomputable_*.csv` | 无法计算的记录（含原因、原始值、来源） |
| `annotation_diffs_*.csv` | 补录备注后的变更差异 |
| `summary_*.json` | 汇总统计 |

### 异常清单怎么看

`anomalies_*.csv` 中的 `anomaly_type` 字段含义：

- **uncomputable**: 记录无法参与计算（汇率缺失、币种为空、非正数等），`detail` 列写明原因
- **unit_suspicion**: 单位可能有问题（汇率异常偏大/偏小，单位系数≠1），`detail` 列给出调整建议
- **duplicate_conflict**: 同方向存在多条汇率且差异超过 1%，`detail` 列列出各条来源和备注

### 无法计算的记录

`uncomputable_*.csv` 会保留所有无法计算的记录，`compute_reason` 列写明原因（如"汇率无法解析: 原始值='N/A'"、"源币种为空"等），不会从统计中消失。

## 补录备注

补录不会覆盖原始备注，而是以追加方式保留：

```
原始备注 | [补录@2026-06-01T10:30:00 阿乔: 已电话确认汇率]
```

补录后会输出差异说明，包括变更前后的内容和解释。导出时差异也会写入 `annotation_diffs_*.csv`。

## 算法说明

使用 Bellman-Ford 算法在汇率图上检测负权环，负权环对应套利机会（沿环兑换后本金增加）。每条路径的收益率为各段汇率连乘减 1。

**注意**: 输出的收益率为纯数学结果，未扣除手续费、滑点和资金转移时间成本。

## 数据来源追溯

每条记录都保留：
- `original_source`: 原始数据来源（老师讲义、业务表、临时截图等）
- `original_notes`: 原始备注（含乱备注，不做清洗）
- `loaded_at`: 数据加载时间
- `detected_at`: 套利路径检测时间

换人接手时可通过这些字段追溯上一次的判断依据，无需翻旧记录。
