# Mooring QC - 港口缆绳张力质量检查工具

本地 Python CLI 工具，用于港口码头安全员复核靠泊期间缆绳张力。

## 功能特性

- **数据解析**: 支持 CSV、JSON、JSONL、YAML 多种格式
- **时间对齐**: 自动处理跨午夜靠泊场景
- **单位转换**: 自动处理 kN/tonf 单位混用（1 tonf = 9.80665 kN）
- **规则判定**: 张力峰值、持续超限、传感器漂移、数据缺测检测
- **报告导出**: Markdown 报告、CSV 告警、HTML 时间线可视化

## 安装

```bash
pip install -e .
```

## 输入文件格式

### 泊位计划 CSV (berth_plan.csv)

```csv
vessel_name,berth_id,arrival_time,departure_time,max_tension_kn,vessel_type
MV Pacific Glory,A1,2026-05-01T22:30:00,2026-05-02T06:45:00,450,cargo
```

### 潮汐/风速 JSON (tidewind.json)

```json
[
  {"timestamp": "2026-05-01T22:00:00", "tide_m": 2.3, "wind_speed_kn": 12.5, "wind_dir_deg": 45}
]
```

### 缆绳传感器 JSONL (sensor.jsonl)

```jsonl
{"timestamp": "2026-05-01T22:30:00", "sensor_id": "S01", "tension_kn": 120.5, "unit": "kN"}
{"timestamp": "2026-05-02T03:00:00", "sensor_id": "S03", "tension_kn": 25.0, "unit": "tonf"}
```

### 船型规则 YAML (vessel_rules.yaml)

```yaml
default:
  max_tension_kn: 500
  peak_threshold_kn: 400
  drift_threshold_pct: 0.05
  missing_gap_seconds: 300
```

## 使用方法

```bash
python -m mooring_qc run \
  --berth-plan sample/berth_plan.csv \
  --tidewind sample/tidewind.json \
  --sensor sample/sensor.jsonl \
  --rules sample/vessel_rules.yaml \
  --output ./output
```

## 输出文件

- `*_report.md` - 详细 Markdown 报告
- `*_alerts.csv` - 告警汇总 CSV
- `*_timeline.html` - 交互式 HTML 时间线

## 完整示例

```bash
cd /Users/lzy/pro/solocoder/pro/zy8071/repo/zy8071
python -m mooring_qc run \
  --berth-plan sample/berth_plan.csv \
  --tidewind sample/tidewind.json \
  --sensor sample/sensor.jsonl \
  --rules sample/vessel_rules.yaml \
  --output ./output
```

## 依赖

- Python >= 3.10
- pyyaml
- chart.js (通过 CDN 加载)
