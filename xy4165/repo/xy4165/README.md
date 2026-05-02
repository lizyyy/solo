# 窑温曲线复盘器 (Kiln Curve Analyzer)

陶艺工作室窑炉管理员专用的本地数据复盘分析工具。每次烧窑后，导入热电偶CSV、窑位摆放JSON和釉料配方YAML，自动计算升温速率、保温偏差、不同窑位的热暴露差异，按釉料规则标记开裂/流釉风险，支持调整目标曲线进行模拟复盘，并导出Markdown、CSV、JSON报告。

## 功能特性

### 📊 数据解析与清洗
- 支持多种格式导入：热电偶CSV、窑位摆放JSON、釉料配方YAML
- 自动识别时间和温度列（支持中英文列名）
- 缺测点自动清洗（支持线性插值、时间加权插值、前后填充）
- 兼容多种编码格式（UTF-8、GBK、GB2312等）

### 📈 曲线计算
- **升温速率计算**：支持℃/分钟、℃/小时两种单位
- **保温段检测**：自动识别保温段，计算与目标温度偏差、保温时长充足性
- **热暴露计算**：各窑位总热暴露量、峰值温度、不同温度阈值以上的时长
- **多窑位比较**：不同位置的温差和热暴露差异分析

### ⚠️ 风险规则分析
- **开裂风险**：升温过快、冷却过快、临界温度区间风险
- **流釉风险**：保温时间过长、温度过高
- **欠烧/过烧风险**：保温不足或过度、温度偏差
- **风险等级**：低风险、中等风险、高风险、临界风险四级

### 🔄 模拟复盘
- 基于目标参数生成理想曲线
- 支持调整升温速率、保温时间、最高温度、冷却速率
- 可设置中间保温点（如石英相变区域500-600℃）
- 自动对比实际曲线与模拟曲线的差异
- 基于现有风险评估，智能生成改进建议

### 📋 报告导出
- **Markdown格式**：格式化分析报告，含表格、风险图标、详细说明
- **CSV格式**：结构化数据导出，便于进一步分析
- **JSON格式**：完整数据结构导出，便于程序处理

## 项目结构

```
kiln_curve_analyzer/
├── kiln_analyzer/
│   ├── __init__.py           # 包初始化
│   ├── cli.py                # 命令行入口
│   ├── data_parser.py        # 数据解析模块
│   ├── curve_calculator.py   # 曲线计算模块
│   ├── risk_rules.py         # 风险规则模块
│   ├── simulator.py          # 模拟复盘模块
│   └── reporter.py           # 报告生成模块
├── tests/
│   ├── __init__.py
│   ├── test_data_parser.py
│   ├── test_curve_calculator.py
│   ├── test_risk_rules.py
│   └── test_simulator.py
├── examples/                  # 示例数据目录（运行example命令后生成）
├── requirements.txt           # 依赖列表
├── setup.py                   # 安装配置
└── README.md                  # 本文档
```

## 快速开始

### 1. 环境准备

```bash
# 确保Python版本 >= 3.9
python --version

# 创建虚拟环境（推荐）
python -m venv venv
source venv/bin/activate  # Linux/macOS
# 或
venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt

# 以开发模式安装
pip install -e .
```

### 2. 快速验证

运行示例模式，自动生成测试数据并完成完整分析：

```bash
kiln-analyzer example
```

或使用Python模块方式：

```bash
python -m kiln_analyzer.cli example
```

这会：
1. 在 `examples/` 目录生成示例数据文件
2. 自动运行完整分析流程
3. 在 `examples/output/` 导出三种格式的报告

### 3. 使用自己的数据

#### 3.1 准备数据文件

**热电偶CSV文件** (`thermocouple.csv`)：

```csv
time,temperature
2024-01-01 08:00:00,20.0
2024-01-01 08:01:00,30.5
2024-01-01 08:02:00,42.1
...
```

支持的列名：
- 时间列：`time`, `timestamp`, `datetime`, `时间`, `时刻`, `日期时间`
- 温度列：`temperature`, `temp`, `t`, `温度`, `窑温`, `热电偶温度`

**窑位摆放JSON文件** (`kiln_positions.json`)：

```json
{
  "positions": [
    {
      "id": "pos_1",
      "name": "上层左前",
      "position_x": 0.2,
      "position_y": 0.8,
      "position_z": 0.5,
      "thermocouple_id": "thermocouple",
      "items": [
        {"glaze_id": "glaze_001", "count": 3}
      ]
    }
  ]
}
```

**釉料配方YAML文件** (`glaze_recipes.yaml`)：

```yaml
recipes:
  - id: glaze_001
    name: 青瓷釉
    components:
      长石: 40.0
      石英: 30.0
      高岭土: 20.0
      石灰石: 10.0
    firing_profile:
      max_temp: 1280
      holding_time_min: 30
    risk_rules:
      max_heating_rate: 150.0
      max_cooling_rate: -100.0
      critical_cooling_range: [573, 300]
```

