# AMHS 堵塞复盘分析工具

半导体厂 AMHS（自动物料搬运系统）天车/FOUP 搬运日志堵塞复盘分析工具。

## 功能特性

- 重建每个 FOUP 的搬运状态机
- 计算节点排队等待时间
- 检测绕行失败事件
- 统计设备占用超时情况
- 处理**乱序事件**边界情况
- 处理**缺少到达事件**边界情况
- 导出三种分析报告格式

## 快速开始

### 一条命令运行完整演示

```bash
python main.py demo
```

这将使用 `samples/` 目录下的示例数据运行完整分析，并将结果输出到 `output/` 目录。

## 安装要求

Python 3.7+，依赖包：
- pyyaml

安装依赖：
```bash
pip install pyyaml
```

## 使用方法

### 命令行参数

```bash
python main.py analyze \
    --topology <topology.yaml> \
    --events <events.jsonl> \
    --downtime <downtime.csv> \
    --output <output_directory>
```

### 参数说明

| 参数 | 简写 | 必填 | 说明 |
|------|------|------|------|
| `--topology` | `-t` | 是 | 轨道拓扑 YAML 文件路径 |
| `--events` | `-e` | 是 | 搬运事件 JSONL 文件路径 |
| `--downtime` | `-d` | 是 | 设备停机窗口 CSV 文件路径 |
| `--output` | `-o` | 否 | 输出目录（默认：`output/`） |
| `--verbose` | `-v` | 否 | 详细输出模式 |

### 示例

```bash
python main.py analyze \
    --topology samples/topology.yaml \
    --events samples/events.jsonl \
    --downtime samples/downtime.csv \
    --output my_analysis
```

## 输入文件格式

### 1. 轨道拓扑 (topology.yaml)

描述 AMHS 系统的轨道网络结构：

```yaml
nodes:
  - id: N001
    name: Stocker_A_Entry
    type: regular
    x: 0.0
    y: 0.0
  - id: N005
    name: Etcher_1_Port1
    type: equipment_port
    x: 300.0
    y: 0.0
    is_equipment: true
    equipment_id: ETCHER_001

edges:
  - id: E001
    from: N001
    to: N002
    bidirectional: true
    distance: 100.0

equipments:
  - id: ETCHER_001
    name: Etcher_Chamber_1
    port_nodes:
      - N005
      - N006
```

**节点字段说明：**
- `id`: 节点唯一标识
- `name`: 节点可读名称
- `type`: 节点类型（regular/equipment_port）
- `is_equipment`: 是否为设备端口节点
- `equipment_id`: 关联的设备 ID

**边字段说明：**
- `from/to`: 连接的两个节点
- `bidirectional`: 是否双向通行
- `distance`: 距离（用于估算旅行时间）

### 2. 搬运事件 (events.jsonl)

每行一个 JSON 对象，记录搬运过程中的事件：

```json
{"foup_id": "FOUP-001", "event_type": "task_created", "timestamp": "2026-05-03T08:00:00.000000", "node_id": "N001", "target_node": "N005"}
{"foup_id": "FOUP-001", "event_type": "assigned", "timestamp": "2026-05-03T08:00:05.000000", "vehicle_id": "V001"}
{"foup_id": "FOUP-001", "event_type": "departed", "timestamp": "2026-05-03T08:00:10.000000", "node_id": "N001", "target_node": "N005"}
{"foup_id": "FOUP-001", "event_type": "arrived", "timestamp": "2026-05-03T08:00:25.000000", "node_id": "N002"}
```

**事件类型：**

| 事件类型 | 说明 |
|----------|------|
| `task_created` | 搬运任务创建 |
| `assigned` | 分配给天车 |
| `departed` | 从节点出发 |
| `arrived` | 到达节点 |
| `queue_start` | 开始排队 |
| `queue_end` | 排队结束 |
| `reroute` | 路径重规划 |
| `reroute_failed` | 绕行失败 |
| `load_start` | 开始上料 |
| `load_end` | 上料结束 |
| `unload_start` | 开始下料 |
| `unload_end` | 下料结束 |
| `completed` | 任务完成 |
| `failed` | 任务失败 |

**字段别名支持：**
- `event_type` 或 `type`
- `timestamp` 或 `ts`
- `node_id` 或 `node`
- `target_node` 或 `destination`
- `foup_id` 或 `id`

### 3. 设备停机窗口 (downtime.csv)

记录设备计划内/外停机时间：

```csv
equipment_id,start_time,end_time,reason
ETCHER_001,2026-05-03T08:30:00.000000,2026-05-03T09:00:00.000000,preventive_maintenance
CVD_001,2026-05-03T08:00:00.000000,2026-05-03T08:45:00.000000,process_issue
```

## 输出文件

分析完成后生成三个文件：

### 1. issues.csv

所有检测到的问题详细列表，可直接用 Excel 打开分析：

| 列名 | 说明 |
|------|------|
| `foup_id` | FOUP 标识 |
| `issue_type` | 问题类型 |
| `description` | 问题描述 |
| `timestamp` | 发生时间 |
| `node_id` | 相关节点 |
| `equipment_id` | 相关设备 |
| `reason` | 原因 |
| `duration_seconds` | 持续时间（秒） |
| `source_node` | 起点 |
| `target_node` | 终点 |
| `final_status` | 最终状态 |

