# 冻干曲线复盘器 (Freeze Dryer Reviewer)

为生物制剂工艺工程师设计的本地科学计算CLI工具，用于分析冻干工艺数据，检测工艺问题，模拟升华前沿和残余水分。

## 功能特性

- **import** - 导入并校验多源曲线数据（搁板温度、产品温度、腔体真空、称重水分、配方批量）
- **simulate** - 科学计算估算升华前沿和残余水分
- **check** - 规则引擎检测：真空波动、温度越界（塌陷温度被越过）、平台期不足（二次干燥时间不足）、传感器漂移、过早升温（一次干燥没结束就升温）
- **compare** - 对比两批工艺数据
- **report** - 导出 Markdown、CSV、JSON 三种格式的分析报告

## 安装

### 环境要求

- Python 3.8 或更高版本

### 安装步骤

```bash
# 克隆或下载项目到本地
cd /path/to/freeze-dryer-reviewer

# 安装依赖
pip install -r requirements.txt

# 以开发模式安装
pip install -e .
```

## 快速开始

### 1. 使用示例数据验证

项目包含示例数据，可直接用于验证功能：

```bash
# 查看版本
fd-reviewer --version

# 导入示例数据
fd-reviewer import --input-dir examples/batch_001 --batch-id TEST-001

# 执行模拟计算
fd-reviewer simulate --input-dir examples/batch_001

# 执行规则检查
fd-reviewer check --input-dir examples/batch_001 --collapse-temp -15

# 对比两批数据
fd-reviewer compare examples/batch_001 examples/batch_002

# 生成完整报告
fd-reviewer report --input-dir examples/batch_001 -f all -o output/report --include-simulate --include-check
```

### 2. 临时目录验证流程

在正式使用生产数据前，建议使用临时目录进行验证：

```bash
# 创建临时目录
mkdir -p /tmp/fd_test

# 复制示例数据到临时目录
cp -r examples/batch_001 /tmp/fd_test/

# 步骤1: 导入数据并验证
fd-reviewer import --input-dir /tmp/fd_test/batch_001 --output /tmp/fd_test/import_result.json

# 步骤2: 执行模拟计算
fd-reviewer simulate --input-dir /tmp/fd_test/batch_001 --output /tmp/fd_test/sim_result.json

# 步骤3: 执行规则检查
fd-reviewer check --input-dir /tmp/fd_test/batch_001 --collapse-temp -15 --output /tmp/fd_test/check_result.json

# 步骤4: 生成完整报告
fd-report report --input-dir /tmp/fd_test/batch_001 -f all -o /tmp/fd_test/report --include-simulate --include-check

# 查看生成的文件
ls -la /tmp/fd_test/
```

## 数据格式说明

### CSV 文件格式

工具支持从目录自动解析以下命名规范的CSV文件：

| 文件名关键字 | 数据类型 | 必需列 | 示例 |
|-------------|---------|--------|------|
| `shelf_temp` 或 `搁板温度` | 搁板温度 | time, temperature | 见下方 |
| `product_temp` 或 `产品温度` | 产品温度 | time, temperature | 见下方 |
| `vacuum` 或 `真空` | 腔体真空 | time, vacuum | 见下方 |
| `moisture` 或 `水分` | 水分数据 | time, moisture_pct | 见下方 |
| `recipe` 或 `配方` | 配方信息 | key, value | 见下方 |

### 搁板温度/产品温度 CSV 示例

```csv
time,temperature
2024-01-15 08:00:00,20.0
2024-01-15 08:15:00,15.0
2024-01-15 08:30:00,10.0
2024-01-15 08:45:00,5.0
2024-01-15 09:00:00,0.0
```

### 真空度 CSV 示例

```csv
time,vacuum
2024-01-15 08:00:00,760000
2024-01-15 09:00:00,100
2024-01-15 10:00:00,80
2024-01-15 11:00:00,75
```

### 水分数据 CSV 示例

```csv
time,moisture_pct,sample_id,location
2024-01-15 17:30:00,2.8,S001,上层
2024-01-15 17:35:00,2.5,S002,中层
2024-01-15 17:40:00,2.9,S003,下层
```

### 配方 CSV 示例

```csv
key,value
product_name,单克隆抗体注射液
batch_size_ml,500
vial_count,100
fill_volume_ml,5
collapse_temp_c,-15
eutectic_temp_c,-18
formulation,10mM 组氨酸缓冲液
concentration_mg_ml,50
```

### 时间格式支持

工具支持以下时间格式：
- `%Y-%m-%d %H:%M:%S` (如: 2024-01-15 08:00:00)
- `%Y-%m-%d %H:%M` (如: 2024-01-15 08:00)
- `%m/%d/%Y %H:%M:%S` (如: 01/15/2024 08:00:00)
- `%H:%M:%S` (如: 08:00:00) - 使用当天日期
- `%H:%M` (如: 08:00) - 使用当天日期

## CLI 命令详解

### import - 导入并校验数据

```bash
# 从目录导入（自动识别文件名）
fd-reviewer import --input-dir /path/to/data --batch-id BATCH-001

# 从指定文件导入
fd-reviewer import \
  --shelf-temp /path/to/shelf_temp.csv \
  --product-temp /path/to/product_temp.csv \
  --vacuum /path/to/vacuum.csv \
  --moisture /path/to/moisture.csv \
  --recipe /path/to/recipe.csv \
  --batch-id BATCH-001 \
  --output /path/to/result.json

# 详细输出
fd-reviewer import --input-dir /path/to/data --verbose
```

### simulate - 模拟计算

