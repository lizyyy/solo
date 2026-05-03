# 供热换热站水力平衡复算工具

用于供热运维在寒潮前复算小区换热站水力平衡的 Python CLI 工具。

## 功能特性

- **多格式数据读取**: 支持 CSV（拓扑、天气）、JSONL（传感器）、YAML（阀门）
- **水力平衡计算**:
  - 供回水温差计算
  - 支路阻力近似估算
  - 实际热功率计算
  - 基于天气的需求热功率计算
  - 热量缺口分析
- **阀门调节建议**: 根据热量缺口智能计算阀门开度调整量
- **异常检测**:
  - 传感器数据缺失检测
  - 阀门越界检测
  - 温度反转检测（回水 > 供水）
  - 负流量检测
- **多格式报告输出**:
  - Markdown 详细分析报告
  - CSV 问题列表
  - 交互式 HTML 曲线图

## 快速开始

### 一条命令运行 Demo

```bash
# 安装依赖并运行 demo（使用内置 sample 数据）
pip install -e . && python -m heat_balance.cli demo
```

或安装后使用命令：

```bash
# 安装
pip install -e .

# 运行 demo（默认输出到 demo_reports 目录）
heat-balance demo

# 指定输出目录
heat-balance demo -o my_reports
```

### 查看帮助

```bash
heat-balance --help
heat-balance run --help
heat-balance demo --help
```

## 使用自有数据

```bash
heat-balance run \
  --topology data/topology.csv \
  --sensor data/sensor.jsonl \
  --valve data/valves.yaml \
  --weather data/weather.csv \
  --output reports/ \
  --name "我的小区供热分析" \
  --threshold 0.15
```

### 命令参数说明

| 参数 | 简写 | 必填 | 说明 |
|------|------|------|------|
| `--topology` | `-t` | 是 | 楼栋拓扑 CSV 文件 |
| `--sensor` | `-s` | 是 | 流量温度 JSONL 文件 |
| `--valve` | `-v` | 是 | 阀门设定 YAML 文件 |
| `--weather` | `-w` | 是 | 天气负荷曲线 CSV 文件 |
| `--output` | `-o` | 是 | 输出目录（自动创建） |
| `--name` | `-n` | 否 | 项目名称 |
| `--threshold` | | 否 | 平衡阈值（默认 0.15） |
| `--no-console` | | 否 | 禁用控制台详细输出 |

## 数据格式说明

### 1. 楼栋拓扑 (CSV)

```csv
unit_id,name,parent_id,unit_type,design_flow,design_heat_load,valve_id
HEAT_STATION,阳光小区换热站,,station,200.0,1500.0,V000
BUILDING_1,1号楼,HEAT_STATION,building,60.0,450.0,V001
APART_101,1号楼1单元,BUILDING_1,apartment,20.0,150.0,V101
```

| 字段 | 说明 |
|------|------|
| `unit_id` | 单元唯一标识 |
| `name` | 单元名称 |
| `parent_id` | 父单元 ID（用于构建拓扑树） |
| `unit_type` | 类型：station/building/apartment |
| `design_flow` | 设计流量 (m³/h) |
| `design_heat_load` | 设计热负荷 (kW) |
| `valve_id` | 关联阀门 ID |

### 2. 传感器数据 (JSONL)

每行一个 JSON 对象：

```json
{"unit_id": "APART_101", "timestamp": "2024-12-01 06:00:00", "supply_temp": 80.0, "return_temp": 58.0, "flow_rate": 18.0}
```

支持的时间戳格式：
- `YYYY-MM-DD HH:MM:SS`
- `YYYY-MM-DDTHH:MM:SS`
- `YYYY/MM/DD HH:MM:SS`

缺失值表示：`null`, `"NA"`, `"N/A"`, `""`

### 3. 阀门设定 (YAML)

```yaml
valves:
  - valve_id: V101
    unit_id: APART_101
    current_open_rate: 50.0
    min_open_rate: 5.0
    max_open_rate: 95.0
    is_enabled: true
```

