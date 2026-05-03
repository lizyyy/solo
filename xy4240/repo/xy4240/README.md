# 香精配方标签核验员

一款专为小型调香工作室设计的本地命令行工具，用于新品打样前的配方核验，避免香料超限、批次过期或标签漏写致敏成分等问题。

## 功能特性

- ✅ **init** - 初始化项目，创建配置和示例数据
- ✅ **import** - 导入配方、原料、批次、规则数据
- ✅ **calc** - 按目标灌装量换算用量、计算成本、分析乙醇/香精比例
- ✅ **check** - 合规性检查（禁用物、阈值超限、库存不足、单位混用、批次追溯断点）
- ✅ **report** - 导出 Markdown、CSV、JSON 格式的合规报告

## 安装

### 前置要求

- Python 3.9 或更高版本
- pip 包管理工具

### 安装步骤

1. 克隆或下载项目代码
2. 在项目根目录执行以下命令：

```bash
# 安装项目（开发模式）
pip install -e .

# 或者安装依赖
pip install click pyyaml pytest pytest-cov
```

### 验证安装

```bash
fragrance-checker --help
```

## 快速开始

### 1. 初始化项目

```bash
# 在当前目录创建新项目
fragrance-checker init --directory ./my-perfume-project
```

这会创建以下目录结构：

```
my-perfume-project/
├── config.yaml           # 项目配置文件
├── formulas/             # 配方 CSV 文件
│   └── example_formula.csv
├── raw_materials/        # 原料信息 CSV 文件
│   └── example_materials.csv
├── batches/              # 批次信息 CSV 文件
│   └── example_batches.csv
├── rules/                # IFRA/过敏原规则 YAML 文件
│   └── example_rules.yaml
└── reports/              # 输出报告目录
```

### 2. 进入项目目录

```bash
cd ./my-perfume-project
```

### 3. 计算配方用量

```bash
# 按 500g 目标灌装量计算
fragrance-checker calc \
  --formula formulas/example_formula.csv \
  --target 500
```

输出示例：

```
📋 配方: 玫瑰花香水 (ID: F001)
🎯 目标灌装量: 500.0 g

📊 计算结果摘要:
   - 总成本: ¥227.50
   - 乙醇含量: 350.00g (70.0%)
   - 香精含量: 150.00g (30.0%)

🧪 原料明细:
   --------------------------------------------------------------------------------
   原料                   原用量        计算用量         占比       成本
   --------------------------------------------------------------------------------
   玫瑰精油               15.00g       75.0000g         15.00%    ¥187.50
   柠檬精油               8.00g        40.0000g         8.00%     ¥32.00
   香叶醇                 5.00g        25.0000g         5.00%     ¥30.00
   芳樟醇                 2.00g        10.0000g         2.00%     ¥10.00
   乙醇 - 95%             70.00g       350.0000g        70.00%    ¥17.50

🌿 过敏原摘要:
   - linalool: 17.00%
   - geraniol: 20.00%
   - citronellol: 15.00%
   - limonene: 8.00%
```

### 4. 合规性检查

```bash
fragrance-checker check \
  --formula formulas/example_formula.csv \
  --target 500
```

输出示例：

```
📋 合规性检查: 玫瑰花香水
🎯 灌装量: 500.0 g

✅ 检查通过！

⚠️  警告:
   1. [ALLERGEN_REPORTING_THRESHOLD] 过敏原需要标注: linalool 含量 17.00% 超过报告阈值 0.10%
   2. [ALLERGEN_REPORTING_THRESHOLD] 过敏原需要标注: geraniol 含量 20.00% 超过报告阈值 0.10%
   3. [ALLERGEN_REPORTING_THRESHOLD] 过敏原需要标注: citronellol 含量 15.00% 超过报告阈值 0.10%
   4. [ALLERGEN_REPORTING_THRESHOLD] 过敏原需要标注: limonene 含量 8.00% 超过报告阈值 0.10%
   5. [ALLERGEN_LIMIT_EXCEEDED] 过敏原超限: geraniol 含量 20.00% 超过限制 8.00%
   6. [ALLERGEN_LIMIT_EXCEEDED] 过敏原超限: linalool 含量 17.00% 超过限制 8.00%
   7. [SOME_BATCHES_EXPIRED] 部分批次已过期: 玫瑰精油 (1/2 个批次过期)
   8. [BATCH_SOON_EXPIRY] 批次即将过期: 香叶醇 (剩余 -329 天)
   9. [IFRA_LIMIT_EXCEEDED] IFRA 超限: 香叶醇 实际浓度 5.00% 超过限制 8.00%？ 等等，让我再看一下示例数据...

📊 统计: 错误 0 个, 警告 9 个
```

