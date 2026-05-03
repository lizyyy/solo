# 苗盘补光灌溉校准器

一个为小型温室育苗员设计的本地 Python 工具，用于监测和优化苗盘的光照和灌溉管理。

## 功能特性

- **init**: 生成示例数据（传感器CSV、苗盘品种JSON、天气预报、人工巡检备注）
- **analyze**: 计算每盘 DLI（日积累光量）、蒸散估计和缺水风险
- **plan**: 基于规则引擎生成补光/灌溉建议和行动计划
- **report**: 导出 Markdown、CSV 和 JSON 格式报告

## 核心概念

### DLI (Daily Light Integral) - 日积累光量

DLI 是衡量每日光合有效辐射 (PAR) 累积量的指标，单位为 mol·m⁻²·day⁻¹。

- **计算方法**: 使用梯形积分法对时间序列光照数据进行积分
- **典型需求**:
  - 催芽期: 最低 5 mol/m²/day
  - 幼苗期: 最低 8 mol/m²/day，适宜 10-15 mol/m²/day
  - 成苗期: 最低 10 mol/m²/day，适宜 15-20 mol/m²/day
  - 炼苗期: 最低 8 mol/m²/day，适宜 12-18 mol/m²/day

### ET0 (Reference Evapotranspiration) - 参考作物蒸散量

使用 FAO Penman-Monteith 方程计算参考作物蒸散量：

```
ET0 = (0.408 × Δ × (Rn - G) + γ × (900/(T+273)) × u2 × (es - ea)) / (Δ + γ × (1 + 0.34 × u2))
```

- **Δ**: 饱和水汽压斜率 (kPa/°C)
- **Rn**: 净辐射 (MJ/m²/day)
- **G**: 土壤热通量 (MJ/m²/day)
- **γ**: 干湿常数 (kPa/°C)
- **T**: 平均气温 (°C)
- **u2**: 2米高处风速 (m/s)
- **es**: 饱和水汽压 (kPa)
- **ea**: 实际水汽压 (kPa)

### 风险评估规则

使用加权评分法：
- **水分权重**: 55%
- **光照权重**: 45%

风险等级：
- **critical (严重)**: 需要立即处理
- **high (高)**: 今日需要处理
- **medium (中等)**: 需要关注
- **normal (正常)**: 状态良好

## 安装

### 环境要求

- Python 3.9 或更高版本
- pip 包管理器

### 安装步骤

```bash
# 克隆项目
cd /path/to/project

# 以可编辑模式安装
pip install -e .

# 或者安装开发依赖（用于运行测试）
pip install -e ".[dev]"
```

### 依赖项

- `click>=8.0.0` - 命令行接口框架
- `pandas>=1.3.0` - 数据处理
- `numpy>=1.20.0` - 数值计算
- `python-dateutil>=2.8.0` - 日期处理

开发依赖：
- `pytest>=7.0.0` - 测试框架
- `pytest-cov>=4.0.0` - 覆盖率测试

## 使用指南

### 1. 初始化示例数据

```bash
# 生成默认示例数据（5个苗盘，3天数据）
calibrator init

# 自定义参数
calibrator init --output-dir ./my_data --tray-count 10 --days 5
```

生成的文件：
- `sensor_data.csv` - 传感器时间序列数据
- `tray_config.json` - 苗盘品种配置
- `weather_forecast.json` - 天气预报数据
- `inspection_notes.json` - 人工巡检记录

### 2. 分析数据

```bash
# 基本分析（必需：传感器数据和苗盘配置）
calibrator analyze --sensor ./sample_data/sensor_data.csv --trays ./sample_data/tray_config.json

# 完整分析（包含天气预报和巡检记录）
calibrator analyze \
    --sensor ./sample_data/sensor_data.csv \
    --trays ./sample_data/tray_config.json \
    --weather ./sample_data/weather_forecast.json \
    --inspection ./sample_data/inspection_notes.json \
    --output ./analysis_results.json
```

分析结果包含：
- 每日 DLI 计算
- 水分时间序列分析
- 蒸散量 (ET0) 估计
- 初步风险评估

