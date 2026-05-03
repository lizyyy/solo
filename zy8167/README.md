# Signal Replay - 交通信号配时重放工具

一个面向交通信号配时工程师的本地 Python CLI 工具，用于重放路口全天相位时间线并检测配时问题。

## 功能特性

- **导入多格式数据**: 支持 CSV、JSON、JSONL、YAML 格式
- **时间线重放**: 按路口重放一整天的相位时间线
- **规则检查**:
  - 行人清空时间不足
  - 公交优先插入导致绿波偏移
  - 检测器断采
  - 跨午夜计划切换
- **多格式输出**:
  - `issues.csv` - 问题清单
  - `signal_report.md` - 分析报告
  - `timeline.html` - 可视化时间线

## 安装

```bash
pip install -e .
```

或者直接使用模块方式运行（无需安装）。

## 快速开始

### 使用示例数据运行

项目包含完整的示例数据，位于 `sample_data/` 目录。

```bash
python -m signal_replay run \
  --intersections sample_data/intersections.csv \
  --phase-plans sample_data/phase_plan.json \
  --detector-events sample_data/detector_events.jsonl \
  --rules sample_data/rules.yaml \
  --output ./output \
  --date 2026-05-03
```

### 命令行参数

```
usage: signal_replay run [-h] -i FILE -p FILE -d FILE -r FILE -o DIR [--date DATE]

可选参数:
  -h, --help            显示帮助信息
  -i FILE, --intersections FILE
                        路口信息 CSV 文件路径
  -p FILE, --phase-plans FILE
                        相位配时计划 JSON 文件路径
  -d FILE, --detector-events FILE
                        检测器事件 JSONL 文件路径
  -r FILE, --rules FILE
                        规则配置 YAML 文件路径
  -o DIR, --output DIR
                        输出目录路径
  --date DATE           分析日期 (ISO 格式: YYYY-MM-DD)，默认为今天
```

## 输入文件格式

### 1. intersections.csv - 路口信息

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 路口唯一标识 |
| name | string | 路口名称 |
| location | string | 路口位置 |
| total_phases | int | 总相位数量 |
| pedestrian_phases | string | 行人相位（逗号分隔，如 "1,3"） |
| bus_phases | string | 公交优先相位（逗号分隔，如 "2,4"） |

示例:
```csv
id,name,location,total_phases,pedestrian_phases,bus_phases
INT001,中关村路口,北京市海淀区中关村大街,4,"1,3","2,4"
```

### 2. phase_plan.json - 相位配时计划

```json
[
  {
    "intersection_id": "INT001",
    "plan_id": "PEAK_MORNING",
    "name": "早高峰计划",
    "start_time": "07:00:00",
    "end_time": "09:00:00",
    "cycle_length": 120,
    "phases": [
      {"phase_id": 1, "duration": 35, "is_pedestrian": true, "is_bus_priority": false},
      {"phase_id": 2, "duration": 25, "is_pedestrian": false, "is_bus_priority": true}
    ]
  }
]
```

**注意**: 跨午夜计划请设置 `end_time` 早于 `start_time`，如 `start_time: "19:00:00"`, `end_time: "07:00:00"`。

### 3. detector_events.jsonl - 检测器事件

每行一个 JSON 对象:

```json
{"intersection_id": "INT001", "detector_id": "D001", "timestamp": "2026-05-03T07:00:05", "event_type": "detection", "vehicle_type": "car"}
```

### 4. rules.yaml - 规则配置

```yaml
pedestrian_clearance_min: 8        # 行人清空时间最小值（秒）
bus_priority_max_impact: 10        # 公交优先最大影响时间（秒）
detector_gap_threshold: 300        # 检测器断采阈值（秒）
midnight_transition_grace: 60      # 午夜切换宽限时间（秒）
```

## 输出文件说明

### 1. issues.csv

包含所有检测到的问题，字段包括:
- `timestamp` - 问题发生时间
- `intersection_id` - 路口ID
- `issue_type` - 问题类型
- `severity` - 严重程度 (high/medium/info)
- `description` - 问题描述
- `details` - 详细信息
- `phase_id` - 相关相位ID
- `plan_id` - 相关计划ID

### 2. signal_report.md

Markdown 格式的分析报告，包含:
- 问题概览统计
- 规则配置
- 路口概览
- 问题详情表格

### 3. timeline.html

可视化时间线网页，可在浏览器中打开查看:
- 各路口全天相位时间线
- 行人相位和公交优先相位标识
- 问题点标记

## 代码结构

```
signal_replay/
├── __init__.py
├── __main__.py      # CLI 入口
├── parser.py        # 解析模块 - 解析各种输入文件
├── timeline.py      # 时间线模块 - 生成相位时间线
├── rules.py         # 规则模块 - 检查各类问题
└── exporter.py      # 导出模块 - 生成输出文件
```

## 问题类型说明

| 问题类型 | 说明 | 严重程度 |
|----------|------|----------|
| pedestrian_clearance_insufficient | 行人清空时间低于最小值 | high |
| bus_priority_green_wave_offset | 公交优先插入导致相位延长超过阈值 | medium |
| detector_gap_exceeded | 检测器事件间隔超过阈值 | medium/high |
| midnight_plan_transition_issue | 跨午夜计划切换存在缺口或跨午夜执行 | high/info |

## 演示命令

完整演示命令（使用示例数据）:

```bash
# 方法1: 完整参数
python -m signal_replay run \
  --intersections sample_data/intersections.csv \
  --phase-plans sample_data/phase_plan.json \
  --detector-events sample_data/detector_events.jsonl \
  --rules sample_data/rules.yaml \
  --output ./output \
  --date 2026-05-03

# 方法2: 简写参数
python -m signal_replay run \
  -i sample_data/intersections.csv \
  -p sample_data/phase_plan.json \
  -d sample_data/detector_events.jsonl \
  -r sample_data/rules.yaml \
  -o ./output

# 查看帮助
python -m signal_replay --help
python -m signal_replay run --help
```

运行后查看输出:
```bash
# 查看问题清单
cat output/issues.csv

# 查看分析报告
cat output/signal_report.md

# 在浏览器中打开时间线
open output/timeline.html
```

## 许可证

MIT License
