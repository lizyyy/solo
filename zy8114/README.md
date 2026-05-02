# 风电机组偏航效率复核器

一个本地 Python CLI 工具，用于分析风电机组 SCADA 数据，计算偏航误差、估算功率损失，检测风向仪漂移和长期对风偏差问题。

## 功能特性

- **时间线重建**: 按机组重建风向和机舱角度时间线
- **偏航误差计算**: 智能处理 359/0 度角度环绕问题
- **功率损失估算**: 基于偏航误差估算发电量损失
- **问题检测**:
  - 风向仪漂移（系统性偏差）
  - 长期对风偏差
  - 过度偏航误差
  - 数据质量问题（缺采样、数据缺口）
- **多格式输出**:
  - `report.md` - 详细分析报告
  - `issues.csv` - 检测到的问题列表
  - `turbine_timeline.html` - 交互式时间线可视化

## 快速开始

### 环境要求

- Python 3.9+

### 安装

```bash
pip install -e .
```

或

```bash
pip install -r requirements.txt
```

### 运行 Demo

一条命令跑通示例：

```bash
python -m yaw_checker.main -t sample/turbine.csv -s sample/scada_10min.csv -r sample/wind_rules.yaml -o output
```

或使用已安装的命令：

```bash
yaw-checker -t sample/turbine.csv -s sample/scada_10min.csv -r sample/wind_rules.yaml -o output
```

运行后查看输出目录 `output/` 目录下生成：
- `report.md` - 分析报告
- `issues.csv` - 问题列表
- `turbine_timeline.html` - 时间线可视化

### 命令行参数

```bash
yaw-checker --help
```

```
Options:
  -t, --turbine PATH   turbine.csv 文件路径 [required]
  -s, --scada PATH       scada_10min.csv 文件路径 [required]
  -r, --rules PATH       wind_rules.yaml 文件路径 [required]
  -o, --output PATH      输出目录路径 (默认: ./output)
  -v, --verbose          显示详细输出
  --help                 显示帮助信息
```

## 输入文件格式

### 1. turbine.csv - 机组信息

| 列名 | 类型 | 说明 |
|------|------|------|
| turbine_id | string | 机组编号 |
| rated_power | float | 额定功率 (kW) |
| installation_date | string (可选) | 安装日期 |
| nacelle_direction_offset | float (可选) | 机舱角度偏移量 (度) |

示例：
```csv
turbine_id,rated_power,installation_date,nacelle_direction_offset
WTG01,2000,2020-01-15,0.0
WTG02,2500,2021-03-20,2.5
```

### 2. scada_10min.csv - SCADA 数据

| 列名 | 类型 | 说明 |
|------|------|------|
| turbine_id | string | 机组编号 |
| timestamp | string | 时间戳 (YYYY-MM-DD HH:MM:SS) |
| wind_direction | float | 风向 (度, 0-360) |
| nacelle_angle | float | 机舱角度 (度, 0-360) |
| active_power | float | 有功功率 (kW) |
| wind_speed | float | 风速 (m/s) |

示例：
```csv
turbine_id,timestamp,wind_direction,nacelle_angle,active_power,wind_speed
WTG01,2026-05-01 00:00:00,275.0,270.0,1250.0,8.5
WTG01,2026-05-01 00:10:00,276.5,271.5,1320.0,8.8
```

### 3. wind_rules.yaml - 分析规则配置

```yaml
yaw_error_threshold: 15.0           # 偏航误差阈值 (度)
power_loss_factor: 0.0015          # 功率损失系数
anemometer_drift_threshold: 5.0     # 风向仪漂移阈值 (度)
long_term_bias_threshold: 8.0      # 长期对风偏差阈值 (度)
long_term_bias_period_hours: 24       # 长期偏差统计周期 (小时)
valid_wind_speed_range: [3.0, 25.0] # 有效风速范围 (m/s)
min_data_points_for_analysis: 10      # 分析所需最少数据点数
yaw_efficiency_target: 0.98           # 偏航效率目标值
```

## 核心算法

### 角度差计算 (处理 359/0 环绕)

```
diff = angle2 - angle1
if diff > 180:
    diff -= 360
elif diff <= -180:
    diff += 360
```

### 偏航误差计算

```
偏航误差 = 风向 - (机舱角度 + 机舱偏移)
```

### 功率损失估算

```
功率损失 = 实际功率 * (1 - cos(偏航误差角度)) * 损失系数
```

仅在有效风速范围内 (3-25 m/s) 计算。

## 项目结构

```
.
├── yaw_checker/
│   ├── __init__.py
│   ├── main.py           # CLI 入口
│   ├── parsers.py        # 数据解析模块
│   ├── calculator.py     # 计算模块
│   ├── rules.py          # 规则检测模块
│   └── reports.py        # 报告生成模块
├── sample/
│   ├── turbine.csv
│   ├── scada_10min.csv
│   └── wind_rules.yaml
├── tests/
│   ├── __init__.py
│   ├── test_parsers.py
│   ├── test_calculator.py
│   └── test_rules.py
├── setup.py
├── requirements.txt
└── README.md
```

## 运行测试

```bash
pytest -v
```

## 输出文件说明

### report.md

包含：
- 执行摘要
- 问题详情（按严重程度分级）
- 每台机组详细统计
- 规则配置参数

### issues.csv

包含所有检测到的问题，列包括：
- turbine_id: 机组编号
- issue_type: 问题类型
- severity: 严重程度
- description: 问题描述
- start_time/end_time: 时间范围
- affected_samples: 影响采样点数
- metric_value: 检测值
- threshold: 阈值
- recommendation: 建议

### turbine_timeline.html

交互式 HTML 时间线，包括：
- 汇总统计卡片
- 可展开的机组详情
- 最近 20 条数据预览表

## 问题类型说明

| 问题类型 | 说明 | 检测逻辑 |
|----------|------|----------|
| anemometer_drift | 风向仪漂移 | 平均偏航误差持续超过阈值 |
| long_term_yaw_bias | 长期对风偏差 | 连续多个时间段平均偏差超过阈值 |
| excessive_yaw_error | 过度偏航误差 | 超过 20% 采样点偏航误差超过阈值 |
| missing_data | 数据不足 | 采样点少于最低要求 |
| data_gap | 数据缺口 | 超过 10% 时间间隔异常 |

## 严重程度分级

| 等级 | 说明 |
|------|------|
| critical | 严重，需要立即处理 |
| high | 高优先级，建议尽快处理 |
| medium | 中等，建议关注 |
| low | 低，定期检查即可 |

## License

MIT License