### 3. 生成行动计划

```bash
# 基于传感器数据生成计划
calibrator plan \
    --sensor ./sample_data/sensor_data.csv \
    --trays ./sample_data/tray_config.json \
    --weather ./sample_data/weather_forecast.json

# 使用已有的分析结果文件（跳过重新分析）
calibrator plan --input ./analysis_results.json --output ./action_plan.json
```

行动计划包含：
- 风险评估结果
- 补光建议（时长、能耗、成本估算）
- 灌溉建议（水量、最佳时间）
- 监测频率建议

### 4. 导出报告

```bash
# 导出所有格式报告
calibrator report --input ./analysis_results.json --action-plan ./action_plan.json

# 仅导出 Markdown 格式
calibrator report --input ./analysis_results.json --action-plan ./action_plan.json --format markdown

# 自定义输出目录和文件名前缀
calibrator report \
    --input ./analysis_results.json \
    --action-plan ./action_plan.json \
    --output-dir ./daily_reports \
    --prefix 2026-05-01
```

生成的报告文件：
- `report.md` - 完整 Markdown 报告
- `report_risk.csv` - 风险汇总表格
- `report_actions.csv` - 行动计划表格
- `report_full.json` - 完整结构化数据

## 数据格式说明

### 传感器数据 CSV 格式

```csv
timestamp,tray_id,light_intensity,moisture,temperature,humidity
2026-05-01 06:00:00,TRAY-01,0.0,60.0,20.0,70.0
2026-05-01 08:00:00,TRAY-01,300.0,58.0,22.5,65.0
```

字段说明：
- `timestamp`: 时间戳 (YYYY-MM-DD HH:MM:SS)
- `tray_id`: 苗盘标识符
- `light_intensity`: 光照强度 (lux 或 μmol/m²/s)
- `moisture`: 基质湿度 (%)
- `temperature`: 环境温度 (°C)
- `humidity`: 相对湿度 (%)

### 苗盘配置 JSON 格式

```json
{
    "generated_at": "2026-05-01T09:00:00",
    "trays": [
        {
            "tray_id": "TRAY-01",
            "variety_name": "樱桃番茄",
            "stage": "幼苗期",
            "planting_date": "2026-04-15",
            "notes": "樱桃番茄育苗盘"
        }
    ]
}
```

生长阶段选项：
- `催芽期` - 刚播种阶段
- `幼苗期` - 发芽后阶段
- `成苗期` - 快速生长阶段
- `炼苗期` - 移栽前准备阶段

### 天气预报 JSON 格式

```json
{
    "location": "温室所在地",
    "forecast": [
        {
            "date": "2026-05-01",
            "weather": "晴",
            "temp_avg": 22.5,
            "temp_min": 18.0,
            "temp_max": 28.0,
            "humidity_avg": 65,
            "cloud_cover": 20,
            "wind_speed": 3.5,
            "precipitation": 0
        }
    ]
}
```

### 人工巡检 JSON 格式

```json
{
    "inspections": [
        {
            "timestamp": "2026-05-01 09:00:00",
            "tray_id": "TRAY-01",
            "inspector": "张三",
            "moisture": "正常",
            "appearance": "生长正常",
            "pest_disease": "否",
            "notes": "",
            "rating": 5,
            "action_taken": ""
        }
    ]
}
```

水分评估选项：`干`, `偏干`, `正常`, `偏湿`, `过湿`

评分 (rating): 1-5 分，5 分为最佳

## 项目结构

