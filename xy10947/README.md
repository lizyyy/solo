# 餐饮原料损耗 CLI 工具

一个专业的餐饮原料损耗分析命令行工具，帮助厨师长和管理人员快速发现异常损耗项。

## 功能特点

- ✅ **参数解析**: 完整的命令行参数支持，灵活配置
- ✅ **输入校验**: 数据校验和错误提示，保留原始位置信息
- ✅ **多表合并**: 自动合并原料、采购、领用、报损、门店数据
- ✅ **单位换算**: 支持自定义单位换算关系
- ✅ **损耗率计算**: 精确计算各门店各原料的损耗率
- ✅ **阈值告警**: 可配置损耗率阈值，自动标记异常
- ✅ **门店排行**: 按损耗率对门店进行排名
- ✅ **分类分析**: 按原料分类汇总损耗数据
- ✅ **多种输出**: 终端摘要、JSON、CSV、Markdown报告
- ✅ **文件覆盖规则**: 支持覆盖或自动重命名已存在文件

## 安装

```bash
# 安装依赖
pip install -r requirements.txt

# 安装CLI工具
pip install -e .
```

## 快速开始

### 1. 生成示例数据

```bash
food-waste init ./sample_data
```

### 2. 运行分析

```bash
food-waste analyze \
  -m ./sample_data/materials.csv \
  -s ./sample_data/stores.csv \
  -p ./sample_data/purchases.csv \
  -u ./sample_data/usages.csv \
  -w ./sample_data/wastes.csv \
  -o ./output
```

## 命令详解

### analyze - 分析原料损耗数据

```bash
food-waste analyze [OPTIONS]

Options:
  -m, --materials PATH      原料数据文件路径 (CSV/Excel)  [required]
  -s, --stores PATH         门店数据文件路径 (CSV/Excel)  [required]
  -p, --purchases PATH      采购数据文件路径 (CSV/Excel)  [required]
  -u, --usages PATH         领用数据文件路径 (CSV/Excel)  [required]
  -w, --wastes PATH         报损数据文件路径 (CSV/Excel)  [required]
  -o, --output-dir PATH     报告输出目录  [default: ./output]
  -t, --threshold FLOAT     损耗率阈值 (%)  [default: 5.0]
  -d, --date-start TEXT     统计开始日期，格式: YYYY-MM-DD
  -e, --date-end TEXT       统计结束日期，格式: YYYY-MM-DD
  --store TEXT              指定门店ID进行分析
  --category TEXT           指定原料分类进行分析
  --overwrite               覆盖已存在的输出文件
  -q, --quiet               静默模式，只生成文件，不输出终端摘要
  --help                    显示帮助信息
```

### init - 初始化示例数据

```bash
food-waste init [OUTPUT_DIR]

Arguments:
  [OUTPUT_DIR]  示例数据输出目录  [default: ./sample_data]
```

## 数据格式说明

### 原料数据 (materials.csv)

| 列名 | 说明 | 示例 |
|------|------|------|
| material_id | 原料ID | M001 |
| material_name | 原料名称 | 猪肉 |
| category | 原料分类 | 肉类 |
| unit | 主单位 | 千克 |
| unit_conversion | 单位换算 | 斤:0.5;克:0.001 |
| price_per_unit | 单价 | 30.0 |

### 门店数据 (stores.csv)

| 列名 | 说明 | 示例 |
|------|------|------|
| store_id | 门店ID | S001 |
| store_name | 门店名称 | 北京朝阳店 |
| region | 区域 | 北京 |
| manager | 负责人 | 张三 |

### 采购数据 (purchases.csv)

| 列名 | 说明 | 示例 |
|------|------|------|
| purchase_id | 采购单ID | P001 |
| store_id | 门店ID | S001 |
| material_id | 原料ID | M001 |
| purchase_date | 采购日期 | 2024-01-15 |
| quantity | 采购数量 | 100 |
| unit | 采购单位 | 千克 |
| total_price | 总价 | 3000.0 |

