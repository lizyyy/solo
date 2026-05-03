# WaterLeak - 供水管网漏损夜间复盘分析工具

供调度员夜间复盘小区管网漏损使用的Python CLI工具。

## 功能特性

- **数据验证**: 验证管道拓扑、水表读数、压力数据、维修工单的完整性和一致性
- **水量平衡分析**: 计算分区入流/用户表差值，识别可疑漏损
- **压力突降传播分析**: 检测压力传感器数据中的突降事件，分析传播路径
- **漏点定位**: 综合水量平衡和压力数据，定位可疑漏点位置
- **智能排除误判**: 处理跨午夜读数、传感器断采、阀门关闭导致的误判

## 项目结构

```
waterleak/
├── __init__.py          # 包初始化
├── __main__.py          # 模块入口
├── cli.py               # CLI主程序
├── parsers/             # 数据解析模块
│   ├── __init__.py
│   ├── pipes_parser.py      # 管道拓扑解析
│   ├── meters_parser.py     # 水表数据解析
│   ├── pressure_parser.py   # 压力数据解析
│   └── repair_orders_parser.py  # 维修工单解析
├── topology/            # 拓扑图模块
│   ├── __init__.py
│   └── graph.py             # 管网拓扑图和验证
├── analysis/            # 计算规则模块
│   ├── __init__.py
│   ├── water_balance.py     # 分区水量平衡计算
│   ├── pressure_propagation.py  # 压力突降传播分析
│   └── leak_detection.py    # 漏点定位
├── output/              # 输出模块
│   ├── __init__.py
│   ├── report_generator.py  # 复盘报告生成
│   └── plan_generator.py    # 隔离计划生成
└── sample_data/         # 样例数据模块
    ├── __init__.py
    └── generator.py         # 样例数据生成器
```

## 安装

```bash
pip install -r requirements.txt
```

## 输入数据格式

### 1. pipes.yaml - 管道拓扑

```yaml
zones:
  - id: Z1
    name: 东区
    meter_ids: [M1, M2, M3]
    pipe_ids: [P1, P2, P3]
    valve_ids: [V1, V2]

pipes:
  - id: P1
    start_node: N1
    end_node: N2
    length: 150
    diameter: 200
    material: PE
    zone_id: Z1

valves:
  - id: V1
    name: 东区入口阀门
    pipe_id: P1
```

### 2. meters.csv - 水表数据

```csv
meter_id,meter_name,meter_type,zone_id,is_inflow,timestamp,reading,cumulative
M1,东区总表,zone,Z1,true,2024-05-15 22:00:00,30.00,50030.00
M2,用户表-1号楼,user,Z1,false,2024-05-15 22:00:00,2.00,12002.00
```

### 3. pressure.jsonl - 压力数据 (JSON Lines)

```json
{"sensor_id": "PS1", "node_id": "N1", "timestamp": "2024-05-15 22:00:00", "pressure": 0.452}
{"sensor_id": "PS2", "node_id": "N2", "timestamp": "2024-05-15 22:00:00", "pressure": 0.421}
```

### 4. repair_orders.csv - 维修工单

```csv
order_id,order_type,status,target_id,target_type,created_at,scheduled_start,scheduled_end,actual_start,actual_end,description
RO001,valve_close,in_progress,V2,valve,2024-05-15 20:00:00,2024-05-16 02:00:00,2024-05-16 04:00:00,2024-05-16 02:05:00,,夜间阀门关闭检修
```

## 使用方法

### 完整Demo

```bash
# 使用样例数据运行完整分析流程
python -m waterleak run \
    --pipes pipes.yaml \
    --meters meters.csv \
    --pressure pressure.jsonl \
    --repairs repair_orders.csv \
    --start-time "2024-05-15 22:00:00" \
    --end-time "2024-05-16 06:00:00" \
    --report leak_review.md \
    --plan isolation_plan.csv
```

### 分步命令

```bash
# 1. 仅验证数据
python -m waterleak validate

# 2. 仅执行分析（不输出文件）
python -m waterleak analyze -s "2024-05-15 22:00:00" -e "2024-05-16 06:00:00"

# 3. 分析并导出结果
python -m waterleak export -s "2024-05-15 22:00:00" -e "2024-05-16 06:00:00"

# 4. 使用自定义文件路径
python -m waterleak run \
    -p /data/pipes.yaml \
    -m /data/meters.csv \
    -pr /data/pressure.jsonl \
    -r /data/repair_orders.csv
```

### 命令行参数

| 参数 | 简写 | 默认值 | 说明 |
|------|------|--------|------|
| `--pipes` | `-p` | `pipes.yaml` | 管道拓扑YAML文件 |
| `--meters` | `-m` | `meters.csv` | 水表数据CSV文件 |
| `--pressure` | `-pr` | `pressure.jsonl` | 压力数据JSONL文件 |
| `--repairs` | `-r` | `repair_orders.csv` | 维修工单CSV文件 |
| `--start-time` | `-s` | 自动推断 | 分析开始时间 (YYYY-MM-DD HH:MM:SS) |
| `--end-time` | `-e` | 自动推断 | 分析结束时间 (YYYY-MM-DD HH:MM:SS) |
| `--report` | `-rep` | `leak_review.md` | 复盘报告输出路径 |
| `--plan` | `-pl` | `isolation_plan.csv` | 隔离计划输出路径 |
| `--verbose` | `-v` | - | 显示详细输出 |

## 输出文件

### leak_review.md - 漏损复盘报告

包含以下内容：
1. 数据验证结果
2. 分区水量平衡分析（入流/用户表差）
3. 压力突降事件分析
4. 可疑漏点定位结果
5. 处理建议

### isolation_plan.csv - 隔离计划

包含以下字段：
- `step_number`: 步骤编号
- `action`: 操作类型（关闭阀门/检查管道等）
- `target_id`: 目标设备ID
- `target_type`: 目标类型
- `description`: 操作描述
- `expected_outcome`: 预期结果
- `safety_notes`: 安全提示

## 处理特殊情况

### 1. 跨午夜读数

当水表读数跨越午夜时（如23:00到次日02:00），系统会：
- 检测时间跨度
- 自动处理累计值重置
- 正确计算夜间用水量

### 2. 传感器断采

当压力传感器数据存在间隔时，系统会：
- 检测数据断采（超过设定阈值）
- 在报告中标注异常
- 分析时跳过断采时段

### 3. 阀门关闭误判

当存在阀门关闭工单时，系统会：
- 检查工单时间与分析时段的重叠
- 排除阀门关闭导致的压力变化
- 在报告中说明排除原因

## 样例数据

项目包含样例数据生成器，可生成测试数据：

```python
from waterleak.sample_data import SampleDataGenerator

gen = SampleDataGenerator()
gen.write_all_files(output_dir="./test_data")
```

样例数据模拟以下场景：
- 东区(Z1)和西区(Z2)两个主要分区
- 南区(Z3)为东区的子分区
- 夜间02:10左右南区发生漏损
- 压力传感器PS3(节点N3)检测到明显压降
- 水表数据显示南区入流与用户表存在明显差值

## 阈值配置

可通过修改代码中的阈值参数调整灵敏度：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| 漏损率阈值 | 30% | 超过此值标记为可疑 |
| 不明水量阈值 | 10 m³ | 超过此值标记为可疑 |
| 压力突降阈值 | 0.05 MPa | 最小可检测压降 |
| 数据断采阈值 | 120秒 | 超过此间隔标记为断采 |

## 许可证

MIT License
