# 烧成曲线复核器 (Kiln Curve Validator)

陶艺工作室窑炉负责人用的本地科学计算工具，用于素烧、釉烧前复核温度曲线，避免升温太猛、保温不足或冷却开裂等问题。

## 功能特性

### 核心功能
- **数据维护**: 管理窑炉参数和烧成配方
- **曲线解析**: 导入窑炉温度记录CSV，自动检测编码和列名
- **热惯性模拟**: 分段模拟热惯性曲线，计算表里温差和热滞后
- **规则校验**: 检查升温速率、热功、保温时间、冷却风险、传感器异常
- **曲线对比**: 对比计划曲线与实测曲线，分析偏差
- **报告导出**: 生成Markdown复核报告和CSV修正曲线

### 校验维度
| 校验项 | 检查内容 | 风险等级 |
|--------|----------|----------|
| 升温速率 | 实际升温速率是否超过安全限值 | 🔴 严重 |
| 热功充足 | 峰值温度是否达到目标值 | 🟡 警告 |
| 保温时间 | 高温保温时间是否足够 | 🟡 警告 |
| 冷却风险 | 500-300°C临界区间冷却速率是否过快 | 🔴 严重 |
| 传感器状态 | 无效数据点、温度突变、异常平坦 | 🟡 警告 |

## 安装

### 环境要求
- Python 3.10+
- pip 或 poetry

### 安装步骤

```bash
# 克隆项目（如果适用）或进入项目目录
cd xy4170

# 安装依赖
pip install -e .

# 或者安装开发依赖（用于测试）
pip install -e ".[dev]"
```

## 快速开始

### 1. 生成示例配置

首先生成示例配置文件，了解数据格式：

```bash
kiln-validator examples -o samples
```

这会在 `samples` 目录下生成：
- `示例窑炉.json` - 窑炉参数示例
- `示例配方.json` - 烧成配方示例
- `示例温度记录.csv` - 温度记录示例

### 2. 解析温度记录

查看窑炉记录的CSV数据：

```bash
kiln-validator parse samples/temp_record_normal_bisque.csv -k "小型电窑"
```

### 3. 生成计划曲线

根据配方和窑炉参数生成默认计划曲线：

```bash
kiln-validator generate samples/recipe_glaze_clear.json samples/kiln_small_electric.json -o planned_curve.json
```

### 4. 运行热惯性模拟

模拟曲线的热惯性效应：

```bash
kiln-validator simulate samples/planned_curve_glaze.json -r samples/recipe_glaze_clear.json -k samples/kiln_small_electric.json -o simulation_result.csv
```

### 5. 运行完整复核

这是最核心的命令，会执行完整的复核流程：

```bash
kiln-validator validate samples/temp_record_problematic.csv \
  -r samples/recipe_glaze_clear.json \
  -k samples/kiln_small_electric.json \
  -p samples/planned_curve_glaze.json \
  -o output \
  -n "批次20260502"
```

输出文件：
- `output/批次20260502_复核报告.md` - 完整复核报告
- `output/批次20260502_修正曲线.csv` - 修正后的曲线建议

## 命令详解

### generate - 生成计划曲线

```bash
kiln-validator generate RECIPE_PATH KILN_PATH [OPTIONS]
```

**参数:**
- `RECIPE_PATH`: 配方JSON文件路径
- `KILN_PATH`: 窑炉参数JSON文件路径

**选项:**
- `-o, --output`: 输出曲线JSON文件路径

**说明:**
根据配方（坯体厚度、釉料特性）和窑炉参数（热惯性、最大功率）自动生成科学的计划曲线，包含：
- 预热阶段（室温→200°C，较慢速率）
- 升温阶段（分段速率控制）
- 釉烧特殊升温速率（结晶水排除后较慢）
- 保温阶段（根据釉料特性设置）
- 安全冷却阶段（控制冷却速率防止开裂）

### parse - 解析温度记录

```bash
kiln-validator parse CSV_PATH [OPTIONS]
```

**参数:**
- `CSV_PATH`: 温度记录CSV文件路径

**选项:**
- `-k, --kiln`: 窑炉名称
- `-o, --output`: 输出摘要JSON文件

**支持的CSV格式:**
- 自动检测编码：UTF-8, GBK, GB2312等
- 自动检测分隔符：逗号、分号、制表符等
- 智能识别列名：
  - 时间列：时间, time, Time, timestamp, datetime
  - 温度列：温度, temperature, temp, T, °C
  - 传感器列：传感器, sensor, 通道, channel

### simulate - 热惯性模拟

```bash
kiln-validator simulate PLANNED_JSON -r RECIPE -k KILN [OPTIONS]
```

**参数:**
- `PLANNED_JSON`: 计划曲线JSON文件路径

**选项:**
- `-r, --recipe`: 配方JSON文件（必需）
- `-k, --kiln`: 窑炉参数JSON文件（必需）
- `-o, --output`: 输出模拟结果CSV

