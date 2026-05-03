# 育苗池水质换水推演器

水产育苗场水质科学计算工具 - 帮助技术员根据氨氮、亚硝酸盐、pH、盐度、投喂量和增氧记录科学判断换水或补菌时机，避免经验判断导致幼苗刺激死亡。

## 功能特性

- 📊 **水质模拟**: 基于数学模型推演24小时水质变化
- ⚠️ **风险检测**: 自动检测pH突变、盐度梯度、药剂间隔冲突、超阈值风险
- 💡 **智能推荐**: 计算换水比例、曝气方案、补菌建议
- 📋 **方案对比**: 支持对比两套处置方案的效果
- 📄 **报告导出**: 导出 Markdown 处置单、CSV 曲线、JSON 审计包

## 项目结构

```
water_quality_simulator/
├── __init__.py
├── cli.py                    # 命令行入口
├── models/                   # 数据模型
│   ├── __init__.py
│   ├── pond.py              # 池塘配置/状态
│   ├── sensor.py            # 传感器记录
│   ├── parameters.py        # 水质/阈值/模拟参数
│   ├── scenario.py          # 推演方案
│   └── report.py            # 分析报告
├── parser/                   # 解析校验
│   ├── __init__.py
│   ├── csv_loader.py        # CSV导入器
│   └── validator.py         # 数据验证器
├── simulation/               # 数值模拟
│   ├── __init__.py
│   ├── water_quality_model.py  # 水质数学模型
│   └── simulator.py         # 24小时推演器
├── rules/                    # 规则引擎
│   ├── __init__.py
│   ├── risk_engine.py       # 风险检测引擎
│   └── recommendation_engine.py  # 推荐引擎
├── comparison/               # 方案对比
│   ├── __init__.py
│   └── scenario_comparison.py
└── exporter/                 # 报告导出
    ├── __init__.py
    ├── markdown_exporter.py # Markdown处置单
    ├── csv_exporter.py      # CSV曲线
    └── json_exporter.py     # JSON审计包

examples/                    # 示例数据
├── pond_config.csv         # 池塘配置
├── water_quality.csv       # 水质状态
├── sensor_records.csv      # 传感器记录
└── source_water.csv        # 水源参数

tests/                       # 测试用例
└── test_*.py

pyproject.toml              # 项目配置
requirements.txt            # 依赖列表
```

## 安装

```bash
# 克隆或下载项目后，安装依赖
pip install -r requirements.txt

# 或使用 pip install -e . 安装为可编辑模式
pip install -e .
```

## 快速开始

### 1. 准备数据文件

项目包含示例数据文件在 `examples/` 目录下：

- **pond_config.csv**: 池塘基本配置
- **water_quality.csv**: 当前水质状态
- **sensor_records.csv**: 历史传感器记录
- **source_water.csv**: 水源参数

### 2. 运行分析

```bash
# 基本分析
python -m water_quality_simulator.cli analyze --water-quality examples/water_quality.csv

# 完整分析（包含池塘配置、传感器记录）
python -m water_quality_simulator.cli analyze \
    --pond-config examples/pond_config.csv \
    --water-quality examples/water_quality.csv \
    --sensor-records examples/sensor_records.csv \
    --source-water examples/source_water.csv

# 运行方案对比
python -m water_quality_simulator.cli analyze \
    --water-quality examples/water_quality.csv \
    --compare

# 指定投喂率和输出目录
python -m water_quality_simulator.cli analyze \
    --water-quality examples/water_quality.csv \
    --feed-rate 0.8 \
    --output-dir ./results
```

### 3. 查看输出

报告将输出到指定的 `output-dir`（默认为 `./output`）：

- `处置单_*.md`: Markdown 格式的处置单
- `模拟曲线_*.csv`: 24小时水质变化曲线数据
- `审计包_*.json`: 完整的JSON审计数据
- `方案对比_*.md`: 方案对比报告（使用 `--compare` 时）

## 数据文件格式说明

### 池塘配置 (pond_config.csv)

| 字段 | 说明 | 示例 |
|------|------|------|
| pond_id | 池塘唯一标识 | pond_001 |
| pond_name | 池塘名称 | 南美白对虾育苗池1号 |
| volume | 水体体积(立方米) | 100 |
| area | 水面面积(平方米) | 50 |
| depth | 平均水深(米) | 2.0 |
| species | 养殖品种 | 南美白对虾 |
| stage | 育苗阶段 | 仔虾期(P1-P5) |
| stocking_density | 放养密度(尾/立方米) | 5000 |
| notes | 备注 | 第3天育苗 |