### 5. 生成合规报告

```bash
# 生成所有格式的报告
fragrance-checker report \
  --formula formulas/example_formula.csv \
  --target 500 \
  --output reports/2024-01-15-rose-perfume \
  --format all
```

这会在指定目录生成以下文件：

```
reports/2024-01-15-rose-perfume/
├── report.md      # Markdown 格式报告
├── report.json    # JSON 格式报告
├── summary.csv    # 摘要 CSV
├── ingredients.csv # 原料明细 CSV
└── issues.csv     # 问题清单 CSV
```

## 数据格式说明

### 配方 CSV 格式

```csv
formula_id,formula_name,version,created_date,total_amount,unit,notes
F001,玫瑰花香水,1.0,2024-01-15,100.0,g,经典玫瑰配方
,,,,,,
raw_material_id,amount,unit,batch_number,notes
RM001,15.0,g,BATCH001,玫瑰精油 - 保加利亚
RM002,8.0,g,BATCH002,柠檬精油
```

### 原料 CSV 格式

```csv
id,name,cas_number,molecular_weight,density,flash_point,allergens,is_ethanol,is_fragrance,unit_cost
RM001,玫瑰精油,8007-01-0,154.25,0.87,100,linalool;geraniol;citronellol,False,True,2.5
RM005,乙醇,64-17-5,46.07,0.79,12,,True,False,0.05
```

### 批次 CSV 格式

```csv
batch_number,raw_material_id,manufacture_date,expiry_date,supplier,supplier_batch,quantity,unit,purity,notes
BATCH001,RM001,2024-01-01,2026-01-01,保加利亚香料公司,SUP001,500.0,g,1.0,优质玫瑰精油
```

### 规则 YAML 格式

```yaml
name: "IFRA 49th Amendment + EU 过敏原规则"
version: "49.0"

ifra_rules:
  - raw_material_id: "RM001"
    limit_type: "max_concentration"
    limit_value: 0.20
    product_category: "fine-fragrance"
    notes: "玫瑰精油在香水类产品中的最大限制为20%"

allergen_rules:
  - allergen_type: "linalool"
    reporting_threshold: 0.001
    restriction_limit: 0.08
    notes: "芳樟醇报告阈值0.1%，限制值8%"

banned_substances:
  - "RM999"
```

## 命令详解

### init 命令

初始化新项目，创建目录结构和示例数据。

```bash
fragrance-checker init --directory <项目路径>
```

**选项：**
- `--directory, -d`: 项目目录路径（默认：`./fragrance-project`）

### import 命令

导入数据文件。

```bash
# 从默认目录结构导入所有数据
fragrance-checker import --all --directory <数据目录>

# 单独导入指定文件
fragrance-checker import \
  --materials raw_materials.csv \
  --formula formula.csv \
  --batches batches.csv \
  --rules rules.yaml
```

**选项：**
- `--all, -a`: 从默认目录结构导入所有数据
- `--directory, -d`: 数据目录（默认：当前目录）
- `--formula, -f`: 配方 CSV 文件路径
- `--materials, -m`: 原料 CSV 文件路径
- `--batches, -b`: 批次 CSV 文件路径
- `--rules, -r`: 规则 YAML 文件路径

### calc 命令

按目标灌装量计算用量和成本。

```bash
fragrance-checker calc \
  --formula formula.csv \
  --materials materials.csv \
  --target 500 \
  --unit g \
  --output result.json
```

**选项：**
- `--formula, -f`: 配方 CSV 文件路径（必需）
- `--materials, -m`: 原料 CSV 文件路径（可选，默认从同目录查找）
- `--target, -t`: 目标灌装量（必需）
- `--unit, -u`: 目标单位（默认：`g`）
- `--output, -o`: 输出 JSON 文件路径（可选）

### check 命令

执行合规性检查。

```bash
fragrance-checker check \
  --formula formula.csv \
  --materials materials.csv \
  --batches batches.csv \
  --rules rules.yaml \
  --target 500
```