```
xy4254/
├── calibrator/
│   ├── __init__.py
│   ├── cli.py                    # 命令行接口
│   ├── parser/
│   │   ├── __init__.py
│   │   ├── sensor_parser.py      # 传感器CSV解析
│   │   ├── tray_parser.py        # 苗盘配置解析
│   │   ├── weather_parser.py     # 天气预报解析
│   │   └── inspection_parser.py  # 巡检记录解析
│   ├── calculator/
│   │   ├── __init__.py
│   │   ├── dli_calculator.py     # DLI计算
│   │   ├── evapotranspiration.py # 蒸散量计算
│   │   └── moisture_analyzer.py  # 水分分析
│   ├── rules/
│   │   ├── __init__.py
│   │   ├── risk_evaluator.py     # 风险评估器
│   │   └── action_planner.py     # 行动计划器
│   └── exporter/
│       ├── __init__.py
│       ├── markdown_exporter.py  # Markdown导出
│       ├── csv_exporter.py       # CSV导出
│       └── json_exporter.py      # JSON导出
├── tests/
│   ├── __init__.py
│   ├── test_parser.py            # 数据解析测试
│   ├── test_calculator.py        # 科学计算测试
│   ├── test_rules.py             # 规则引擎测试
│   └── test_exporter.py          # 导出模块测试
├── pyproject.toml                # 项目配置
└── README.md
```

## 模块说明

### 数据解析模块 (parser)

负责解析各种输入数据格式并进行验证和规范化。

- **SensorParser**: 解析传感器CSV，支持按苗盘分组
- **TrayParser**: 解析苗盘配置，根据生长阶段提供默认需求参数
- **WeatherParser**: 解析天气预报，支持JSON和CSV格式
- **InspectionParser**: 解析巡检记录，支持自然语言关键词识别

### 科学计算模块 (calculator)

实现核心科学计算算法。

- **DLICalculator**:
  - lux 到 PPFD 转换
  - 梯形积分法计算 DLI
  - 补光需求估算
  - 周统计计算

- **EvapotranspirationCalculator**:
  - FAO Penman-Monteith 方程计算 ET0
  - 作物系数 (Kc) 获取
  - 水分亏缺计算
  - 苗盘水分损失估算

- **MoistureAnalyzer**:
  - 水分时间序列分析
  - 灌溉事件检测
  - 下次灌溉时间估算
  - 基质特性支持

### 规则引擎模块 (rules)

基于规则的风险评估和行动计划生成。

- **RiskEvaluator**:
  - 光照风险评估
  - 水分风险评估
  - 加权综合评估
  - 批量评估支持

- **ActionPlanner**:
  - 补光建议生成（时长、能耗、成本）
  - 灌溉建议生成（水量、最佳时间）
  - 监测频率建议
  - 操作整合与优先级排序

### 导出模块 (exporter)

多格式报告导出。

- **MarkdownExporter**: 结构化 Markdown 报告
- **CSVExporter**: 风险汇总、行动计划、每日指标 CSV
- **JSONExporter**: 完整结构化 JSON 数据

## 完整验证流程

### 1. 安装验证

```bash
# 安装项目
pip install -e ".[dev]"

# 验证 CLI 可用
calibrator --help
```

预期输出：
```
Usage: calibrator [OPTIONS] COMMAND [ARGS]...

  苗盘补光灌溉校准器
  ...
```

### 2. 初始化示例数据

```bash
# 生成示例数据
calibrator init --output-dir ./sample_data

# 验证生成的文件
ls -la ./sample_data/
```

预期文件：
- `sensor_data.csv`
- `tray_config.json`
- `weather_forecast.json`
- `inspection_notes.json`

### 3. 运行数据分析

```bash
# 运行分析
calibrator analyze \
    --sensor ./sample_data/sensor_data.csv \
    --trays ./sample_data/tray_config.json \
    --weather ./sample_data/weather_forecast.json \
    --inspection ./sample_data/inspection_notes.json \
    --output ./analysis_results.json

# 验证输出文件
ls -la ./analysis_results.json
```

预期输出包含：
- 传感器数据记录数
- 苗盘数量
- 各苗盘分析结果
- 风险警告（如果有）

### 4. 生成行动计划

```bash
# 生成计划
calibrator plan --input ./analysis_results.json --output ./action_plan.json

# 验证输出
ls -la ./action_plan.json
```

预期输出包含：
- 风险汇总
- 操作汇总（紧急操作数、需要补光/浇水的苗盘数）
- 预计成本

### 5. 导出报告

```bash
# 导出报告
calibrator report \
    --input ./analysis_results.json \
    --action-plan ./action_plan.json \
    --output-dir ./reports

# 验证生成的报告文件
ls -la ./reports/
```