### 水质状态 (water_quality.csv)

| 字段 | 说明 | 单位 |
|------|------|------|
| timestamp | 记录时间 | - |
| temperature | 水温 | ℃ |
| ph | pH值 | - |
| ammonia_nitrogen | 氨氮 | mg/L |
| nitrite | 亚硝酸盐 | mg/L |
| salinity | 盐度 | ‰ |
| dissolved_oxygen | 溶解氧 | mg/L |
| turbidity | 浊度(可选) | NTU |
| alkalinity | 碱度(可选) | mg/L |
| hardness | 硬度(可选) | mg/L |

### 传感器记录 (sensor_records.csv)

| 字段 | 说明 |
|------|------|
| record_id | 记录唯一标识 |
| pond_id | 池塘ID |
| timestamp | 记录时间 |
| sensor_type | 传感器类型: temperature, ph, ammonia_nitrogen, nitrite, salinity, dissolved_oxygen |
| sensor_id | 传感器ID(可选) |
| value | 测量值 |
| unit | 单位 |
| location | 测量位置(可选) |
| is_valid | 是否有效 |
| invalid_reason | 无效原因(可选) |

## 水质模型说明

### 硝化作用模型

```
硝化速率 = 基础速率 × 温度因子 × pH因子 × 溶氧因子 × 底物因子

温度因子 = e^(0.069 × (T - 20))
pH因子 = 1 / (1 + 10^(7.8 - pH))
溶氧因子 = DO / (DO + 0.5)
底物因子 = NH3 / (NH3 + 1.0)
```

### 氨氮产生模型

```
氨氮产生量 = 投喂率 × 蛋白质含量% × 0.16 × 排泄系数
排泄系数 ≈ 0.03 (饲料氮转化为氨氮的比例)
```

### 换水效果模型

```
新浓度 = 原浓度 × (1 - 换水比例) + 水源浓度 × 换水比例
```

### 曝气效果模型

```
溶氧增加量 = 饱和溶氧差 × (1 - e^(-曝气速率 × 时间))
饱和溶氧 = f(温度, 盐度)
```

## 风险检测规则

| 风险类型 | 检测条件 | 默认阈值 |
|----------|----------|----------|
| 氨氮超标 | 氨氮 > 阈值 | 警告0.5mg/L, 危险1.0mg/L |
| 亚硝酸盐超标 | 亚硝酸盐 > 阈值 | 警告0.15mg/L, 危险0.3mg/L |
| pH突变 | pH变化速率 > 阈值 | 0.3单位/小时 |
| pH超出范围 | pH < 7.0 或 pH > 8.5 | 7.0-8.5 |
| 盐度梯度 | 池塘与水源盐度差 > 阈值 | 2.0‰ |
| 溶氧偏低 | 溶解氧 < 阈值 | 警告4.0mg/L, 临界2.0mg/L |
| 益生菌间隔 | 施用间隔 < 最小值 | 24小时 |

## 推荐算法说明

### 换水比例计算

```
基础比例 = 风险等级系数 × 超标倍数 × 安全系数

风险等级系数:
- 临界风险: 0.3-0.5
- 危险风险: 0.2-0.4
- 警告风险: 0.1-0.25

约束条件:
- 单次换水 ≤ 50%
- 盐度差 > 2‰ 时, 限制换水 ≤ 20%
- pH差 > 0.5 时, 限制换水 ≤ 25%
```

### 曝气推荐

```
强度选择:
- 临界溶氧(<2.0mg/L): 高强度曝气 + 增氧机
- 偏低溶氧(<4.0mg/L): 中等强度曝气
- 预防性维护: 低强度曝气

持续时间:
- 临界状态: 24小时持续
- 警告状态: 12小时
- 预防性: 8小时
```

### 益生菌推荐

| 类型 | 适用情况 | 推荐剂量 |
|------|----------|----------|
| 硝化细菌 | 氨氮偏高为主 | 5-20 g/m³ |
| 光合细菌 | 亚硝酸盐偏高为主 | 10-25 g/m³ |
| EM菌 | 综合水质问题 | 5-15 g/m³ |
| 芽孢杆菌 | 预防性维护 | 10-30 g/m³ |

## 验证流程

### 1. 环境验证