**模拟输出:**
- 表面温度曲线
- 中心温度曲线（简化一维热传导模型）
- 表里温差
- 热滞后时间
- 热功分析（加热/保温/冷却能量）

### validate - 完整复核

```bash
kiln-validator validate MEASURED_CSV -r RECIPE -k KILN [OPTIONS]
```

**参数:**
- `MEASURED_CSV`: 实测温度记录CSV文件路径

**选项:**
- `-r, --recipe`: 配方JSON文件（必需）
- `-k, --kiln`: 窑炉参数JSON文件（必需）
- `-p, --planned`: 计划曲线JSON文件（可选，不提供则自动生成）
- `-o, --output-dir`: 输出目录（默认当前目录）
- `-n, --name`: 报告名称前缀
- `--no-simulate`: 跳过热惯性模拟

**执行流程:**
1. 加载配置（窑炉参数、配方）
2. 解析实测温度数据
3. 准备计划曲线（加载或生成）
4. 热惯性模拟（可选）
5. 运行校验：
   - 升温速率校验
   - 热功/保温时间校验
   - 冷却风险校验
   - 传感器异常校验
6. 计划与实测对比
7. 生成报告和修正曲线

### examples - 生成示例

```bash
kiln-validator examples [OPTIONS]
```

**选项:**
- `-o, --output-dir`: 输出目录（默认当前目录）

## 配置文件格式

### 窑炉参数 (Kiln Parameters)

```json
{
  "name": "小型电窑 0.06m³",
  "max_temperature": 1320.0,
  "chamber_volume": 60.0,
  "power_rating": 6.0,
  "thermal_inertia_factor": 2.5,
  "max_heating_rate": 8.0,
  "max_cooling_rate": 5.0,
  "sensor_accuracy": 2.0,
  "heating_elements_count": 4
}
```

**字段说明:**
| 字段 | 说明 | 单位 |
|------|------|------|
| `name` | 窑炉名称 | - |
| `max_temperature` | 最高工作温度 | °C |
| `chamber_volume` | 窑室容积 | L |
| `power_rating` | 额定功率 | kW |
| `thermal_inertia_factor` | 热惯性系数 (1-5，越大惯性越大) | - |
| `max_heating_rate` | 最大升温速率 | °C/min |
| `max_cooling_rate` | 最大自然冷却速率 | °C/min |
| `sensor_accuracy` | 传感器精度 | ±°C |

### 烧成配方 (Firing Recipe)

```json
{
  "name": "中温釉烧 - 透明釉",
  "firing_type": "glaze",
  "target_temperature": 1240.0,
  "total_thickness": 1.5,
  "max_allowed_heating_rate": 4.0,
  "body": {
    "name": "高白泥",
    "thickness_range": [0.5, 3.0],
    "thermal_conductivity": 1.2,
    "porosity": 0.25,
    "recommended_bisque_temp": 980.0,
    "critical_cooling_rate": 2.5
  },
  "glaze": {
    "name": "透明釉",
    "maturing_temp_range": [1220.0, 1260.0],
    "hold_time_recommended": 30.0,
    "expansion_coefficient": 5.2,
    "is_matte": false
  }
}
```

**字段说明:**
| 字段 | 说明 | 单位 |
|------|------|------|
| `name` | 配方名称 | - |
| `firing_type` | 烧成类型：`bisque`(素烧) 或 `glaze`(釉烧) | - |
| `target_temperature` | 目标烧成温度 | °C |
| `total_thickness` | 总厚度（坯体+釉层） | cm |
| `max_allowed_heating_rate` | 最大允许升温速率（可选，不填则自动计算） | °C/min |

**坯体特性 (Body):**
| 字段 | 说明 | 单位 |
|------|------|------|
| `thermal_conductivity` | 热导率 | W/m·K |
| `porosity` | 孔隙率 (0-1) | - |
| `critical_cooling_rate` | 临界冷却速率（超过可能开裂） | °C/min |

**釉料特性 (Glaze, 素烧可为空):**
| 字段 | 说明 | 单位 |
|------|------|------|
| `maturing_temp_range` | 成熟温度范围 | °C |
| `hold_time_recommended` | 推荐保温时间 | min |
| `expansion_coefficient` | 热膨胀系数 | ×10^-6 /°C |

### 计划曲线 (Planned Curve)

```json
{
  "recipe_name": "中温釉烧",
  "kiln_name": "小型电窑",
  "preheat_included": true,
  "segments": [
    {
      "segment_type": "ramp",
      "start_temp": 25.0,
      "end_temp": 200.0,
      "duration": 70.0,
      "rate": 2.5
    },
    {
      "segment_type": "hold",
      "start_temp": 1240.0,
      "end_temp": 1240.0,
      "duration": 35.0,
      "rate": 0.0
    },
    {
      "segment_type": "cool",
      "start_temp": 1240.0,
      "end_temp": 500.0,
      "duration": 180.0,
      "rate": -4.11
    }
  ]
}
```

**段类型 (Segment Type):**
- `ramp`: 升温段
- `hold`: 保温段
- `cool`: 降温段

