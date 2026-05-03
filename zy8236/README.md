# Smoke CLI - 商场消防排烟联动复核工具

商场消防维保人员离线复核排烟联动的 Python CLI 工具。

## 功能

- **validate**: 验证数据文件的完整性和格式正确性
- **review**: 重建每个防烟分区的报警-风机-阀门时间线，计算启动延迟、有效排烟量和传感器断采
- **export**: 导出 issues.csv 和 smoke_review.md 报告

## 检测的问题类型

| 问题类型 | 说明 | 严重程度 |
|---------|------|---------|
| `midnight_event_misassignment` | 跨午夜事件归属错误 - 事件发生在午夜前后，可能日期归属错误 | CRITICAL |
| `fan_start_without_damper_open` | 风机已启但阀门未开 - 排烟无效风险 | CRITICAL |
| `delay_exceeded` | 启动延迟超过阈值(默认30秒) | CRITICAL |
| `sensor_gap` | 传感器数据断采 | WARNING |
| `missing_field` | 数据文件缺少必需字段 | INFO |
| `invalid_value` | 字段值格式或内容无效 | INFO |

## 安装

```bash
# 安装依赖
pip install click pyyaml pandas python-dateutil

# 或使用项目方式安装
pip install -e .
```

## 快速开始

### 一条可直接跑通的 Demo

```bash
# 1. 验证数据
python -m smoke_cli.main validate

# 2. 复核分析
python -m smoke_cli.main review

# 3. 导出报告
python -m smoke_cli.main export --output ./output
```

预期输出:

```
正在验证数据目录: ./sample

验证通过！未发现任何错误。
```

```
正在分析数据目录: ./sample

正在重建时间线并分析...

============================================================
复核结果摘要
============================================================

防烟分区: 1楼东区防烟分区 (Z001) - 有1个问题
  启动延迟: 45.0秒 (超标)
  有效排烟量: 10750.00 m³
    - [delay_exceeded] 风机启动延迟超过阈值 30 秒，实际延迟 45.0 秒 (2024-05-15T14:32:45)

防烟分区: 1楼西区防烟分区 (Z002) - 有1个问题
  启动延迟: None 秒
    - [fan_start_without_damper_open] 风机 F001 已启动，但未检测到对应阀门打开事件 (2024-05-15T16:00:00)

防烟分区: 2楼北区防烟分区 (Z003) - 有2个问题
  启动延迟: 40.0秒 (超标)
    - [delay_exceeded] 风机启动延迟超过阈值 30 秒，实际延迟 40.0 秒 (2024-05-16T00:06:10)
    - [midnight_event_misassignment] 跨午夜事件可能存在归属错误，请核实事件时间: 2024-05-16 00:05:30 (2024-05-16T00:05:30)

复核完成，共发现 5 个问题。

运行 'smoke-cli export --output ./output' 可导出完整报告。
```

```
正在从 ./sample 读取数据...
正在进行复核分析...
正在导出 issues.csv...
正在导出 smoke_review.md...

导出完成！
  - 问题列表: output/issues.csv
  - 复核报告: output/smoke_review.md
```

## 数据文件格式

### sample/zones.yaml (防烟分区配置)

```yaml
- zone_id: "Z001"
  zone_name: "1楼东区防烟分区"
  floor: 1
  area: 250.5
  assigned_fans: ["F001"]
  assigned_dampers: ["D001", "D002"]
  sensors: ["S001", "S002"]
```

**必需字段**: `zone_id`, `zone_name`, `floor`, `area`

### sample/fans.csv (风机信息)

```csv
fan_id,fan_name,rated_flow,max_flow,assigned_zones
F001,1楼排烟风机1号,15000.0,20000.0,"Z001,Z002"
```

**必需字段**: `fan_id`, `fan_name`, `rated_flow`, `max_flow`

### sample/damper_events.jsonl (阀门事件)

