# 鱼塘增氧调度计算器

水产实验室专用工具，用于快速估算夜间缺氧风险和优化增氧机排班。

## 功能特性

- **数据解析**: 支持CSV导入、单位校验、缺测值自动插值
- **溶氧模型**: 基于水温、鱼密度、投喂量和天气的溶氧消耗/复氧模型
- **风险预测**: 夜间缺氧风险曲线预测
- **调度优化**: 智能增氧机排班，支持三种优化策略
- **电费估算**: 分时电价下的电费精确计算
- **报告导出**: Markdown格式报告和CSV结果导出

## 项目结构

```
pond_oxygen_calculator/
├── __init__.py           # 包初始化
├── __main__.py           # 主入口
├── cli.py                # 命令行界面
├── data_parser.py        # 数据解析模块
├── model_params.py       # 模型参数模块
├── calculation_engine.py # 计算引擎模块
├── scheduling_optimizer.py # 调度优化模块
├── report_exporter.py    # 报告导出模块
├── config/
│   ├── __init__.py
│   └── default_config.py # 默认配置
└── tests/                # 测试用例
    ├── __init__.py
    ├── test_data_parser.py
    ├── test_calculation_engine.py
    └── test_scheduling.py

examples/
├── __init__.py
└── sample_input.csv      # 示例数据

requirements.txt          # 依赖包
setup.py                  # 安装配置
README.md                 # 本文档
```

## 安装说明

### 1. 环境要求

- Python 3.8+
- pip 包管理器

### 2. 安装依赖

```bash
cd /path/to/project
pip install -r requirements.txt
```

### 3. 安装为可执行包（可选）

```bash
pip install -e .
```

安装后可以使用 `pond-calc` 命令直接运行。

## 快速开始

### 步骤 1: 生成示例数据（或准备自己的CSV）

```bash
# 生成包含3个池塘24小时数据的示例CSV
python -m pond_oxygen_calculator generate_sample examples/test_data.csv --pond-count 3 --hours 24
```

参数说明：
- `--pond-count, -p`: 池塘数量（默认3）
- `--hours, -h`: 数据时长（小时，默认24）
- `--add-errors, -e`: 添加错误数据用于测试验证功能

### 步骤 2: 验证数据格式

```bash
# 验证数据格式和内容
python -m pond_oxygen_calculator validate examples/sample_input.csv --verbose
```

### 步骤 3: 运行计算并生成报告

```bash
# 基本用法
python -m pond_oxygen_calculator calculate examples/sample_input.csv

# 指定输出目录和报告名称
python -m pond_oxygen_calculator calculate examples/sample_input.csv \
    --output-dir ./output \
    --report-name my_report.md

# 使用详细参数
python -m pond_oxygen_calculator calculate examples/sample_input.csv \
    --aerator-count 4 \
    --pond-area 1.0 \
    --water-depth 1.5 \
    --fish-species tilapia \
    --strategy balanced \
    --verbose
```

### 步骤 4: 查看输出结果

计算完成后，输出目录包含：

```
output/
├── aeration_report.md      # 详细的Markdown报告
└── csv_results/
    ├── hourly_results.csv      # 每小时计算结果
    ├── pond_summary.csv        # 各池塘汇总
    ├── aeration_schedules.csv  # 增氧机排班表
    └── schedule_summary.csv    # 调度汇总
```

## 命令详解

### calculate 命令

主计算命令，执行完整的风险分析和调度优化。

```bash
python -m pond_oxygen_calculator calculate INPUT_CSV [OPTIONS]
```

**参数说明**:

| 参数 | 缩写 | 默认值 | 说明 |
|------|------|--------|------|
| `--output-dir` | `-o` | `.` | 输出目录 |
| `--report-name` | `-r` | `aeration_report.md` | 报告文件名 |
| `--aerator-count` | `-a` | `4` | 每塘增氧机数量 |
| `--pond-area` | `-p` | `1.0` | 池塘面积（公顷） |
| `--water-depth` | `-d` | `1.5` | 水深（米） |
| `--fish-species` | `-s` | `tilapia` | 养殖品种 |
| `--strategy` | `-t` | `balanced` | 优化策略 |
| `--no-csv` | | 不导出CSV |
| `--verbose` | `-v` | 显示详细输出 |

**优化策略**:
- `balanced`: 平衡策略（默认）- 在安全和成本间优化
- `cost_saving`: 成本节约策略 - 优先在谷电时段开机
- `safety_first`: 安全优先策略 - 提前开机预防缺氧

