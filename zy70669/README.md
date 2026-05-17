# 现金长短款备用金备注归因排查CLI

专门用于连锁网点现金盘点表的长款、短款和备用金变动的归因分析工具。

## 核心特性

- **表格解析**: 支持Excel (.xlsx, .xls) 和CSV格式，保留坏行位置
- **备用金调整**: 自动识别备注中的备用金调整并分离计算
- **差异分级**: 根据金额大小分级（轻微/一般/重大/特大）
- **备注提取**: 关键词匹配长款、短款、备用金、调整等词汇
- **报告导出**: 生成Excel、CSV、TXT三种格式的可复查报告
- **来源追踪**: MD5哈希确保重复运行结果稳定，检测记录变更
- **坏行保留**: 记录原始文件位置和错误信息

## 安装

```bash
pip install -e .
```

## 快速开始

### 1. 查看帮助

```bash
cash-recon --help
cash-recon process --help
```

### 2. 生成默认配置文件

```bash
cash-recon init-config
```

### 3. 处理现金盘点表

```bash
# 处理单个文件
cash-recon process examples/sample_data.csv

# 处理多个文件
cash-recon process file1.xlsx file2.csv

# 指定输出目录
cash-recon process file1.xlsx -o my_reports

# 禁用追踪
cash-recon process file1.xlsx --no-tracking
```

### 4. 验证文件格式

```bash
cash-recon validate examples/sample_data.csv
```

## 配置说明

配置文件 `cash_recon_config.json` 可自定义：

- **long_short_keywords**: 长款/短款的关键词列表
- **imprest_keywords**: 备用金相关关键词
- **imprest_adjust_keywords**: 备用金调整相关关键词
- **diff_levels**: 差异级别阈值（单位：元）
- **required_columns**: 必需列名

## 输出报告

在 `reports` 目录下生成：

1. **Excel报告**: 包含处理结果、错误行记录、统计汇总三个工作表
2. **CSV报告**: 简化版处理结果
3. **TXT汇总**: 文本格式的统计摘要

## 项目结构

```
cash_recon/
├── __init__.py      # 包初始化
├── config.py        # 配置管理
├── parser.py        # 表格解析模块
├── rule_engine.py   # 规则引擎（差异判断、备注分析）
├── tracker.py       # 来源追踪（哈希、去重）
├── reporter.py      # 报告生成
└── cli.py           # CLI入口
```

## 核心规则

### 差异类型

- **长款**: 盘点金额 > 账面金额，或备注含长款关键词
- **短款**: 盘点金额 < 账面金额，或备注含短款关键词
- **备用金调整**: 备注同时包含"备用金"和"调整"相关词汇
- **混合**: 同时包含长短款和备用金调整
- **未知**: 无差异且无特殊备注

### 差异级别（可配置）

- **轻微**: ≤ 50元
- **一般**: ≤ 200元
- **重大**: ≤ 1000元
- **特大**: > 1000元

## 使用示例

```bash
# 使用自定义配置
cash-recon process data.xlsx -c my_config.json

# 生成带前缀的报告
cash-recon process data.xlsx --prefix 202401_report
```
