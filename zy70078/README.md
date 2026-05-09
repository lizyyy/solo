# 冷链运输温控风险推演工具

用于物流运营复盘疫苗或生鲜订单在多段运输中的温度是否超限的本地工具。

## 功能特性

- ✅ 导入路线配置 (`route.yaml`) 和传感器数据 (`sensor.csv`)
- ✅ 按站点、车厢、时间段模拟温度漂移、开门升温、补冷恢复
- ✅ 检测传感器缺测情况（包括连续缺测）
- ✅ 自动处理时间戳乱序问题
- ✅ 输出每个订单的风险等级、超限时长、触发原因和建议处置
- ✅ SQLite 保存每次推演记录
- ✅ 支持导出 Markdown 和 CSV 报告
- ✅ 提供完整的 CLI 命令行工具

## 目录结构

```
cold_chain_monitor/
├── cold_chain_monitor/
│   ├── __init__.py
│   ├── models.py              # 数据模型定义
│   ├── data_importer.py       # 数据导入模块
│   ├── simulation_engine.py   # 模拟引擎
│   ├── risk_evaluator.py      # 风险评估模块
│   ├── storage.py             # SQLite 存储模块
│   └── report_generator.py    # 报告生成模块
├── examples/
│   ├── route.yaml             # 示例路线配置
│   ├── sensor.csv             # 示例传感器数据（正常）
│   └── sensor_edge_cases.csv  # 边界情况示例（乱序+缺测）
├── data/                      # SQLite 数据库目录
├── cold_chain_cli.py          # CLI 命令行工具
├── requirements.txt           # 依赖包
└── README.md                  # 本文档
```

## 安装依赖

```bash
pip install -r requirements.txt
```

## 快速开始

### 1. 运行演示数据推演

```bash
# 查看帮助
python cold_chain_cli.py --help

# 使用示例数据运行推演
python cold_chain_cli.py run \
  --route examples/route.yaml \
  --sensor examples/sensor.csv \
  --output ./reports \
  --format both
```

### 2. 运行边界情况测试（时间戳乱序 + 连续缺测）

```bash
python cold_chain_cli.py run \
  --route examples/route.yaml \
  --sensor examples/sensor_edge_cases.csv \
  --output ./reports \
  --format both
```

### 3. 查看历史推演记录

```bash
# 列出最近10条推演记录
python cold_chain_cli.py list

# 列出最近50条
python cold_chain_cli.py list --limit 50
```

### 4. 导出指定推演的报告

```bash
# 导出 Markdown 报告
python cold_chain_cli.py export sim_xxxxxxxx --output ./reports

# 导出 CSV 报告
python cold_chain_cli.py export sim_xxxxxxxx --output ./reports --format csv
```

### 5. 查看订单历史

```bash
python cold_chain_cli.py history VAC-001
```

### 6. 删除推演记录

```bash
python cold_chain_cli.py delete sim_xxxxxxxx
```

## 命令详解

### `run` - 运行推演

**参数说明：**

| 参数 | 必填 | 说明 | 默认值 |
|-----|------|------|-------|
| `--route, -r` | ✅ | 路线配置 YAML 文件路径 | - |
| `--sensor, -s` | ✅ | 传感器数据 CSV 文件路径 | - |
| `--output, -o` | ❌ | 报告输出目录 | 不保存 |
| `--format, -f` | ❌ | 报告格式：markdown/csv/both | both |
| `--db` | ❌ | SQLite 数据库路径 | data/simulations.db |
| `--no-save` | ❌ | 不保存到数据库 | 保存 |
| `--temp-drift` | ❌ | 温度漂移速率 (°C/小时) | 0.1 |
| `--door-open-rate` | ❌ | 开门升温速率 (°C/小时) | 2.0 |
| `--cooling-rate` | ❌ | 补冷速率 (°C/小时) | -1.5 |
| `--max-missing` | ❌ | 最大允许连续缺测时间 (分钟) | 30 |
| `--seed` | ❌ | 随机种子 | 42 |

**示例：**

```bash
# 完整示例
python cold_chain_cli.py run \
  --route examples/route.yaml \
  --sensor examples/sensor.csv \
  --output ./reports \
  --format markdown \
  --temp-drift 0.2 \
  --door-open-rate 3.0 \
  --max-missing 20
```

### `list` - 列出历史记录

**参数说明：**

| 参数 | 必填 | 说明 | 默认值 |
|-----|------|------|-------|
| `--db` | ❌ | SQLite 数据库路径 | data/simulations.db |
| `--limit, -n` | ❌ | 显示最近 N 条记录 | 10 |

### `export` - 导出报告

**参数说明：**

| 参数 | 必填 | 说明 | 默认值 |
|-----|------|------|-------|
| `simulation_id` | ✅ | 推演 ID（位置参数） | - |
| `--db` | ❌ | SQLite 数据库路径 | data/simulations.db |
| `--output, -o` | ❌ | 报告输出目录 | 输出到终端 |
| `--format, -f` | ❌ | 报告格式：markdown/csv | markdown |

### `history` - 查看订单历史

**参数说明：**

| 参数 | 必填 | 说明 | 默认值 |
|-----|------|------|-------|
| `order_id` | ✅ | 订单 ID（位置参数） | - |
| `--db` | ❌ | SQLite 数据库路径 | data/simulations.db |
| `--limit, -n` | ❌ | 显示最近 N 条记录 | 5 |

### `delete` - 删除推演记录

**参数说明：**

