# Cleanroom Verifier

洁净厂房压差级联和换气配置复核工具，用于批生产前验证洁净厂房的压差梯度和换气次数配置是否符合规范要求。

## 功能特性

- **压差梯度复核**：按房间邻接关系计算实际压差梯度，验证是否满足要求
- **ACH 换气次数计算**：根据送风流量和房间体积计算每小时换气次数
- **门开启影响分析**：分析门开启事件对压差的影响，识别瞬态变化
- **边界条件处理**：
  - 传感器缺采检测
  - Pa/inH2O 单位自动转换
  - 门开启瞬态误判过滤
- **多格式输出**：生成 CSV 问题列表、Markdown 报告和 HTML 趋势图表

## 安装

```bash
pip install -e .
```

或安装开发依赖：

```bash
pip install -e ".[dev]"
```

## 快速开始

### 1. 生成示例数据

```bash
cleanroom-verifier sample -o sample_data
```

这会在 `sample_data` 目录下生成以下示例文件：
- `rooms.json` - 房间配置
- `pressure_readings.csv` - 压力读数
- `airflow_setpoints.yaml` - 气流设定值
- `door_events.jsonl` - 门事件日志

### 2. 运行复核

```bash
cleanroom-verifier verify \
  -r sample_data/rooms.json \
  -p sample_data/pressure_readings.csv \
  -a sample_data/airflow_setpoints.yaml \
  -d sample_data/door_events.jsonl \
  -o output \
  -v
```

### 3. 查看输出

运行后会在 `output` 目录生成三个文件：

1. **issues.csv** - 问题列表，包含所有检测到的问题
2. **pressure_report.md** - 详细的 Markdown 格式报告
3. **pressure_trend.html** - 交互式 HTML 趋势图表（可直接用浏览器打开）

## 输入文件格式

### rooms.json (房间配置)

```json
{
  "rooms": [
    {
      "id": "A1",
      "name": "灌装间",
      "area": 20.0,
      "height": 2.8,
      "volume": 56.0,
      "adjacent_rooms": ["A2", "C1"],
      "classification": "Grade A",
      "required_pressure_diff": 15.0,
      "required_ach": 40.0
    }
  ]
}
```

### pressure_readings.csv (压力读数)

```csv
timestamp,room_id,pressure,unit,status
2026-05-03 08:00:00,A1,15.2,Pa,ok
2026-05-03 08:00:00,A2,14.8,Pa,ok
```

### airflow_setpoints.yaml (气流设定值)

```yaml
setpoints:
  A1:
    supply_air: 2400
    exhaust_air: 800
    supply_unit: "m3/h"
    exhaust_unit: "m3/h"
```

### door_events.jsonl (门事件日志)

```json
{"timestamp": "2026-05-03 08:05:30", "room_id": "B1", "event_type": "open", "duration": 8.5}
{"timestamp": "2026-05-03 08:05:45", "room_id": "B1", "event_type": "close"}
```

## 命令行参数

### verify 命令

| 参数 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| --rooms | -r | 房间配置 JSON 文件路径 | 必填 |
| --pressure | -p | 压力读数 CSV 文件路径 | 必填 |
| --airflow | -a | 气流设定值 YAML 文件路径 | 必填 |
| --door | -d | 门事件 JSONL 文件路径 | 必填 |
| --output | -o | 输出目录路径 | 当前目录 |
| --pressure-tolerance | | 压差容差 (Pa) | 2.0 |
| --ach-tolerance | | ACH 容差 (比例) | 0.1 (10%) |
| --sensor-gap-threshold | | 传感器缺采阈值 (秒) | 300 |
| --transient-threshold | | 门瞬态阈值 (Pa) | 5.0 |
| --verbose | -v | 显示详细输出 | False |

### sample 命令

| 参数 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| --output | -o | 示例数据输出目录 | sample_data |

## 项目结构

```
cleanroom_verifier/
├── __init__.py          # 包入口
├── cli.py               # CLI 入口
├── parser.py            # 解析模块
├── calculator.py        # 计算模块
├── rules.py             # 规则模块
├── exporter.py          # 导出模块
└── sample_data.py       # 示例数据
tests/
├── test_parser.py
├── test_calculator.py
└── test_rules.py
```

### 模块说明

| 模块 | 功能 |
|------|------|
| **parser** | 解析 JSON、CSV、YAML、JSONL 格式的输入文件 |
| **calculator** | 计算压差梯度、ACH 换气次数、门开启影响 |
| **rules** | 执行规则检查，处理边界条件 |
| **exporter** | 导出 CSV、Markdown、HTML 格式的报告 |
| **cli** | 命令行界面入口 |

## 运行测试

```bash
pytest
```

或带覆盖率：

```bash
pytest --cov=cleanroom_verifier
```

## 边界条件处理

### 传感器缺采

- 检测房间是否完全没有有效的压力读数
- 检测读数时间间隔是否超过阈值（默认 300 秒）
- 严重级别：CRITICAL（无读数）/ MEDIUM（时间间隔过大）

### 单位混用

- 自动识别 Pa 和 inH2O 单位
- 自动转换为统一单位（Pa）进行计算
- 检测报告中会提醒单位混用情况
- 严重级别：MEDIUM

### 门开启瞬态误判

- 区分瞬态变化和持续影响
- 瞬态变化：门开启后压力快速恢复（< 5 Pa 变化）
- 持续影响：压力变化超过阈值
- 瞬态变化标记为 INFO 级别，不影响复核结果

## 问题级别定义

| 级别 | 说明 | 示例 |
|------|------|------|
| CRITICAL | 严重问题，必须立即处理 | 压差反转、无传感器读数 |
| HIGH | 高优先级问题，需要尽快处理 | 压差不足、ACH 不足 |
| MEDIUM | 中优先级问题，建议关注 | 传感器读数间隙、单位混用 |
| LOW | 低优先级问题，可选处理 | 多次瞬态门事件 |

## 许可证

MIT License