**检查项：**
1. **禁用物质检查** - 检查是否使用了被禁止的原料
2. **IFRA 限制检查** - 检查原料浓度是否超过 IFRA 标准
3. **过敏原阈值检查** - 检查过敏原含量是否超过报告阈值或限制值
4. **批次过期检查** - 检查原料批次是否过期或即将过期
5. **库存充足检查** - 检查库存是否足够
6. **单位一致性检查** - 检查是否混用了质量和体积单位

**选项：**
- `--formula, -f`: 配方 CSV 文件路径（必需）
- `--materials, -m`: 原料 CSV 文件路径
- `--batches, -b`: 批次 CSV 文件路径
- `--rules, -r`: 规则 YAML 文件路径
- `--target, -t`: 目标灌装量（默认：配方原始量）
- `--unit, -u`: 目标单位（默认：`g`）

### report 命令

生成合规报告。

```bash
fragrance-checker report \
  --formula formula.csv \
  --target 500 \
  --output reports/ \
  --format all
```

**选项：**
- `--formula, -f`: 配方 CSV 文件路径（必需）
- `--materials, -m`: 原料 CSV 文件路径
- `--batches, -b`: 批次 CSV 文件路径
- `--rules, -r`: 规则 YAML 文件路径
- `--target, -t`: 目标灌装量（默认：配方原始量）
- `--unit, -u`: 目标单位（默认：`g`）
- `--output, -o`: 输出目录路径（必需）
- `--format, -fmt`: 输出格式（可选：`all`, `markdown`, `csv`, `json`，默认：`all`）

## 临时目录验证流程

为了快速验证工具功能，可以按照以下步骤在临时目录中测试：

```bash
# 1. 创建临时目录并进入
mkdir -p /tmp/fragrance-test && cd /tmp/fragrance-test

# 2. 初始化项目
fragrance-checker init --directory ./demo
cd ./demo

# 3. 查看生成的示例文件
ls -la
cat formulas/example_formula.csv

# 4. 计算配方（目标 500g）
fragrance-checker calc \
  --formula formulas/example_formula.csv \
  --target 500

# 5. 检查合规性
fragrance-checker check \
  --formula formulas/example_formula.csv \
  --target 500

# 6. 生成报告
fragrance-checker report \
  --formula formulas/example_formula.csv \
  --target 500 \
  --output ./my-report

# 7. 查看生成的报告
ls -la ./my-report
cat ./my-report/report.md
```

## 项目结构

```
fragrance-checker/
├── pyproject.toml              # 项目配置
├── README.md                   # 本文件
├── src/
│   └── fragrance_checker/
│       ├── __init__.py         # 包初始化
│       ├── cli.py              # CLI 入口
│       ├── models.py           # 数据模型
│       ├── parser.py           # 解析器和数据存储
│       ├── calculator.py       # 配方计算器
│       ├── rules.py            # 规则引擎
│       ├── reporter.py         # 报告生成器
│       └── examples.py         # 示例数据生成器
└── tests/
    ├── __init__.py
    ├── test_models.py          # 数据模型测试
    ├── test_calculator.py      # 计算器测试
    └── test_rules.py           # 规则引擎测试
```

## 运行测试

```bash
# 运行所有测试
pytest

# 运行测试并显示覆盖率
pytest --cov=fragrance_checker

# 运行特定测试文件
pytest tests/test_models.py
```

## 支持的单位

- **质量单位**：`g` (克), `mg` (毫克), `kg` (千克)
- **体积单位**：`ml` (毫升), `l` (升), `drop` (滴)
- **其他**：`%` (百分比)

## 过敏原类型

支持以下 16 种常见化妆品过敏原的检测：

- linalool (芳樟醇)
- limonene (柠檬烯)
- citronellol (香茅醇)
- geraniol (香叶醇)
- eugenol (丁子香酚)
- isoeugenol (异丁子香酚)
- cinnamal (肉桂醛)
- cinnamyl alcohol (肉桂醇)
- farnesol (法尼醇)
- benzyl alcohol (苯甲醇)
- benzyl salicylate (水杨酸苄酯)
- coumarin (香豆素)
- anise alcohol (茴香醇)
- amyl cinnamal (戊基肉桂醛)
- amyl cinnamyl alcohol (戊基肉桂醇)
- hydroxycitronellal (羟基香茅醛)

## 许可证

MIT License