```bash
# 检查Python版本 (要求 >= 3.9)
python --version

# 安装依赖
pip install -r requirements.txt

# 验证依赖安装
python -c "import numpy; import pandas; import pydantic; print('依赖安装成功')"
```

### 2. 功能验证

```bash
# 运行示例数据分析
python -m water_quality_simulator.cli analyze \
    --pond-config examples/pond_config.csv \
    --water-quality examples/water_quality.csv \
    --output-dir test_output

# 检查输出文件
ls -la test_output/

# 查看生成的处置单
cat test_output/处置单_*.md
```

### 3. 单元测试

```bash
# 运行所有测试
pytest tests/ -v

# 运行特定模块测试
pytest tests/test_models.py -v
pytest tests/test_simulation.py -v

# 生成覆盖率报告
pytest tests/ --cov=water_quality_simulator --cov-report=html
```

### 4. 完整验证示例

```bash
# 1. 安装依赖
pip install -e .

# 2. 运行完整分析
python -m water_quality_simulator.cli analyze \
    -c examples/pond_config.csv \
    -w examples/water_quality.csv \
    -s examples/sensor_records.csv \
    -sw examples/source_water.csv \
    -f 0.6 \
    -cmp \
    -o ./validation_output

# 3. 验证输出
echo "=== 输出文件列表 ==="
ls -la ./validation_output/

echo -e "\n=== 处置单摘要 ==="
grep -A 5 "风险评估" ./validation_output/处置单_*.md | head -30

echo -e "\n=== 方案对比摘要 ==="
grep -A 3 "推荐结论" ./validation_output/方案对比_*.md

echo -e "\n=== 验证完成 ==="
```

## API 使用示例

```python
from water_quality_simulator.models import (
    PondConfig, PondState, WaterQualityParams, SimulationParams, ThresholdParams
)
from water_quality_simulator.parser import CSVLoader, DataValidator
from water_quality_simulator.simulation import WaterQualitySimulator
from water_quality_simulator.rules import RiskEngine, RecommendationEngine
from water_quality_simulator.exporter import MarkdownExporter, CSVExporter, JSONExporter

# 1. 加载数据
loader = CSVLoader()
pond_config = loader.load_pond_config("examples/pond_config.csv")
initial_state = loader.load_water_quality_state("examples/water_quality.csv", pond_config.pond_id)

# 2. 数据验证
validator = DataValidator()
val_result = validator.validate_complete_data(pond_config, initial_state)
if not val_result.is_valid:
    print("数据验证失败:", val_result.errors)

# 3. 风险检测
thresholds = ThresholdParams()
risk_engine = RiskEngine(thresholds)
risks = risk_engine.check_initial_state_risks(initial_state)

# 4. 生成推荐
rec_engine = RecommendationEngine(thresholds)
source_water = {"ph": 8.0, "salinity": 25, "ammonia_nitrogen": 0.02, "nitrite": 0.01}
scenario, recommendations = rec_engine.generate_scenario(
    pond_config, initial_state, source_water, risks, "scenario_001", "推荐方案"
)

# 5. 水质模拟
simulator = WaterQualitySimulator(pond_config)
sim_params = SimulationParams(
    simulation_hours=24,
    feed_rate=0.5,
)
initial_params = WaterQualityParams(
    temperature=initial_state.temperature,
    ph=initial_state.ph,
    ammonia_nitrogen=initial_state.ammonia_nitrogen,
    nitrite=initial_state.nitrite,
    salinity=initial_state.salinity,
    dissolved_oxygen=initial_state.dissolved_oxygen,
)
result = simulator.simulate_with_scenario(initial_params, sim_params, scenario)

# 6. 导出报告
md_exporter = MarkdownExporter()
md_exporter.export_analysis_report(
    "output/处置单.md", report, pond_config, initial_state, scenario
)

csv_exporter = CSVExporter()
csv_exporter.export_simulation_curve("output/曲线.csv", result)
```

## 注意事项

1. **幼苗敏感性**: 育苗期幼苗对水质变化极为敏感，建议单次换水量不超过30%
2. **盐度梯度**: 水源与池塘盐度差超过2‰时，必须逐步换水
3. **pH突变**: pH值每小时变化超过0.3单位会严重刺激幼苗
4. **益生菌间隔**: 益生菌施用间隔建议不少于24小时，避免菌群竞争
5. **曝气时机**: 溶解氧临界时应立即开启所有增氧设备，必要时使用化学增氧剂

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request 改进项目。