#### 3.2 运行分析

**基本分析模式**：

```bash
kiln-analyzer analyze \
  --thermocouple data/thermocouple.csv \
  --positions data/kiln_positions.json \
  --glazes data/glaze_recipes.yaml
```

**带输出的完整分析**：

```bash
kiln-analyzer analyze \
  --thermocouple data/thermocouple.csv \
  --positions data/kiln_positions.json \
  --glazes data/glaze_recipes.yaml \
  --output reports/analysis \
  --format markdown \
  --format csv \
  --format json \
  --interpolation linear
```

**模拟复盘模式**：

```bash
kiln-analyzer simulate \
  --thermocouple data/thermocouple.csv \
  --positions data/kiln_positions.json \
  --glazes data/glaze_recipes.yaml \
  --target-temp 1300 \
  --heating-rate 120 \
  --holding-time 45 \
  --cooling-rate 80 \
  --intermediate-hold 500 20 \
  --intermediate-hold 800 15 \
  --output reports/simulation
```

## 命令行参考

### `analyze` - 分析模式

| 参数 | 简写 | 必填 | 说明 |
|------|------|------|------|
| `--thermocouple` | `-t` | 是 | 热电偶CSV文件路径，可多次指定 |
| `--positions` | `-p` | 是 | 窑位摆放JSON文件路径 |
| `--glazes` | `-g` | 是 | 釉料配方YAML文件路径 |
| `--interpolation` | `-i` | 否 | 缺测点插值方法：`linear`(默认), `time`, `ffill`, `bfill` |
| `--target-temp` | | 否 | 目标保温温度（默认从釉料配方读取） |
| `--output` | `-o` | 否 | 输出文件路径/目录 |
| `--format` | `-f` | 否 | 输出格式：`markdown`(默认), `csv`, `json`，可多次指定 |

### `simulate` - 模拟复盘模式

| 参数 | 简写 | 必填 | 说明 |
|------|------|------|------|
| `--thermocouple` | `-t` | 是 | 热电偶CSV文件路径 |
| `--positions` | `-p` | 是 | 窑位摆放JSON文件路径 |
| `--glazes` | `-g` | 是 | 釉料配方YAML文件路径 |
| `--target-temp` | | 否 | 目标最高温度（默认1280℃） |
| `--heating-rate` | | 否 | 升温速率（默认150℃/小时） |
| `--holding-time` | | 否 | 保温时间（默认30分钟） |
| `--cooling-rate` | | 否 | 冷却速率（默认100℃/小时） |
| `--intermediate-hold` | | 否 | 中间保温点，格式：`温度 分钟`，可多次指定 |
| `--output` | `-o` | 否 | 输出文件路径/目录 |
| `--format` | `-f` | 否 | 输出格式 |

### `example` - 示例模式

| 参数 | 简写 | 必填 | 说明 |
|------|------|------|------|
| `--output` | `-o` | 否 | 输出目录（默认 examples/output） |

## 验证流程

### 1. 安装验证

```bash
# 检查依赖安装
pip list | grep -E "PyYAML|pandas|numpy"

# 检查命令是否可用
kiln-analyzer --help
```

### 2. 功能验证

运行示例命令验证所有功能：

```bash
# 1. 运行完整示例
kiln-analyzer example

# 2. 检查生成的文件
ls -la examples/
ls -la examples/output/

# 3. 查看报告内容
cat examples/output/example_analysis.md
```

### 3. 单元测试验证

```bash
# 运行所有测试
python -m pytest tests/ -v

# 或使用 unittest
python -m unittest discover tests/
```

预期测试结果：所有测试用例通过。

### 4. 预期输出示例

运行 `kiln-analyzer example` 后，你会看到类似以下的输出：

```
============================================================
窑温曲线复盘器 - 示例演示模式
============================================================

正在生成示例数据...
  ✓ 示例数据已生成到: /path/to/examples

正在运行分析...

============================================================
示例分析结果
============================================================

数据统计:
  - 热电偶: 1 个
  - 窑位: 3 个
  - 釉料: 3 种

曲线分析:
  - 最高温度: 1280.0℃
  - 总时长: 480.0 分钟
  - 最大升温速率: 252.0 ℃/小时

风险评估:
  - 最高风险等级: 高风险
  - 低风险: 2
  - 高风险: 3

报告已导出:
  - Markdown: /path/to/examples/output/example_analysis.md
  - JSON: /path/to/examples/output/example_analysis.json
  - CSV: /path/to/examples/output/

============================================================
```

## 风险规则说明

### 内置风险类型