### 领用数据 (usages.csv)

| 列名 | 说明 | 示例 |
|------|------|------|
| usage_id | 领用单ID | U001 |
| store_id | 门店ID | S001 |
| material_id | 原料ID | M001 |
| usage_date | 领用日期 | 2024-01-15 |
| quantity | 领用数量 | 80 |
| unit | 领用单位 | 千克 |
| department | 领用部门 | 厨房 |

### 报损数据 (wastes.csv)

| 列名 | 说明 | 示例 |
|------|------|------|
| waste_id | 报损单ID | W001 |
| store_id | 门店ID | S001 |
| material_id | 原料ID | M001 |
| waste_date | 报损日期 | 2024-01-16 |
| quantity | 报损数量 | 8 |
| unit | 报损单位 | 千克 |
| reason | 报损原因 | 过期 |

## 输出文件说明

运行分析后，输出目录会包含以下文件：

| 文件名 | 说明 |
|--------|------|
| waste_report.json | 完整的JSON格式报告，包含所有数据 |
| summary.csv | 总体摘要数据 |
| store_rankings.csv | 门店损耗排名 |
| category_analysis.csv | 原料分类损耗分析 |
| abnormal_items.csv | 异常损耗明细 |
| validation_errors.csv | 数据校验错误记录 |
| waste_report.md | Markdown格式的完整报告 |

## 使用示例

### 基础使用

```bash
food-waste analyze \
  -m data/materials.csv \
  -s data/stores.csv \
  -p data/purchases.csv \
  -u data/usages.csv \
  -w data/wastes.csv
```

### 自定义损耗率阈值

```bash
food-waste analyze \
  -m data/materials.csv \
  -s data/stores.csv \
  -p data/purchases.csv \
  -u data/usages.csv \
  -w data/wastes.csv \
  -t 3.0
```

### 指定日期范围

```bash
food-waste analyze \
  -m data/materials.csv \
  -s data/stores.csv \
  -p data/purchases.csv \
  -u data/usages.csv \
  -w data/wastes.csv \
  -d 2024-01-01 \
  -e 2024-01-31
```

### 分析指定门店

```bash
food-waste analyze \
  -m data/materials.csv \
  -s data/stores.csv \
  -p data/purchases.csv \
  -u data/usages.csv \
  -w data/wastes.csv \
  --store S001
```

### 覆盖已存在文件

```bash
food-waste analyze \
  -m data/materials.csv \
  -s data/stores.csv \
  -p data/purchases.csv \
  -u data/usages.csv \
  -w data/wastes.csv \
  --overwrite
```

### 静默模式（只生成文件，不输出终端摘要）

```bash
food-waste analyze \
  -m data/materials.csv \
  -s data/stores.csv \
  -p data/purchases.csv \
  -u data/usages.csv \
  -w data/wastes.csv \
  -q
```

**注意**: 默认情况下，命令会同时输出终端摘要和所有文件（JSON、CSV、Markdown）。`-q` 选项仅禁用终端摘要显示，但仍会生成所有文件。

## 退出码说明

| 退出码 | 说明 |
|--------|------|
| 0 | 成功，无异常损耗 |
| 1 | 程序错误（文件不存在、数据错误等） |
| 2 | 成功，但存在异常损耗项 |

## 项目结构

```
food_waste/
├── __init__.py          # 包初始化
├── models.py            # 数据模型定义
├── data_loader.py       # 数据加载模块
├── processor.py         # 业务逻辑处理
├── output.py            # 输出生成模块
└── cli.py               # CLI命令行入口
```

## 技术栈

- **Python 3.9+**
- **pandas**: 数据处理
- **pydantic**: 数据校验
- **click**: 命令行框架
- **rich**: 终端美化
- **jinja2**: 模板渲染
- **openpyxl**: Excel文件支持

## 许可证

MIT
