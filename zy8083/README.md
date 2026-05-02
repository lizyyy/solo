# Evacuation Audit CLI

物业消防负责人复盘商办楼疏散演练的本地 Python CLI 工具。

## 功能特性

- **输入文件**: `occupant_roster.csv`、`door_events.jsonl`、`floor_plan.json`、`drill_rules.yaml`
- **分析功能**:
  - 按楼层/人员重建撤离时间线
  - 识别反向通行 (Reverse Movement)
  - 检测出口拥堵 (Exit Congestion)
  - 滞留超时检测 (Stray/Timeout)
  - 门点缺失检查 (Missing Door Scan)
  - 跨楼层绕行检测 (Cross-floor Detour)
  - 同一门点重复刷卡检测 (Duplicate Door Scan)
- **输出报告**: `evacuation_report.md`、`violations.csv`、`timeline.html`

## 安装

```bash
pip install -e .
```

## 使用方法

```bash
python -m evacuation_audit run \
  --roster evacuation_audit/data/occupant_roster.csv \
  --events evacuation_audit/data/door_events.jsonl \
  --floor-plan evacuation_audit/data/floor_plan.json \
  --rules evacuation_audit/data/drill_rules.yaml \
  --output-dir ./output
```

## 样本数据说明

### `occupant_roster.csv`
| 字段 | 说明 |
|------|------|
| occupant_id | 人员唯一标识 |
| name | 姓名 |
| floor | 所属楼层 |
| zone | 区域 |
| role | 角色 (Employee/Manager/Fire Warden) |

### `door_events.jsonl`
每行 JSON 格式:
```json
{"timestamp": 0.0, "occupant_id": "O001", "door_id": "D301", "event_type": "pass", "floor": 3}
```

| 字段 | 说明 |
|------|------|
| timestamp | 事件时间戳 (秒) |
| occupant_id | 人员 ID |
| door_id | 门点 ID |
| event_type | pass/exit/enter |
| floor | 楼层 |

### `floor_plan.json`
楼层平面图配置，包含 floors、doors、exits 三部分。

### `drill_rules.yaml`
疏散规则配置：
- `max_evacuation_time_seconds`: 最大疏散时间
- `max_stay_time_seconds`: 最大滞留时间
- `reverse_threshold_meters`: 反向通行阈值
- `congestion_threshold_people`: 拥堵阈值

## 项目结构

```
evacuation_audit/
├── __init__.py
├── cli.py          # CLI 入口
├── parser.py       # 解析与校验
├── models.py       # 路径/楼层模型
├── rules.py        # 规则引擎
├── exporters.py    # 报告导出
└── data/           # 样本数据
    ├── occupant_roster.csv
    ├── door_events.jsonl
    ├── floor_plan.json
    └── drill_rules.yaml
```