**养殖品种**:
- `tilapia`: 罗非鱼（默认）
- `carp`: 鲤鱼
- `catfish`: 鲶鱼
- `shrimp`: 虾类

### generate_sample 命令

生成示例数据用于测试。

```bash
python -m pond_oxygen_calculator generate_sample OUTPUT_CSV [OPTIONS]
```

**参数说明**:
- `--pond-count, -p`: 池塘数量（默认3）
- `--hours, -h`: 数据时长（小时，默认24）
- `--add-errors, -e`: 添加错误数据用于测试

### validate 命令

验证CSV数据格式和内容。

```bash
python -m pond_oxygen_calculator validate INPUT_CSV [OPTIONS]
```

**参数说明**:
- `--verbose, -v`: 显示详细统计信息

## 输入数据格式

### CSV字段说明

| 字段名 | 类型 | 必需 | 说明 | 示例 |
|--------|------|------|------|------|
| `timestamp` | 日期时间 | 是 | 记录时间 | `2026-05-02 06:00:00` |
| `pond_id` | 字符串 | 是 | 池塘标识 | `P01`, `塘1` |
| `temperature` | 数值 | 是 | 水温（°C） | `25.5` |
| `dissolved_oxygen` | 数值 | 是 | 溶氧（mg/L） | `7.2` |
| `fish_density` | 数值 | 是 | 鱼密度（kg/ha） | `5200` |
| `feeding_rate` | 数值 | 是 | 日投喂量（kg/ha/day） | `145.5` |
| `weather` | 枚举 | 是 | 天气类型 | 见下方说明 |
| `pond_area` | 数值 | 否 | 池塘面积（ha） | `1.0` |
| `water_depth` | 数值 | 否 | 水深（m） | `1.5` |
| `aerator_count` | 整数 | 否 | 增氧机数量 | `4` |

### 天气类型有效值

| 值 | 说明 | 光合效率 | 复氧效率 |
|-----|------|----------|----------|
| `sunny` | 晴天 | 100% | 100% |
| `cloudy` | 多云 | 50% | 90% |
| `rainy` | 雨天 | 20% | 120% |
| `stormy` | 暴风雨 | 10% | 150% |
| `foggy` | 雾天 | 30% | 70% |

### 数据示例

```csv
timestamp,pond_id,temperature,dissolved_oxygen,fish_density,feeding_rate,weather,pond_area,water_depth,aerator_count
2026-05-02 06:00:00,P01,23.5,6.8,5200,145.5,sunny,1.0,1.5,4
2026-05-02 07:00:00,P01,24.2,7.2,5200,145.5,sunny,1.0,1.5,4
2026-05-02 08:00:00,P01,25.0,7.8,5200,145.5,sunny,1.0,1.5,4
```

## 模型说明

### 溶氧平衡模型

系统基于以下溶氧平衡方程计算：

```
DO(t+1) = DO(t) + 光合作用 + 大气复氧 + 机械增氧
                - 鱼类呼吸 - 浮游植物呼吸 - 底质耗氧
```

### 溶氧风险阈值

- **临界值**: < 3.0 mg/L（鱼类可能死亡）
- **警告值**: < 4.0 mg/L（鱼类应激反应）
- **安全值**: ≥ 4.0 mg/L

### 电价时段（分时电价）

| 时段 | 时间 | 电价（元/kWh） |
|------|------|----------------|
| 峰时 | 9:00 - 12:00 | 1.2 |
| 平时 | 7:00 - 9:00, 12:00 - 23:00 | 0.8 |
| 谷时 | 23:00 - 7:00 | 0.4 |

## 运行测试

### 运行单元测试

```bash
# 运行所有测试
pytest -v

# 运行特定模块测试
pytest pond_oxygen_calculator/tests/test_data_parser.py -v
pytest pond_oxygen_calculator/tests/test_calculation_engine.py -v
pytest pond_oxygen_calculator/tests/test_scheduling.py -v

# 生成覆盖率报告
pytest --cov=pond_oxygen_calculator -v
```

## 验证完整流程

按照以下步骤验证系统的完整功能：

### 验证步骤 1: 环境检查

```bash
# 检查Python版本
python --version

# 检查依赖是否安装
pip list | grep -E "numpy|pandas|scipy|click|pytest"
```

### 验证步骤 2: 生成测试数据

```bash
# 生成正常示例数据
python -m pond_oxygen_calculator generate_sample test_normal.csv --pond-count 2 --hours 12

# 生成包含错误的数据（用于测试验证功能）
python -m pond_oxygen_calculator generate_sample test_with_errors.csv --pond-count 2 --hours 12 --add-errors
```

### 验证步骤 3: 测试数据验证功能