```bash
# 执行模拟计算
fd-reviewer simulate --input-dir /path/to/data

# 保存结果
fd-reviewer simulate --input-dir /path/to/data --output /path/to/sim_result.json
```

模拟计算内容：
- **升华前沿估算**：基于搁板温度与产品温度差异估算升华界面位置
- **残余水分估算**：基于Arrhenius方程估算干燥速率和残余水分

### check - 规则检查

```bash
# 执行所有规则检查
fd-reviewer check --input-dir /path/to/data

# 指定塌陷温度
fd-reviewer check --input-dir /path/to/data --collapse-temp -15

# 保存检查结果
fd-reviewer check --input-dir /path/to/data --output /path/to/check_result.json
```

规则检查项：

| 规则 | 严重程度 | 检测内容 |
|------|---------|---------|
| 真空波动检测 | WARNING | 真空度波动超过阈值(默认50mTorr) |
| 温度越界检测 | CRITICAL | 产品温度超过塌陷温度 |
| 平台期不足检测 | WARNING | 二次干燥时间不足 |
| 传感器漂移检测 | WARNING | 传感器读数异常漂移 |
| 过早升温检测 | CRITICAL | 一次干燥未完成就升温 |

### compare - 批次对比

```bash
# 对比两批数据
fd-reviewer compare /path/to/batch1 /path/to/batch2

# 保存对比结果
fd-reviewer compare /path/to/batch1 /path/to/batch2 --output /path/to/compare.json
```

对比内容：
- 搁板温度均值对比
- 产品温度均值对比
- 真空度均值对比
- 配方参数差异检测

### report - 生成报告

```bash
# 生成Markdown报告
fd-reviewer report --input-dir /path/to/data -f markdown -o /path/to/report

# 生成所有格式报告
fd-reviewer report --input-dir /path/to/data -f all -o /path/to/report

# 包含模拟和检查结果
fd-reviewer report --input-dir /path/to/data -f all -o /path/to/report --include-simulate --include-check
```

支持的输出格式：
- `markdown` - Markdown格式报告
- `csv` - CSV格式报告
- `json` - JSON格式报告
- `all` - 生成所有三种格式

## 项目结构

```
freeze-dryer-reviewer/
├── src/
│   └── freeze_dryer_reviewer/
│       ├── __init__.py
│       ├── cli.py              # CLI入口
│       ├── models/             # 数据模型
│       │   ├── __init__.py
│       │   ├── batch.py        # 批次数据模型
│       │   └── sensors.py      # 传感器数据模型
│       ├── parser/             # 解析校验
│       │   ├── __init__.py
│       │   ├── csv_parser.py   # CSV解析器
│       │   └── validator.py    # 数据验证器
│       ├── simulator/          # 计算模型
│       │   ├── __init__.py
│       │   ├── sublimation_front.py  # 升华前沿模拟
│       │   └── moisture_estimator.py # 残余水分估算
│       ├── rules/              # 规则引擎
│       │   ├── __init__.py
│       │   └── rule_engine.py  # 规则引擎实现
│       └── reporter/           # 报告生成
│           ├── __init__.py
│           └── reporter.py     # Markdown/CSV/JSON报告
├── examples/
│   ├── batch_001/              # 示例批次1
│   │   ├── shelf_temp.csv
│   │   ├── product_temp.csv
│   │   ├── vacuum.csv
│   │   ├── moisture.csv
│   │   └── recipe.csv
│   └── batch_002/              # 示例批次2
│       ├── shelf_temp.csv
│       ├── product_temp.csv
│       └── vacuum.csv
├── tests/
│   ├── __init__.py
│   ├── test_models.py          # 数据模型测试
│   └── test_rules.py           # 规则引擎测试
├── setup.py
├── requirements.txt
└── README.md
```

## 运行测试

```bash
# 运行所有测试
python -m pytest tests/ -v

# 运行特定测试
python -m pytest tests/test_models.py -v
python -m pytest tests/test_rules.py -v
```

## 核心算法原理

### 升华前沿模拟

基于热传导方程，通过以下参数估算升华界面：
- 搁板温度与产品温度的差异
- 冰的升华热 (2835 J/g)
- 产品层热导率 (0.1 W/(m·K))
- 西林瓶尺寸和灌装体积

### 残余水分估算

基于Arrhenius方程估算：
- 解吸活化能 (50 kJ/mol)
- 温度对干燥速率的指数影响
- 区分游离水和结合水的去除特性

### 规则引擎

规则引擎包含5条核心规则，使用可配置的参数进行检测：

```python
# 默认参数
VacuumFluctuationRule: threshold=50mTorr, window=5min
TemperatureExceedanceRule: safety_margin=2°C
PlateauInsufficiencyRule: min_secondary_duration=180min
SensorDriftRule: drift_threshold=5°C
PrematureHeatingRule: temp_rise_threshold=10°C
```

## 常见问题

**Q: 如何处理不同设备导出的不同时间格式？**

A: 工具内置了多种时间格式解析器，会自动尝试解析。如果使用特殊格式，请确保CSV中包含完整的日期时间信息。

**Q: 没有配方信息（塌陷温度）时如何进行温度越界检查？**

A: 如果没有提供recipe.csv，工具会使用默认阈值(-10°C)进行检测，并在报告中给出警告。建议使用 `--collapse-temp` 参数指定塌陷温度。

**Q: 如何判断一次干燥是否完成？**

A: 工具通过以下指标综合判断：
1. 产品温度是否达到搁板温度
2. 温度差异是否稳定减小
3. 升华速率估算是否趋近于零

## 许可证

本项目仅供学习和内部使用。

## 联系方式

如有问题或建议，请提交Issue或联系开发团队。