```json
{"damper_id": "D001", "event_time": "2024-05-15 14:32:00", "event_type": "alarm", "zone_id": "Z001"}
{"damper_id": "D001", "event_time": "2024-05-15 14:32:45", "event_type": "fan_start", "zone_id": "Z001"}
{"damper_id": "D001", "event_time": "2024-05-15 14:32:50", "event_type": "damper_open", "zone_id": "Z001"}
```

**必需字段**: `damper_id`, `event_time`, `event_type`

**事件类型识别**:
- 包含 `alarm`: 报警事件
- 包含 `fan` 且 `start`: 风机启动
- 包含 `fan` 且 `stop`: 风机停止
- 包含 `open`: 阀门打开
- 包含 `close`: 阀门关闭

### sample/sensor_minutes.csv (传感器分钟数据)

```csv
sensor_id,timestamp,co2,smoke,temp
S001,2024-05-15 14:30:00,420.5,0.0,23.5
S001,2024-05-15 14:31:00,425.0,0.0,23.6
```

**必需字段**: `sensor_id`, `timestamp`

## 缺字段样例的可读报错

使用 `sample-bad/` 目录测试缺字段报错:

```bash
python -m smoke_cli.main --sample-dir ./sample-bad validate
```

**预期输出**:

```
正在验证数据目录: ./sample-bad

读取阶段发现错误:
  [missing_field] sample-bad/zones.yaml 第1行: 缺少必需字段: zone_id
    字段: zone_id
    原始值: {'zone_name': '1楼东区防烟分区', 'floor': 1, 'area': 250.5, 'assigned_fans': ['F001']}
  [missing_field] sample-bad/fans.csv 第1行: 缺少表头: fan_id, max_flow
    字段: fan_id, max_flow
    原始值: fan_name, rated_flow
  [invalid_value] sample-bad/damper_events.jsonl 第2行: JSON解析错误: Expecting value: line 1 column 1 (char 0)
    原始值: invalid json line
  [invalid_value] sample-bad/sensor_minutes.csv 第3行: 时间格式错误: 无法解析时间格式: invalid_time
    字段: timestamp
    原始值: invalid_time

验证阶段发现错误:
  [invalid_value] zones.yaml: 防烟分区 Z001 引用了不存在的风机: F001
  [invalid_value] fans.csv: 风机 F001 引用了不存在的防烟分区: Z001
  [sensor_gap] sensor_minutes.csv: 传感器 S001 存在数据断采: 2024-05-15 14:30:00 到 2024-05-15 15:00:00, 断采时长 30.0 分钟

验证完成，共发现 7 个问题。
```

## CLI 命令详解

```bash
# 查看帮助
python -m smoke_cli.main --help

# 验证数据
python -m smoke_cli.main validate
python -m smoke_cli.main --sample-dir ./my-data validate

# 复核分析
python -m smoke_cli.main review
python -m smoke_cli.main -d ./my-data review

# 导出报告
python -m smoke_cli.main export
python -m smoke_cli.main export --output ./my-output
```

## 输出文件说明

### output/issues.csv

| 列名 | 说明 |
|-----|------|
| zone_id | 防烟分区ID |
| zone_name | 防烟分区名称 |
| issue_type | 问题类型 |
| description | 问题描述 |
| time | 发生时间 |
| severity | 严重程度 (CRITICAL/WARNING/INFO) |
| details | 额外详情 |

### output/smoke_review.md

包含:
- 问题摘要统计
- 数据验证错误详情
- 每个防烟分区的分析详情
  - 基本信息
  - 事件时间线表格
  - 发现的问题列表
- 问题类型说明附录

## 时间格式支持

以下时间格式均可解析:
- `2024-05-15 14:32:00`
- `2024-05-15 14:32`
- `2024/05/15 14:32:00`
- `2024/05/15 14:32`
- `2024-05-15T14:32:00`
- `2024-05-15T14:32`

## 配置参数

- **启动延迟阈值**: 30秒 (可在 `reviewer.py` 中修改 `MAX_START_DELAY_SECONDS`)
- **传感器断采阈值**: 5分钟 (可在 `reviewer.py` 中修改 `SENSOR_GAP_THRESHOLD_MINUTES`)