```bash
# 验证正常数据 - 应该通过
python -m pond_oxygen_calculator validate test_normal.csv --verbose

# 验证错误数据 - 应该报错
python -m pond_oxygen_calculator validate test_with_errors.csv
```

预期结果：
- 正常数据：显示"✅ 数据验证通过!"
- 错误数据：显示具体的错误信息（如温度超出范围、无效天气类型等）

### 验证步骤 4: 运行完整计算

```bash
# 使用示例数据运行完整计算
python -m pond_oxygen_calculator calculate examples/sample_input.csv \
    --output-dir ./test_output \
    --strategy balanced \
    --verbose
```

### 验证步骤 5: 检查输出文件

```bash
# 检查输出目录结构
ls -la ./test_output/
ls -la ./test_output/csv_results/

# 查看报告开头
head -50 ./test_output/aeration_report.md
```

预期输出文件：
- `test_output/aeration_report.md` - Markdown格式报告
- `test_output/csv_results/hourly_results.csv` - 每小时计算结果
- `test_output/csv_results/pond_summary.csv` - 池塘汇总
- `test_output/csv_results/aeration_schedules.csv` - 排班表
- `test_output/csv_results/schedule_summary.csv` - 调度汇总

### 验证步骤 6: 测试不同优化策略

```bash
# 成本节约策略
python -m pond_oxygen_calculator calculate examples/sample_input.csv \
    --output-dir ./test_output_cost \
    --strategy cost_saving

# 安全优先策略
python -m pond_oxygen_calculator calculate examples/sample_input.csv \
    --output-dir ./test_output_safety \
    --strategy safety_first
```

比较三个策略的输出：
- 成本节约策略：应该在谷电时段安排更多增氧
- 安全优先策略：应该安排更长的增氧时间
- 平衡策略：介于两者之间

### 验证步骤 7: 运行单元测试

```bash
# 运行所有测试
pytest -v

# 如果测试通过，输出类似：
# ================= test session starts =================
# collected 18 items
# 
# pond_oxygen_calculator/tests/test_data_parser.py ...  PASSED
# pond_oxygen_calculator/tests/test_calculation_engine.py ... PASSED
# pond_oxygen_calculator/tests/test_scheduling.py ... PASSED
# 
# ================= 18 passed in X.XXs =================
```

## 常见问题

### Q1: 数据验证失败怎么办？

检查错误提示，确保：
- 所有必需字段都存在
- 数值在有效范围内（水温0-40°C，溶氧0-15 mg/L等）
- 天气类型是有效值（sunny, cloudy, rainy, stormy, foggy）
- 时间戳格式正确

### Q2: 如何处理缺测值？

系统会自动对缺测值进行线性插值，但有以下限制：
- 最大插值间隔：4小时
- 时间戳必须连续可排序

### Q3: 如何自定义模型参数？

修改 `pond_oxygen_calculator/config/default_config.py` 文件中的参数，或在代码中传入自定义配置：

```python
from pond_oxygen_calculator.config import DEFAULT_CONFIG

custom_config = DEFAULT_CONFIG.copy()
custom_config["oxygen"]["critical_level"] = 2.5  # 修改临界溶氧
custom_config["electricity"]["price_per_kwh"] = 0.8  # 修改电价

# 使用自定义配置
from pond_oxygen_calculator import CalculationEngine
engine = CalculationEngine(config=custom_config)
```

## 开发说明

### 添加新的养殖品种

在 `pond_oxygen_calculator/model_params.py` 的 `FISH_SPECIES` 字典中添加新品种：

```python
FISH_SPECIES = {
    # ... 现有品种
    "my_species": FishSpeciesParams(
        name="My Fish",
        respiration_rate=0.05,  # 呼吸速率
        optimal_temp_range=(22, 28),  # 最适温度范围
        stress_temp_low=15,  # 低温胁迫阈值
        stress_temp_high=33,  # 高温胁迫阈值
        lethal_do_level=2.0,  # 致死溶氧
    ),
}
```

### 添加新的天气类型

在 `pond_oxygen_calculator/model_params.py` 的 `WEATHER_PARAMS` 字典中添加新天气：

```python
WEATHER_PARAMS = {
    # ... 现有天气
    "my_weather": WeatherParams(
        weather_type="my_weather",
        photosynthesis_factor=0.7,  # 光合效率因子
        reaeration_factor=1.1,  # 复氧效率因子
        cloud_cover=0.5,  # 云量
    ),
}
```

## 许可证

本项目仅供学术研究和实验室使用。

## 联系方式

如有问题或建议，请联系项目维护者。