### 2. amhs_report.md

Markdown 格式的分析报告，包含：

- 概览统计（总任务数、完成/失败数、排队时间等）
- 问题分类统计
- 热点节点 Top 10（排队最频繁的节点）
- 热点设备 Top 10（占用超时最频繁的设备）
- 有问题的搬运详细列表
- 正常完成的搬运列表
- 数据说明

### 3. timeline.html

交互式时间线可视化，支持：

- **时间轴视图**：所有 FOUP 的事件在时间轴上的分布
- **事件颜色编码**：不同类型事件用不同颜色标识
- **筛选功能**：
  - 只显示有问题的 FOUP
  - 高亮问题事件
  - 按 FOUP ID 搜索
- **悬停详情**：鼠标悬停查看事件详细信息

在浏览器中打开查看：
```bash
open output/timeline.html
```

## 边界情况处理

### 1. 乱序事件 (Out-of-order Events)

**问题描述：**
由于网络延迟或日志收集系统的问题，事件可能按非时间顺序到达。例如：
- 先记录 `arrived` 事件，后记录 `departed` 事件

**处理策略：**
- 状态机检测到时间戳回退时，将事件标记为乱序
- 记录异常到 `anomalies` 列表
- 事件仍然会被加入事件列表用于时间线重建
- 状态转换逻辑保持稳健，不会因为乱序事件而崩溃

**检测方式：**
```python
if event.timestamp < self.state.last_updated_at:
    # 乱序事件处理
    self.state.anomalies.append(f"Out-of-order event: {event.event_type}")
```

### 2. 缺少到达事件 (Missing Arrival Events)

**问题描述：**
在某些情况下，FOUP 从节点出发后，到达事件可能丢失：
- 日志记录失败
- 天车通信中断
- 系统重启期间的事件丢失

**处理策略：**
- 检测 `departed` 事件后，在 `completed` 事件时检查是否有对应 `arrived`
- 如果检测到缺少到达事件：
  - 记录 `missing_arrival` 问题
  - 推断等待时间 = 完成时间 - 最后出发时间
  - 记录 `node_queue` 问题（标记 `is_inferred=True`）

**推断逻辑：**
```python
if self.state.last_departure_time and not self.state.current_node:
    # 缺少到达事件
    travel_duration = (event.timestamp - self.state.last_departure_time).total_seconds()
    self.state.record_issue('missing_arrival', ...)
    self.state.record_issue('node_queue', ..., is_inferred=True)
```

## 问题类型说明

| 问题类型 | 触发条件 | 说明 |
|----------|----------|------|
| `node_queue` | 排队 > 10 秒 | 在轨道节点等待时间过长 |
| `reroute_failed` | 绕行失败事件 | 动态路径规划失败 |
| `equipment_occupation` | 装卸 > 120 秒 | 在设备端口占用时间过长 |
| `missing_arrival` | 有出发无到达 | 检测到缺少到达事件 |

## 运行测试

### 运行单元测试

```bash
python -m pytest tests/ -v
```

或使用 unittest：

```bash
python -m unittest discover -s tests -v
```

### 测试覆盖范围

- **Topology 测试**：YAML 解析、节点邻居查询
- **StateMachine 测试**：
  - 正常搬运流程
  - 排队时间计算
  - **乱序事件处理**（边界情况 1）
  - **缺少到达事件处理**（边界情况 2）
  - 绕行失败检测
  - 设备占用超时检测
- **Analysis 测试**：停机窗口时间计算、汇总统计
- **EventParsing 测试**：多格式字段解析

## 项目结构

```
zy8165/
├── amhs_analyzer/          # 核心模块
│   ├── __init__.py
│   ├── topology.py        # 轨道拓扑解析
│   ├── state_machine.py   # 状态机与事件处理
│   ├── analysis.py        # 堵塞分析与统计
│   └── exporters.py       # 报告导出器
├── samples/               # 示例数据
│   ├── topology.yaml
│   ├── events.jsonl
│   └── downtime.csv
├── tests/                 # 单元测试
│   ├── __init__.py
│   └── test_amhs_analyzer.py
├── main.py                # CLI 入口
└── README.md
```

## 示例数据解读

示例数据 `samples/events.jsonl` 包含 6 个 FOUP 的搬运记录，覆盖各种场景：

| FOUP ID | 包含的场景 |
|---------|-----------|
| FOUP-001 | 正常流程 + 节点排队（25秒） |
| FOUP-002 | 绕行失败 + 设备占用超时（194秒） |
| FOUP-003 | **缺少到达事件**（边界情况 2） |
| FOUP-004 | **乱序事件**（到达早于出发，边界情况 1） |
| FOUP-005 | 长时间排队（110秒）+ 受设备停机影响 |
| FOUP-006 | 多次排队 + 两次绕行（一次失败）+ 设备端口排队 |

运行 demo 后观察输出，可以看到这些场景如何被检测和报告。

## 许可证

仅供内部使用。
