# 水电抄表倍率异常用量缺表提示排查CLI

一个用于物业抄表数据异常检测的命令行工具，支持倍率换算、环比分析、缺表提示和异常清单管理。

## 功能特性

- **CSV解析**：自动识别字段，保留坏行位置信息
- **倍率换算**：根据配置的倍率自动计算实际用量
- **环比阈值**：与上期数据对比，检测异常波动
- **缺表提示**：检测缺失的表号
- **异常清单**：支持手动标记的异常表号
- **账单导出**：生成规范的账单数据
- **来源追踪**：每条记录保留源文件和行号信息
- **结果稳定**：排序不影响检测结果

## 项目结构

```
.
├── src/
│   └── meter_reader/
│       ├── __init__.py      # 版本信息
│       ├── parser.py        # CSV解析模块
│       ├── rules.py         # 规则判断模块
│       ├── reporter.py      # 报告生成模块
│       └── cli.py           # CLI入口
├── examples/                 # 示例数据
├── output/                   # 输出目录(自动生成)
└── main.py                   # 主入口脚本
```

## 安装要求

- Python 3.7+
- 无需额外依赖

## 使用方法

### 基本使用

```bash
python main.py examples/current_data.csv
```

### 带环比对比

```bash
python main.py examples/current_data.csv -p examples/previous_data.csv
```

### 完整参数

```bash
python main.py examples/current_data.csv \
    -p examples/previous_data.csv \
    -a examples/anomaly_list.txt \
    -m examples/expected_meters.txt \
    --min-usage 5 \
    --max-usage 5000 \
    --ratio 3.0 \
    -o output \
    --prefix 202401
```

### 命令行参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| files | 要检查的CSV文件路径(必需，可多个) | - |
| -p, --previous | 上期数据文件，用于环比比较 | - |
| -a, --anomaly-list | 异常清单文件，每行一个表号 | - |
| -m, --expected-meters | 预期表号清单，用于缺表检测 | - |
| --min-usage | 用量下限阈值 | 0.0 |
| --max-usage | 用量上限阈值 | 10000.0 |
| --ratio | 环比波动阈值倍数 | 3.0 |
| -o, --output-dir | 输出目录 | output |
| --prefix | 输出文件名前缀 | - |
| --encoding | 文件编码 | utf-8 |

## CSV文件格式

必需字段：
- 住户：住户标识
- 表号：水表/电表编号
- 上月读数：上期抄表读数
- 本月读数：本期抄表读数
- 倍率：计量倍率

示例：
```csv
住户,表号,上月读数,本月读数,倍率
1号楼101,A001,1250.5,1280.3,1.0
1号楼102,A002,980.2,1100.8,1.0
```

## 检测的异常类型

1. **负用量**：本月读数小于上月读数
2. **零用量**：本月用量为0
3. **用量超上限**：超过配置的最大用量阈值
4. **用量超下限**：低于配置的最小用量阈值
5. **环比异常**：与上期相比波动超过阈值倍数
6. **异常清单**：表号在手动异常清单中
7. **倍率变动**：与上期相比倍率发生变化

## 输出文件

每次运行会在输出目录生成以下文件：

- `{prefix}_summary.txt`：检查报告摘要
- `{prefix}_anomalies.csv`：异常记录明细
- `{prefix}_bad_records.csv`：坏行记录
- `{prefix}_billing.csv`：账单数据
- `{prefix}_missing_meters.csv`：缺表清单

## 示例运行

```bash
cd /Users/lzy/pro/solo/workspaces/zy70645
python main.py examples/current_data.csv -p examples/previous_data.csv -a examples/anomaly_list.txt -m examples/expected_meters.txt
```

## 模块说明

### parser.py - 解析模块
- `CSVParser`：CSV文件解析器
- `Record`：记录数据类，包含来源追踪
- `ParseResult`：解析结果，包含有效记录和坏行

### rules.py - 规则模块
- `ValidationRules`：异常检测规则引擎
- `MissingMeterDetector`：缺表检测器
- `AnomalyType`：异常类型枚举
- `Anomaly`：异常数据类

### reporter.py - 报告模块
- `ReportGenerator`：报告生成器
- 支持多种输出格式
- 控制台摘要打印

## 稳定性保证

- 所有输出都按源文件和行号稳定排序
- 重复运行同一批数据结果一致
- 坏行保留原始位置信息便于追溯
