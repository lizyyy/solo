# Power-Sim: 户外电源模拟工具

在露营、摆摊或外拍前预演户外电源到底够不够用。避免现场发现"某个时段同时开太多"或"阴天补电完全不够"的尴尬。

## 功能特性

- ✅ **智能单位换算**: 支持 Wh/W/Ah 等常用单位自动转换
- ✅ **按时间段叠加负载**: 精确计算每个小时的总功率消耗
- ✅ **逆变损耗计算**: 考虑 DC 直供和 AC 逆变的效率差异
- ✅ **保底电量设置**: 支持最低 SOC 阈值，避免电池过放
- ✅ **太阳能分段输入**: 灵活配置太阳能板的发电曲线
- ✅ **天气折减系数**: 考虑晴天/多云/阴天/雨天对发电的影响
- ✅ **多风险检测**: 过载、欠压、补电不足、关键设备断电风险
- ✅ **多方案对比**: 比如"冰箱全程开"和"夜里关一段"的差异
- ✅ **多格式导出**: Markdown、HTML、JSON 报告

## 快速开始

### 安装

```bash
# 克隆项目
cd power-sim

# 安装依赖（使用 pip）
pip install -e .

# 或者使用 poetry
poetry install
```

### 基本用法

```bash
# 查看帮助
power-sim --help

# 验证配置文件
power-sim validate -b examples/battery.json -l examples/loads_fridge_full.csv

# 执行模拟
power-sim simulate -b examples/battery.json -l examples/loads_fridge_full.csv -s examples/solar.csv -p examples/plan_sunny.json --show-hourly

# 多方案对比
power-sim compare -b examples/battery.json \
  -l examples/loads_fridge_full.csv \
  -l examples/loads_fridge_night_off.csv \
  -s examples/solar.csv \
  -p examples/plan_sunny.json \
  -n "冰箱全程开" -n "夜里关冰箱"

# 导出报告
power-sim export -b examples/battery.json -l examples/loads_fridge_full.csv -s examples/solar.csv -p examples/plan_sunny.json -o report.md -f markdown
power-sim export -b examples/battery.json -l examples/loads_fridge_full.csv -s examples/solar.csv -p examples/plan_sunny.json -o report.html -f html
power-sim export -b examples/battery.json -l examples/loads_fridge_full.csv -s examples/solar.csv -p examples/plan_sunny.json -o report.json -f json
```

## 配置文件说明

### 1. 电池配置 (battery.json)

定义你的户外电源规格：

```json
{
  "name": "铂陆帝 BLUETTI AC200P",
  "capacity_ah": 52.8,
  "voltage": 48,
  "chemistry": "lifepo4",
  "min_soc_percent": 10.0,
  "max_soc_percent": 100.0,
  "initial_soc_percent": 100.0,
  "inverter_max_power_w": 2000.0,
  "inverter_efficiency_percent": 85.0,
  "charge_efficiency_percent": 90.0
}
```

**字段说明：**
- `capacity_ah`: 电池容量（安时）
- `voltage`: 电池电压（伏特）
- `chemistry`: 化学类型 - `lithium` (锂电池) / `lead_acid` (铅酸) / `lifepo4` (磷酸铁锂)
- `min_soc_percent`: 最低允许放电深度（建议 10-20%）
- `inverter_max_power_w`: 逆变器最大功率（AC 负载不能超过此值）
- `inverter_efficiency_percent`: 逆变器效率（典型 80-90%）

### 2. 负载配置 (loads.csv)

定义你要使用的设备：

| 字段 | 说明 | 示例 |
|------|------|------|
| name | 设备名称 | 车载冰箱 |
| device_type | 设备类型 | `dc` 或 `ac` |
| power | 功率（W） | 60 |
| current | 电流（A，可选） | 5 |
| voltage | 电压（V，与电流配合使用） | 12 |
| priority | 优先级 | `critical` / `high` / `medium` / `low` |
| start_time | 开始时间 | 08:00 |
| end_time | 结束时间 | 22:00 |
| duty_cycle | 占空比（间歇性设备如冰箱） | 30 |

**示例：**
```csv
name,device_type,power,priority,start_time,end_time,duty_cycle
车载冰箱,dc,60,critical,00:00,24:00,30
LED露营灯,dc,20,high,18:00,23:00,100
笔记本电脑,ac,65,medium,09:00,12:00,100
电热烧水壶,ac,1200,medium,08:00,08:30,100
```

**优先级说明：**
- `critical`: 关键设备（如冰箱、医疗设备）- 断电时会发出严重警告
- `high`: 高优先级（如相机充电、照明）
- `medium`: 中等优先级（如笔记本、音箱）
- `low`: 低优先级（如装饰灯、手机充电）

### 3. 太阳能配置 (solar.csv)

定义太阳能板：

| 字段 | 说明 | 示例 |
|------|------|------|
| name | 太阳能板名称 | 主太阳能板 |
| max_power | 最大功率（W） | 400 |
| efficiency | 转换效率（%） | 90 |
| start_time | 开始发电时间 | 06:00 |
| end_time | 结束发电时间 | 18:00 |
| hour_0 ~ hour_23 | 每小时发电比例（0-1） | 0.8 |