## 验证流程

### 快速验证

```bash
# 1. 进入项目目录
cd /path/to/xy4170

# 2. 安装依赖
pip install -e .

# 3. 生成示例文件
kiln-validator examples -o test_samples

# 4. 运行完整复核（使用有问题的示例数据）
kiln-validator validate test_samples/示例温度记录.csv \
  -r test_samples/示例配方.json \
  -k test_samples/示例窑炉.json \
  -o test_output

# 5. 查看输出
ls test_output/
# 应该看到：
# - 示例温度记录_复核报告.md
# - 示例温度记录_修正曲线.csv
```

### 运行单元测试

```bash
# 安装开发依赖
pip install -e ".[dev]"

# 运行测试
pytest tests/ -v

# 或者带覆盖率
pytest tests/ --cov=kiln_curve_validator
```

### 典型测试场景

**场景1: 正常素烧曲线**
```bash
kiln-validator validate samples/temp_record_normal_bisque.csv \
  -r samples/recipe_bisque_gaobai.json \
  -k samples/kiln_small_electric.json \
  -o output_normal
```
预期结果：整体状态为 `pass` 或 `warning`，无严重问题。

**场景2: 有问题的曲线（升温过快、冷却过快）**
```bash
kiln-validator validate samples/temp_record_problematic.csv \
  -r samples/recipe_glaze_clear.json \
  -k samples/kiln_small_electric.json \
  -p samples/planned_curve_glaze.json \
  -o output_problem
```
预期结果：整体状态为 `fail`，包含多个 `critical` 级别的问题。

**场景3: 热惯性模拟**
```bash
kiln-validator simulate samples/planned_curve_glaze.json \
  -r samples/recipe_glaze_clear.json \
  -k samples/kiln_small_electric.json \
  -o simulation.csv
```
预期结果：生成包含表面温度、中心温度、表里温差的CSV文件。

## 科学计算模型

### 热惯性模型

热惯性效应考虑以下因素：
1. **坯体厚度**: 越厚的坯体温差越大
2. **升温速率**: 越快的升温惯性效应越明显
3. **当前温度**: 高温下比热容变化影响
4. **窑炉特性**: 热惯性系数

简化公式：
```
惯性效应 = 惯性系数 × log(1+速率) × (厚度/2) × 温度因子
```

### 热传导模型

中心温度计算使用简化的一维热传导模型：
```
T_core(t+Δt) = T_core(t) + (T_surface - T_core(t)) × (1 - e^(-αΔt/L²))
```

其中：
- α = 热导率 / (密度 × 比热容)
- L = 坯体半厚度

### 热功计算

**升温段能量:**
```
理论能量 = 质量 × 平均比热容 × 温差
实际能量 = 功率 × 效率 × 时间
```

**保温段能量:**
```
保温能量 ≈ 热损失功率 × 时间
热损失 ∝ (窑内温度 - 环境温度)^1.25
```

### 安全限值计算

**升温速率安全值:**
```
安全速率 = 最大允许速率 × 厚度因子

厚度因子:
- 厚度 > 2cm: 0.5
- 厚度 1.5-2cm: 0.7
- 厚度 1-1.5cm: 0.85
- 厚度 < 1cm: 1.0
```

**冷却临界区间 (500°C - 300°C):**

这是石英晶型转化区间，冷却过快会导致开裂：
```
安全冷却速率 = 坯体临界冷却速率 × 0.8
```

## 项目结构

```
xy4170/
├── pyproject.toml          # 项目配置和依赖
├── .gitignore              # Git忽略文件
├── README.md               # 本文档
├── src/
│   └── kiln_curve_validator/
│       ├── __init__.py     # 包初始化
│       ├── models.py       # 数据模型 (Pydantic)
│       ├── parser.py       # CSV/JSON解析器
│       ├── simulator.py    # 热惯性模拟和热功计算
│       ├── validator.py    # 规则校验和曲线对比
│       ├── exporter.py     # Markdown/CSV导出
│       └── cli.py          # 命令行界面 (Click)
├── samples/                # 示例数据
│   ├── kiln_small_electric.json
│   ├── kiln_medium_gas.json
│   ├── recipe_bisque_gaobai.json
│   ├── recipe_glaze_clear.json
│   ├── temp_record_normal_bisque.csv
│   ├── temp_record_problematic.csv
│   └── planned_curve_glaze.json
└── tests/                  # 单元测试
    ├── __init__.py
    ├── test_models.py
    ├── test_parser.py
    ├── test_simulator.py
    └── test_validator.py
```

## 注意事项

1. **本工具仅提供参考建议**，最终烧成决策请结合实际经验和窑炉特性判断。

2. **热惯性模拟为简化模型**，实际窑炉情况可能更复杂，建议多次验证后调整参数。

3. **冷却风险分析**重点关注500-300°C区间（石英晶型转化），不同坯体的临界冷却速率不同。

4. **传感器异常检测**可以帮助提前发现问题，但不能替代定期的传感器校准。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。
