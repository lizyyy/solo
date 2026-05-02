# Race Arbiter

路跑/越野赛计时芯片成绩仲裁工具。

## 功能

- 读取参赛名单 CSV、计时毯 JSONL、赛事规则 YAML、人工申诉 JSON
- 重建每个选手的起终点与分段成绩
- 识别漏刷、错绑芯片、重复过点、跨日净计时和关门时间违规
- 导出结果（CSV）、申诉报告（Markdown）、时间线（HTML）

## 安装

```bash
pip install -e .
```

## 使用

### Demo 命令

直接运行示例数据：

```bash
race-arbiter \
  -e data/examples/entries.csv \
  -t data/examples/timings.jsonl \
  -r data/examples/rules.yaml \
  -a data/examples/appeals.json \
  -o output
```

运行后会在 `output` 目录生成：
- `results.csv` - 最终成绩
- `appeals_report.md` - 仲裁报告
- `timeline.html` - 时间线视图

### 参数说明

- `-e, --entries`: 参赛名单 CSV（必填）
- `-t, --timings`: 计时数据 JSONL（必填）
- `-r, --rules`: 赛事规则 YAML（必填）
- `-a, --appeals`: 人工申诉 JSON（可选）
- `-o, --output-dir`: 输出目录（默认：当前目录）

## 数据格式

### 参赛名单 CSV

```csv
bib,name,category,chip_id
1001,Alice,42K,CHIP001
```

### 计时数据 JSONL

每行一个 JSON 对象：

```json
{"chip_id": "CHIP001", "mat_id": "START", "timestamp": "2024-04-01T08:00:00"}
```

### 赛事规则 YAML

```yaml
race_name: "City Marathon 2024"
start_mat: "START"
end_mat: "FINISH"
segments:
  - id: "seg1"
    name: "Start to CP1"
    order: 1
    from_mat: "START"
    to_mat: "CP1"
cutoffs:
  - segment_id: "seg1"
    time_limit: "1:30:00"
    mat: "CP1"
```

### 人工申诉 JSON

```json
[
    {
        "bib": "1003",
        "type": "missing_mat",
        "mat_id": "FINISH",
        "timestamp": "2024-04-01T12:10:00",
        "note": "Manual finish time"
    }
]
```

## 测试

```bash
pip install -e ".[dev]"
pytest
```

## 许可证

MIT
