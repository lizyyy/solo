# Empty Yard Simulator - 空箱调箱策略模拟工具

港口空箱调运策略模拟工具，支持按时间窗推进库存，生成调箱明细和风险预警，并可对比多种策略。

## 功能特性

- ✅ 多策略支持：就近优先、保留冷柜箱
- ✅ 边界条件处理：跨午夜船期、拖车容量不足、零起始库存
- ✅ 可视化输出：调箱明细 CSV、风险摘要 Markdown
- ✅ 策略对比功能
- ✅ 完整的示例数据和测试

## 安装

```bash
pip install -e .
```

依赖：`pyyaml` (自动安装)

## 快速开始

运行示例（使用 `python -m` 方式）：

```bash
python -m empty_yard_sim.cli sim \
  --inventory examples/inventory.csv \
  --vessels examples/vessels.json \
  --slots examples/truck_slots.csv \
  --strategy-config examples/strategy.yaml \
  --strategy nearest_first \
  --output my_output
```

对比两种策略：

```bash
python -m empty_yard_sim.cli compare \
  --inventory examples/inventory.csv \
  --vessels examples/vessels.json \
  --slots examples/truck_slots.csv \
  --strategy-config examples/strategy.yaml \
  --output compare_result
```

## 输入文件格式

### 1. 堆场箱量 CSV

| 字段 | 说明 |
|------|------|
| yard_id | 堆场唯一ID |
| yard_name | 堆场名称 |
| container_type | 箱型 (如 20GP, 40RF) |
| quantity | 箱量 |
| distance_to_port | 到港口距离 (公里) |

### 2. 船期需求 JSON

```json
[
  {
    "vessel_id": "V001",
    "vessel_name": "船名",
    "eta": "2026-05-03T06:00:00",
    "etd": "2026-05-03T18:00:00",
    "demands": { "20GP": 25 },
    "berth": "A1"
  }
]
```

### 3. 拖车班次 CSV

| 字段 | 说明 |
|------|------|
| slot_id | 班次ID |
| start_time | 开始时间 (ISO格式) |
| end_time | 结束时间 (ISO格式) |
| capacity | 容量 (箱数) |

### 4. 策略配置 YAML

```yaml
port_yard: PORT
reefer_types:
  - 40RF
  - 20RF
```

## 策略说明

### 1. 就近优先 (nearest_first)
优先从距离港口最近的堆场调箱。

### 2. 保留冷柜 (preserve_reefer)
优先使用有冷柜库存的堆场调运普通箱，保留无冷柜堆场的运力。

## 运行测试

```bash
python -m unittest tests/test_engine.py -v
```

## 项目结构

```
.
├── empty_yard_sim/
│   ├── __init__.py
│   ├── models.py        # 数据模型
│   ├── loader.py        # 数据加载
│   ├── engine.py        # 策略引擎
│   ├── output.py        # 结果输出
│   └── cli.py           # 命令行
├── examples/            # 示例数据
├── tests/               # 测试
├── README.md
└── pyproject.toml
```

## License

MIT