**每小时发电曲线示例：**
```csv
name,max_power,efficiency,start_time,end_time,hour_6,hour_7,hour_8,hour_9,hour_10,hour_11,hour_12,hour_13,hour_14,hour_15,hour_16,hour_17
主太阳能板,400,90,06:00,18:00,0.2,0.4,0.6,0.8,0.9,1.0,1.0,0.95,0.85,0.7,0.5,0.3
```

### 4. 方案配置 (plan.json)

定义模拟方案：

```json
{
  "name": "晴天露营方案",
  "description": "假设是晴朗天气，太阳能补电充足",
  "weather": {
    "condition": "sunny",
    "factor_percent": 100.0
  },
  "simulation_start_hour": 0,
  "simulation_duration_hours": 48
}
```

**天气条件：**
- `sunny`: 晴天（100% 发电）
- `partly_cloudy`: 多云（70% 发电）
- `cloudy`: 阴天（40% 发电）
- `rainy`: 雨天（15% 发电）

## 命令详解

### validate - 验证配置

```bash
# 基本验证
power-sim validate -b battery.json -l loads.csv

# 详细模式
power-sim validate -b battery.json -l loads.csv -s solar.csv -p plan.json -v
```

**检测内容：**
- 电池配置是否合理
- 负载功率是否超过逆变器上限
- 负载时间是否重叠
- 太阳能配置是否合法

### simulate - 执行模拟

```bash
# 基本模拟
power-sim simulate -b battery.json -l loads.csv

# 带太阳能
power-sim simulate -b battery.json -l loads.csv -s solar.csv -p plan.json

# 显示每小时数据
power-sim simulate -b battery.json -l loads.csv --show-hourly

# 导出报告
power-sim simulate -b battery.json -l loads.csv -e report.md -f markdown
```

### compare - 多方案对比

```bash
# 对比两个负载方案
power-sim compare -b battery.json \
  -l loads_scenario1.csv \
  -l loads_scenario2.csv \
  -n "方案1" -n "方案2"

# 对比不同天气
power-sim compare -b battery.json -l loads.csv \
  -p plan_sunny.json \
  -p plan_cloudy.json \
  -n "晴天" -n "阴天"
```

### export - 导出报告

```bash
# Markdown 格式
power-sim export -b battery.json -l loads.csv -o report.md -f markdown

# HTML 格式
power-sim export -b battery.json -l loads.csv -o report.html -f html

# JSON 格式
power-sim export -b battery.json -l loads.csv -o report.json -f json
```

## 风险检测

工具会自动检测以下风险：

| 风险类型 | 说明 | 严重程度 |
|----------|------|----------|
| `overload` | 逆变器过载（AC 功率超限） | 🔴 严重 |
| `blackout` | 预计断电时间 | 🔴 严重 |
| `critical_device_off` | 关键设备断电时仍在使用 | 🔴 严重 |
| `low_soc` | SOC 接近最低阈值 | 🟠 高 |
| `solar_insufficient` | 太阳能补电不足 | 🟠 高 |
| `time_overlap` | 负载时间重叠 | 🟡 中等 |

## 运行测试

```bash
# 安装开发依赖
pip install pytest pytest-cov

# 运行测试
pytest

# 带覆盖率
pytest --cov=power_sim
```

## 项目结构

```
power-sim/
├── power_sim/
│   ├── __init__.py
│   ├── models.py          # 数据模型定义
│   ├── parser.py          # 配置文件解析
│   ├── calculator.py      # 计算核心（单位换算、模拟）
│   ├── risk_analyzer.py   # 风险分析
│   ├── exporter.py        # 报告导出
│   └── cli.py             # 命令行入口
├── examples/
│   ├── battery.json           # 电池配置示例
│   ├── loads_fridge_full.csv  # 负载方案1：冰箱全程开
│   ├── loads_fridge_night_off.csv  # 负载方案2：夜里关冰箱
│   ├── solar.csv             # 太阳能配置
│   ├── plan_sunny.json       # 晴天方案
│   └── plan_cloudy.json      # 阴天方案
├── tests/
│   ├── __init__.py
│   ├── test_models.py
│   └── test_calculator.py
├── pyproject.toml
└── README.md
```

## 常见问题

**Q: 为什么 AC 设备的实际消耗功率比标称值大？**

A: 因为逆变器有损耗。如果逆变器效率是 85%，那么一个 100W 的 AC 设备，从电池端看实际消耗约 117W（100 / 0.85）。

**Q: 什么是占空比（duty_cycle）？**

A: 对于间歇性工作的设备（如压缩机式冰箱），它们不是持续满功率运行的。占空比 30% 表示每小时只有 30% 的时间在耗电。

**Q: 如何设置最低 SOC？**

A: 不同电池类型的推荐最低 SOC：
- 磷酸铁锂 (LiFePO4): 10-20%
- 三元锂: 15-20%
- 铅酸: 30-50%

## 许可证

MIT License