| 风险类型 | 触发条件 | 典型原因 |
|----------|----------|----------|
| **开裂风险** | 升温速率超过釉料规则上限 | 坯体热应力过大 |
| **热震风险** | 临界冷却区间冷却过快 | 石英相变区域应力 |
| **流釉风险** | 保温时间过长/温度过高 | 釉料过度熔融 |
| **欠烧风险** | 保温不足/温度过低 | 釉料未充分熔融 |
| **过烧风险** | 温度过高/保温过长 | 釉料起泡、坯体变形 |

### 风险等级定义

| 等级 | 颜色 | 触发条件 | 建议动作 |
|------|------|----------|----------|
| 低风险 | 🟢 | 无明显异常 | 常规操作 |
| 中等风险 | 🟡 | 接近阈值 | 密切关注 |
| 高风险 | 🟠 | 超过阈值 | 建议调整 |
| 临界风险 | 🔴 | 严重超标 | 必须调整 |

## 数据格式详解

### 热电偶CSV格式

支持的列名变体（不区分大小写）：
- 时间：`time`, `timestamp`, `datetime`, `时间`, `时刻`, `日期时间`
- 温度：`temperature`, `temp`, `t`, `温度`, `窑温`, `热电偶温度`

如果无法识别，自动使用第一列作为时间，第二列作为温度。

### 釉料配方风险规则说明

| 规则字段 | 类型 | 说明 |
|----------|------|------|
| `max_heating_rate` | float | 最大允许升温速率（℃/小时） |
| `max_cooling_rate` | float | 最大允许冷却速率（负数，℃/小时） |
| `critical_cooling_range` | [float, float] | 临界冷却区间（℃），如石英相变573-300℃ |

## 常见问题

### Q1: 如何处理缺测数据？

工具提供四种插值方法：
- `linear`：线性插值（默认）- 适用于均匀变化的数据
- `time`：时间加权插值 - 适用于时间间隔不均匀的数据
- `ffill`：向前填充 - 使用前一个有效值
- `bfill`：向后填充 - 使用后一个有效值

```bash
kiln-analyzer analyze ... --interpolation time
```

### Q2: 支持多热电偶数据吗？

支持！可以多次指定 `--thermocouple` 参数：

```bash
kiln-analyzer analyze \
  --thermocouple data/tc_upper.csv \
  --thermocouple data/tc_middle.csv \
  --thermocouple data/tc_lower.csv \
  ...
```

工具会自动比较不同窑位的温度差异和热暴露。

### Q3: 如何添加自定义风险规则？

可以通过Python API使用自定义规则：

```python
from kiln_analyzer.risk_rules import RiskAnalyzer, RiskRule, RiskType

custom_rules = [
    RiskRule(
        rule_id="my_custom_rule",
        rule_name="我的自定义规则",
        risk_type=RiskType.CRACKING,
        condition={"parameter": "heating_rate", "comparison": "greater_than"},
        thresholds={"medium": 100.0, "high": 150.0, "critical": 200.0},
        weight=1.5
    )
]

analyzer = RiskAnalyzer(custom_rules)
```

### Q4: 报告文件的编码是什么？

- Markdown/JSON：UTF-8 编码
- CSV：UTF-8 with BOM 编码（兼容Excel）

## 开发指南

### 运行测试

```bash
# 安装开发依赖
pip install pytest

# 运行所有测试
pytest tests/ -v

# 运行特定测试
pytest tests/test_data_parser.py -v
```

### 代码结构说明

| 模块 | 职责 | 主要类/函数 |
|------|------|-------------|
| `data_parser` | 数据解析 | `DataParser`, `ThermocoupleData`, `KilnPosition`, `GlazeRecipe` |
| `curve_calculator` | 曲线计算 | `CurveCalculator`, `CurveCalculationResult` |
| `risk_rules` | 风险分析 | `RiskAnalyzer`, `RiskLevel`, `RiskType` |
| `simulator` | 模拟复盘 | `CurveSimulator`, `SimulationResult` |
| `reporter` | 报告生成 | `ReportGenerator`, `FullAnalysisReport` |
| `cli` | 命令行 | `main()`, `run_analysis()`, `run_simulation()`, `run_example()` |

## 更新日志

### v1.0.0 (2024-01-01)
- 初始版本发布
- 实现数据解析模块（支持CSV/JSON/YAML）
- 实现曲线计算模块（升温速率、保温偏差、热暴露）
- 实现风险规则模块（开裂/流釉/欠烧/过烧风险）
- 实现模拟器模块（目标曲线调整、模拟复盘）
- 实现报告模块（Markdown/CSV/JSON导出）
- 完整的单元测试覆盖

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

---

**使用提示**：
- 首次使用建议运行 `kiln-analyzer example` 熟悉流程
- 建议定期导出报告进行历史对比
- 对于敏感釉料，建议使用模拟功能提前预判风险
