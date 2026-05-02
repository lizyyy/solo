# 织机停台分析工具 (Loom Downtime Analyzer)

一个用于纺织车间织机停台原因分析的Python命令行工具。

## 功能特性

- **多格式数据解析**: 支持CSV（停台事件）、JSON（班次计划）、YAML（纱线批次）、JSONL（传感器数据）
- **数据清洗**: 自动处理重复事件、缺测数据
- **班次对齐**: 支持跨午夜班次的时间对齐
- **根因分类**: 自动识别断经、纬停、换轴、传感器误报、机械故障等原因
- **多格式导出**: 生成CSV汇总表、Markdown根因报告、HTML交互式时间线
- **交互式可视化**: 可直接在浏览器中打开的时间线图表

## 安装

```bash
# 克隆项目
cd loom-downtime-analyzer

# 安装依赖
pip install -e .
```

## 依赖

- Python 3.9+
- pandas
- pyyaml
- jinja2
- click

## 使用方法

### 快速开始 (Demo)

使用示例数据运行分析：

```bash
loom-analyze -e sample_data/downtime_events.csv -s sample_data/shifts.json -y sample_data/yarn_batches.yaml -n sample_data/sensors.jsonl -o ./output -v
```

### 完整参数说明

```
选项:
  -e, --events PATH     停台事件CSV文件路径 [必需]
  -s, --shifts PATH     班次计划JSON文件路径 [必需]
  -y, --yarn PATH       纱线批次YAML文件路径 [必需]
  -n, --sensors PATH    传感器时序JSONL文件路径 [必需]
  -o, --output-dir PATH 输出目录 (默认: ./output)
  -v, --verbose         显示详细输出
  --help                显示帮助信息
```

### 输入数据格式

#### 1. 停台事件 (downtime_events.csv)

| 字段 | 类型 | 说明 |
|------|------|------|
| machine_id | string | 织机ID |
| start_time | ISO8601 | 停台开始时间 |
| end_time | ISO8601 | 停台结束时间 |
| event_code | string | 事件代码 |
| description | string | 事件描述 |

#### 2. 班次计划 (shifts.json)

```json
[
    {
        "id": "shift-001",
        "name": "早班",
        "date": "2024-05-01",
        "start_time": "2024-05-01T08:00:00",
        "end_time": "2024-05-01T16:00:00"
    }
]
```

#### 3. 纱线批次 (yarn_batches.yaml)

```yaml
- batch_id: YARN-2024-001
  yarn_type: 纯棉40s
  machine_ids: [Loom-001, Loom-002]
  start_date: 2024-05-01
  end_date: 2024-05-07
```

#### 4. 传感器数据 (sensors.jsonl)

每行一个JSON对象：

```json
{"machine_id": "Loom-001", "sensor_type": "tension", "timestamp": "2024-05-01T08:15:00", "value": 45}
```

### 输出文件

运行后在输出目录生成：

1. **downtime_summary.csv**: 停台事件汇总表
2. **root_cause_report.md**: 根因分析报告
3. **machine_timeline.html**: 织机时间线图表（可直接在浏览器打开）

## 项目结构

```
loom-downtime-analyzer/
├── loom_analyzer/
│   ├── __init__.py
│   ├── parser.py        # 数据解析模块
│   ├── validator.py     # 数据校验模块
│   ├── aligner.py       # 班次对齐模块
│   ├── root_cause.py    # 根因分类模块
│   ├── statistics.py    # 统计分析模块
│   ├── exporter.py      # 导出模块
│   └── cli.py           # CLI主程序
├── sample_data/         # 示例数据
├── tests/               # 测试文件
├── pyproject.toml
└── README.md
```

## 运行测试

```bash
pip install pytest
pytest tests/
```

## 许可证

MIT License