| 参数 | 必填 | 说明 | 默认值 |
|-----|------|------|-------|
| `simulation_id` | ✅ | 推演 ID（位置参数） | - |
| `--db` | ❌ | SQLite 数据库路径 | data/simulations.db |

## 数据格式说明

### route.yaml - 路线配置

```yaml
route_id: ROUTE-2024-001          # 路线唯一标识
vehicle_id: TRK-007                # 车辆标识
compartments:                      # 车厢列表
  - A                              # 车厢A（冷冻）
  - B                              # 车厢B（冷藏）

orders:                            # 订单列表
  - order_id: VAC-001              # 订单号
    order_type: 疫苗                # 订单类型
    min_temp: -20.0                # 最低温度要求
    max_temp: -15.0                # 最高温度要求
    route_id: ROUTE-2024-001       # 所属路线

stops:                             # 站点列表
  - stop_id: S1                    # 站点ID
    stop_name: 物流中心             # 站点名称
    arrival_time: "2024-06-15 08:00:00"   # 到达时间
    departure_time: "2024-06-15 08:30:00" # 离开时间
    is_door_open: true             # 是否开门
    door_open_duration_min: 25     # 开门时长（分钟）

segments:                          # 路段列表
  - segment_id: SEG-001            # 路段ID
    from_stop: S1                  # 起始站
    to_stop: S2                    # 到达站
    compartment: A                 # 使用车厢
    start_time: "2024-06-15 08:30:00"   # 开始时间
    end_time: "2024-06-15 09:45:00"     # 结束时间
    orders:                        # 包含的订单
      - VAC-001
      - VAC-002
```

### sensor.csv - 传感器数据

```csv
timestamp,compartment,temperature
2024-06-15 08:00:00,A,-18.5
2024-06-15 08:05:00,A,-18.2
2024-06-15 08:10:00,A,-17.8
```

**注意：**
- 支持多种时间格式：`YYYY-MM-DD HH:MM:SS`、`YYYY-MM-DDTHH:MM:SS`、`YYYY/MM/DD HH:MM:SS` 等
- 时间戳可以乱序，工具会自动排序
- 温度为空或 `null/none/nan/na` 会被识别为缺测

## 风险等级说明

| 等级 | 代码 | 颜色 | 说明 |
|-----|------|-----|------|
| 严重 | CRITICAL | 🔴 | 严重超限或长时间缺测，需要立即处置 |
| 高风险 | HIGH | 🟠 | 较大风险，需要重点关注 |
| 中风险 | MEDIUM | 🟡 | 一般风险，建议检查 |
| 低风险 | LOW | 🔵 | 轻微问题，保持监控 |
| 无风险 | NONE | 🟢 | 正常 |

## 边界情况处理

### 1. 时间戳乱序

工具在导入传感器数据时会自动按时间戳排序，无需手动整理。

### 2. 连续缺测

- 检测空白值、`null`、`none`、`nan`、`na` 等
- 检测时间间隔超过15分钟的时间间隙
- 连续缺测超过 `--max-missing` 参数（默认30分钟）会被标记为高风险因素

## 模拟模型说明

### 温度漂移
- 运输过程中自然的温度波动
- 可通过 `--temp-drift` 参数调整

### 开门升温
- 在站点装卸货时，车门开启导致温度上升
- 可通过 `--door-open-rate` 参数调整升温速率

### 补冷恢复
- 运输途中制冷系统的温度恢复
- 可通过 `--cooling-rate` 参数调整

## 示例数据说明

### 正常数据 (sensor.csv)
- 完整的时间序列
- 包含开门升温场景
- 部分订单存在温度超限

### 边界情况数据 (sensor_edge_cases.csv)
- 时间戳乱序
- 多处缺测数据
- 长时间连续缺测

## 完整演示流程

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 运行第一次推演
python cold_chain_cli.py run \
  --route examples/route.yaml \
  --sensor examples/sensor.csv \
  --output ./reports \
  --format both

# 3. 运行边界情况测试
python cold_chain_cli.py run \
  --route examples/route.yaml \
  --sensor examples/sensor_edge_cases.csv \
  --output ./reports \
  --format both

# 4. 查看历史记录
python cold_chain_cli.py list

# 5. 查看某个订单的历史
python cold_chain_cli.py history VAC-001

# 6. 导出某次推演的报告
python cold_chain_cli.py export sim_xxxxxxxx --output ./reports
```

## 数据库结构

### simulations 表
| 字段 | 类型 | 说明 |
|-----|------|------|
| id | INTEGER | 主键 |
| simulation_id | TEXT | 推演唯一标识 |
| route_id | TEXT | 路线ID |
| simulation_timestamp | TEXT | 推演时间 |
| created_at | TEXT | 记录创建时间 |

### risk_results 表
| 字段 | 类型 | 说明 |
|-----|------|------|
| id | INTEGER | 主键 |
| simulation_id | TEXT | 关联推演ID |
| order_id | TEXT | 订单ID |
| route_id | TEXT | 路线ID |
| risk_level | TEXT | 风险等级 |
| total_overtime_min | INTEGER | 总超限时长(分钟) |
| max_temp_violation | REAL | 最高温超限值(°C) |
| min_temp_violation | REAL | 最低温超限值(°C) |
| triggers | TEXT | 触发原因(JSON) |
| missing_data_count | INTEGER | 缺测次数 |
| missing_data_duration_min | REAL | 缺测时长(分钟) |
| recommendations | TEXT | 建议处置(JSON) |
| simulation_timestamp | TEXT | 推演时间 |
| segment_details | TEXT | 路段详情(JSON) |

## 许可证

MIT License