| 字段 | 说明 |
|------|------|
| `valve_id` | 阀门唯一标识 |
| `unit_id` | 关联单元 ID |
| `current_open_rate` | 当前开度 (%) |
| `min_open_rate` | 最小允许开度 (%) |
| `max_open_rate` | 最大允许开度 (%) |
| `is_enabled` | 阀门是否启用 |

### 4. 天气负荷曲线 (CSV)

```csv
timestamp,outdoor_temp,design_load_ratio,heat_loss_factor
2024-12-01 06:00:00,-8.5,0.98,1.12
```

| 字段 | 说明 |
|------|------|
| `timestamp` | 时间戳 |
| `outdoor_temp` | 室外温度 (°C) |
| `design_load_ratio` | 设计负荷比例 (0.0-1.0+) |
| `heat_loss_factor` | 环境热损失系数 |

## 输出文件说明

运行完成后，输出目录包含以下文件：

### 1. `imbalance_report.md`

详细的 Markdown 分析报告，包含：
- 整体概览表格
- 异常统计
- 热量缺口统计
- 各单元失衡详情（含各时间片数据）
- 阀门调节建议
- 检测到的异常列表

### 2. `issues.csv`

所有问题的 CSV 列表，便于导入 Excel 处理：

| 列名 | 说明 |
|------|------|
| `timestamp` | 时间戳 |
| `unit_id` | 单元 ID |
| `unit_name` | 单元名称 |
| `issue_type` | 问题类型 |
| `severity` | 严重程度 |
| `description` | 描述 |
| `current_valve` | 当前阀门开度 |
| `recommended_adjust` | 建议调整 |

### 3. `hydraulic_balance_charts.html`

交互式 HTML 图表页面，用浏览器打开即可查看：
- 整体热量缺口趋势柱状图
- 单元平衡状态饼图
- 各单元实际/需求热功率对比曲线图

## 异常类型说明

| 类型 | 说明 | 处理建议 |
|------|------|----------|
| `sensor_missing` | 传感器数据缺失 | 检查传感器连接和数据采集 |
| `valve_out_of_bounds` | 阀门越界 | 调整阀门开度至允许范围 |
| `temperature_inversion` | 温度反转（回水>供水） | 检查温度传感器安装方向 |
| `negative_flow` | 负流量 | 检查流量计安装方向 |
| `imbalance` | 水力失衡 | 按建议调整阀门 |

## 计算原理

### 热功率计算公式

```
Q (kW) = 流量 (kg/s) × 水比热 (4.186 kJ/kg·°C) × 温差 (°C)
```

其中：
- 流量单位转换：`m³/h` → `kg/s` = `flow × 1000 / 3600`

### 阀门调节算法

```
调节系数 = 1.0 + 热量缺口比例

若热量缺口 > 0（供热不足）：
    目标开度 = 当前开度 + 调节比例 × (最大开度 - 当前开度)

若热量缺口 < 0（供热过量）：
    目标开度 = 当前开度 - 调节比例 × (当前开度 - 最小开度)

调节比例取 min(abs(热量缺口比例), 0.5)，单次最大调节50%
```

## 项目结构

```
zy8226/
├── pyproject.toml          # 项目配置
├── README.md              # 本文件
├── heat_balance/
│   ├── __init__.py        # 包初始化
│   ├── models.py          # 数据模型
│   ├── readers.py         # 数据读取器
│   ├── calculator.py      # 水力平衡计算器
│   ├── exporters.py       # 报告导出器
│   └── cli.py             # 命令行入口
└── sample_data/
    ├── topology.csv       # 示例拓扑数据
    ├── sensor.jsonl       # 示例传感器数据（含异常）
    ├── valves.yaml        # 示例阀门设定（含越界）
    └── weather.csv        # 示例天气负荷曲线
```

## 依赖

- Python >= 3.8
- pandas >= 2.0.0
- pyyaml >= 6.0
- plotly >= 5.14.0
- numpy >= 1.24.0
- rich >= 13.0.0

## License

MIT License
