# Elevator QC

电梯维保质量检测工具 - 一个本地 Python CLI 工具，用于分析电梯运行数据。

## 功能

- 导入 trips.csv、vibration.jsonl、maintenance_rules.yaml
- 按单次运行切分加速度曲线
- 计算峰值、RMS、jerk、停层偏差和门区抖动
- 输出 alerts.csv、trip_report.md 和可打开的 HTML 趋势图
- 处理时间戳乱序、缺失楼层标记等边界情况

## 安装

```bash
pip install -e .
```

依赖：
- pandas
- numpy
- pyyaml
- plotly

## 快速开始

运行 demo：

```bash
python -m elevator_qc demo
```

或使用 CLI：

```bash
elevator-qc demo
```

这将：
1. 在 `sample_data/` 目录下生成示例数据
2. 运行完整分析
3. 在 `output/` 目录下生成结果

## 使用自定义数据

```bash
python -m elevator_qc run --trips your_trips.csv --vibration your_vibration.jsonl --rules your_rules.yaml --output-dir your_output
```

## 输入文件格式

### trips.csv

| 列名 | 类型 | 说明 |
|------|------|------|
| trip_id | string | 行程 ID |
| timestamp | ISO8601 | 时间戳 |
| floor | float | 楼层 |
| direction | string | "up" 或 "down" |
| door_open | boolean | 门是否打开 |

### vibration.jsonl

每行一个 JSON 对象：
```json
{"timestamp": "2024-01-01T00:00:00", "ax": 0.1, "ay": 0.2, "az": 0.05}
```

### maintenance_rules.yaml

```yaml
peak:
  ax: 2.0
  ay: 2.0
  az: 2.0
rms:
  ax: 0.5
  ay: 0.5
  az: 0.5
jerk:
  ax: 10.0
stop_deviation:
  max: 0.5
door_jitter:
  max: 1.0
```

## 输出文件

- `alerts.csv`: 告警信息
- `trip_report.md`: 详细报告
- `trends.html`: 交互式趋势图（用浏览器打开）

## 项目结构

```
elevator_qc/
├── __init__.py
├── cli.py                 # CLI 入口
├── data_reader.py         # 数据读取和校验
├── trip_segmentation.py   # 行程切分
├── feature_calculation.py # 特征计算
├── anomaly_scoring.py     # 规则和异常评分
└── exporter.py            # 导出功能
```