预期文件：
- `report.md`
- `report_risk.csv`
- `report_actions.csv`
- `report_full.json`

### 6. 运行单元测试

```bash
# 运行所有测试
pytest

# 运行测试并显示覆盖率
pytest --cov=calibrator

# 运行特定测试模块
pytest tests/test_parser.py
pytest tests/test_calculator.py
pytest tests/test_rules.py
pytest tests/test_exporter.py
```

预期结果：所有测试通过

### 7. 验证示例数据场景

示例数据设计了以下场景供验证：

| 苗盘ID | 品种 | 生长阶段 | 预设问题 |
|--------|------|----------|----------|
| TRAY-01 | 樱桃番茄 | 幼苗期 | 光照不足（强度降低30%） |
| TRAY-02 | 黄瓜 | 成苗期 | 水分偏低（湿度约30%） |
| TRAY-03 | 辣椒 | 催芽期 | 光照不足 |
| TRAY-04 | 生菜 | 炼苗期 | 水分过湿（湿度约85%） |
| TRAY-05+ | 随机 | 随机 | 正常状态 |

运行分析后，应该能够检测到：
- TRAY-01 和 TRAY-03 的光照不足
- TRAY-02 的水分偏低
- TRAY-04 的水分过湿

## 命令参考

### init

```
Usage: calibrator init [OPTIONS]

  生成示例数据

Options:
  -o, --output-dir TEXT   示例数据输出目录，默认: ./sample_data
  -t, --tray-count INTEGER  生成的苗盘数量，默认: 5
  -d, --days INTEGER      生成的天数数据，默认: 3
  --help                  Show this message and exit.
```

### analyze

```
Usage: calibrator analyze [OPTIONS]

  分析传感器数据

Options:
  -s, --sensor PATH       传感器CSV数据文件路径 [required]
  -t, --trays PATH        苗盘品种JSON配置文件路径 [required]
  -w, --weather PATH      天气预报文件路径（可选）
  -i, --inspection PATH   人工巡检备注文件路径（可选）
  -o, --output TEXT       分析结果输出路径，默认: ./analysis_results.json
  --help                  Show this message and exit.
```

### plan

```
Usage: calibrator plan [OPTIONS]

  生成补光/灌溉建议

Options:
  -s, --sensor PATH       传感器CSV数据文件路径
  -t, --trays PATH        苗盘品种JSON配置文件路径
  -w, --weather PATH      天气预报文件路径
  -i, --inspection PATH   人工巡检备注文件路径
  -f, --input PATH        使用已有的分析结果JSON文件（跳过重新分析）
  -o, --output TEXT       行动计划输出路径，默认: ./action_plan.json
  --help                  Show this message and exit.
```

### report

```
Usage: calibrator report [OPTIONS]

  导出报告

Options:
  -i, --input PATH        分析结果或行动计划JSON文件路径 [required]
  -a, --action-plan PATH  行动计划JSON文件路径（可选）
  -o, --output-dir TEXT   报告输出目录，默认: ./reports
  -f, --format [all|markdown|csv|json]
                          输出格式，默认: all
  -p, --prefix TEXT       输出文件前缀，默认: report
  --help                  Show this message and exit.
```

## 常见问题

### Q: 如何处理缺失的传感器数据？

A: 解析器会自动处理数据间隙，但建议保持至少每30分钟一个数据点以获得准确的DLI计算。

### Q: 如何添加新的作物品种支持？

A: 在 `tray_parser.py` 中扩展品种需求配置，或在JSON配置文件中直接指定自定义需求参数。

### Q: 光照强度单位需要转换吗？

A: 是的。DLICalculator 提供 `lux_to_ppfd()` 方法进行转换。默认假设光照强度为 lux，需要时可以调整。

### Q: 如何自定义风险评估规则？

A: 修改 `rules/risk_evaluator.py` 中的权重配置和阈值参数，或扩展 RiskEvaluator 类实现自定义逻辑。

## License

本项目仅供学习和内部使用。

---

*苗盘补光灌溉校准器 - 让育苗更智能*
