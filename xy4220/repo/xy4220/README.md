# 总线回放诊断台

一个本地命令行工具，用于无人车CAN总线日志分析。支持导入多段日志、校验帧顺序、时间漂移、丢帧、传感器与控制指令延迟，按节点还原状态机，支持指定时间窗口回放，并导出Markdown故障报告、CSV异常片段和JSON审计包。

## 功能特性

- **多格式日志导入**：支持CAN帧CSV、传感器时间戳JSON、控制指令YAML
- **数据校验**：帧顺序检查、时间漂移检测、丢帧分析、延迟分析
- **状态机还原**：按节点还原动力系统、转向系统、感知系统、导航系统的状态转换
- **交互式回放**：支持指定时间窗口回放，交互式步进控制
- **多格式导出**：Markdown故障报告、CSV异常片段、JSON审计包

## 安装

### 环境要求

- Python 3.8+
- pip

### 安装步骤

1. 克隆或下载项目到本地
2. 在项目根目录执行：

```bash
pip install -e .
```

或使用：

```bash
python setup.py install
```

## 快速开始

### 一键分析（推荐）

使用 `analyze` 命令执行完整的分析流程：

```bash
bus-diagnostic analyze \
  --can examples/can_log.csv \
  --sensor examples/sensor_timestamps.json \
  --control examples/control_commands.yaml \
  --output ./my_diagnostic_output \
  --project "我的无人车测试"
```

### 分步操作

也可以分步骤执行各个分析阶段：

#### 1. 导入日志

```bash
bus-diagnostic import-logs \
  --can examples/can_log.csv \
  --sensor examples/sensor_timestamps.json \
  --control examples/control_commands.yaml
```

#### 2. 数据校验

```bash
bus-diagnostic validate
```

#### 3. 状态机还原

```bash
bus-diagnostic state-machine
```

#### 4. 数据回放

```bash
# 简单回放
bus-diagnostic replay

# 指定时间窗口回放
bus-diagnostic replay --start 100.0 --end 100.3

# 交互式回放
bus-diagnostic replay --interactive
```

#### 5. 导出结果

```bash
# 导出所有格式
bus-diagnostic export --output ./output --project "测试项目"

# 仅导出Markdown
bus-diagnostic export --output ./output --format markdown

# 仅导出CSV
bus-diagnostic export --output ./output --format csv

# 仅导出JSON
bus-diagnostic export --output ./output --format json
```

## 主流程说明

```
┌─────────────────────────────────────────────────────────────────┐
│                        总线回放诊断台主流程                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    │
│  │  1. 导入日志  │───▶│  2. 数据校验  │───▶│  3. 状态还原  │    │
│  │              │    │              │    │              │    │
│  │ • CAN帧CSV   │    │ • 帧顺序检查  │    │ • 动力系统   │    │
│  │ • 传感器JSON │    │ • 时间漂移    │    │ • 转向系统   │    │
│  │ • 控制指令YAML│    │ • 丢帧检测    │    │ • 感知系统   │    │
│  │              │    │ • 延迟分析    │    │ • 导航系统   │    │
│  └──────────────┘    └──────────────┘    └──────────────┘    │
│                                                │                │
│                                                ▼                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    │
│  │  6. 导出结果  │◀───│  5. 数据回放  │◀───│  4. 规则引擎  │    │
│  │              │    │              │    │              │    │
│  │ • Markdown   │    │ • 时间窗口   │    │ • 异常检测   │    │
│  │   报告       │    │ • 步进播放   │    │ • 延迟分析   │    │
│  │ • CSV异常    │    │ • 交互式模式 │    │ • 状态监控   │    │
│  │ • JSON审计   │    │              │    │              │    │
│  └──────────────┘    └──────────────┘    └──────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 模块架构

### 1. CLI 模块 (`bus_replay_diagnostic/cli/`)

命令行接口，提供用户交互入口。

**主要命令**：
- `import-logs`：导入多段日志文件
- `validate`：数据校验
- `state-machine`：状态机还原
- `replay`：数据回放
- `export`：导出结果
- `analyze`：一键分析（执行完整流程）

### 2. 解析器模块 (`bus_replay_diagnostic/parsers/`)

负责解析不同格式的日志文件。

**子模块**：
- `csv_parser.py`：解析CAN帧CSV文件
- `json_parser.py`：解析传感器时间戳JSON文件
- `yaml_parser.py`：解析控制指令YAML文件

**数据结构**：
- `CANFrame`：CAN帧数据结构
- `SensorTimestamp`：传感器时间戳数据结构
- `ControlCommand`：控制指令数据结构

### 3. 时钟同步模块 (`bus_replay_diagnostic/clock_sync/`)

负责时间校准和时间漂移检测。

**核心功能**：
- 自动检测参考时钟源
- 分析各数据源的时间漂移
- 同步时间戳
- 检测帧顺序异常

**数据结构**：
- `TimeDriftInfo`：时间漂移信息
- `SynchronizationResult`：同步结果

### 4. 状态机模块 (`bus_replay_diagnostic/state_machine/`)

负责按节点还原状态机。

**预定义状态机**：
- **动力系统 (powertrain)**：idle → forward/reverse → braking → idle
- **转向系统 (steering)**：straight → turning_left/turning_right → straight
- **感知系统 (perception)**：inactive → active → degraded → error
- **导航系统 (navigation)**：idle → planning → navigating → paused → completed

**核心类**：
- `StateMachineDefinition`：状态机定义
- `NodeStateMachine`：节点状态机实例
- `StateMachineManager`：状态机管理器

### 5. 规则引擎模块 (`bus_replay_diagnostic/rules/`)

负责丢帧检测、延迟分析和异常检测。

**预定义规则**：
- `FrameLossRule`：丢帧检测规则
- `TimeDriftRule`：时间漂移检测规则
- `OutOfOrderRule`：帧顺序检测规则
- `LatencyAnalysisRule`：延迟分析规则

**异常类型**：
- `FRAME_LOSS`：丢帧
- `TIME_DRIFT`：时间漂移
- `OUT_OF_ORDER`：帧顺序异常
- `LATENCY_ABNORMAL`：延迟异常
- `INVALID_DATA`：无效数据
- `STATE_ABNORMAL`：状态异常
- `COMMAND_TIMEOUT`：命令超时

**异常严重程度**：
- `CRITICAL`：严重
- `HIGH`：高
- `MEDIUM`：中
- `LOW`：低

### 6. 回放器模块 (`bus_replay_diagnostic/player/`)

负责数据回放控制。

**核心功能**：
- 时间窗口设置
- 播放/暂停/停止控制
- 步进播放（向前/向后）
- 时间跳转
- 交互式回放模式

**播放状态**：
- `STOPPED`：已停止
- `PLAYING`：播放中
- `PAUSED`：已暂停
- `FAST_FORWARD`：快进
- `FAST_REWIND`：快退

### 7. 导出模块 (`bus_replay_diagnostic/exporters/`)

负责导出分析结果。

**导出格式**：

1. **Markdown故障报告** (`diagnostic_report.md`)
   - 数据概览
   - 时钟同步分析
   - 异常分析（按类型和严重程度）
   - 状态机分析
   - 附加信息

2. **CSV异常片段** (`anomalies.csv`)
   - 异常ID
   - 异常类型
   - 严重程度
   - 时间戳
   - 来源
   - 描述
   - 详细数据
   - 相关帧

3. **JSON审计包** (`audit_package.json`)
   - 版本信息
   - 生成时间
   - 项目信息
   - 数据摘要
   - 同步信息
   - 异常列表
   - 状态转换

## 示例数据

项目提供了示例数据文件，位于 `examples/` 目录：

- `can_log.csv`：CAN帧日志示例
- `sensor_timestamps.json`：传感器时间戳示例
- `control_commands.yaml`：控制指令示例

### 示例数据说明

**CAN帧日志 (can_log.csv)**：
- 包含52条CAN帧记录
- 时间范围：100.000000 - 100.500000 秒
- 涉及CAN ID：0x100, 0x101, 0x102, 0x200 (256, 257, 258, 512)

**传感器时间戳 (sensor_timestamps.json)**：
- 包含20条传感器数据
- 涉及传感器：lidar_01, camera_01, imu_01, gps_01
- 时间范围：100.005000 - 100.435000 秒

**控制指令 (control_commands.yaml)**：
- 包含18条控制指令
- 涉及系统：navigation, powertrain, steering, perception, safety, system
- 时间范围：100.010000 - 100.500000 秒

## 交互式回放模式

使用 `--interactive` 选项启动交互式回放模式：

```bash
bus-diagnostic replay --interactive
```

**可用命令**：

| 命令 | 缩写 | 说明 |
|------|------|------|
| `play` | `p` | 开始/继续播放 |
| `pause` | - | 暂停播放 |
| `stop` | `s` | 停止播放 |
| `step` | `n` | 步进播放（向前），可指定步数 |
| `back` | `b` | 步进播放（向后），可指定步数 |
| `seek <t>` | - | 跳转到指定时间（秒） |
| `speed <x>` | - | 设置播放速度（1.0为正常） |
| `window <s> <e>` | - | 设置回放窗口 |
| `status` | `st` | 显示当前状态 |
| `events` | `e` | 显示剩余事件数量 |
| `help` | `h` | 显示帮助信息 |
| `quit` | `q` | 退出交互式模式 |

## 输出文件说明

### Markdown故障报告 (`diagnostic_report.md`)

报告结构：

1. **数据概览**
   - 数据统计（CAN帧、传感器数据、控制指令数量）
   - 时间范围（开始时间、结束时间、持续时间）

2. **时钟同步分析**
   - 同步质量
   - 各数据源漂移情况（平均漂移、最大漂移、同步状态）

3. **异常分析**
   - 异常统计（总数、按严重程度、按类型）
   - 异常详情（按严重程度排序）

4. **状态机分析**
   - 各节点状态转换历史

5. **附加信息**

### CSV异常片段 (`anomalies.csv`)

包含以下字段：
- `anomaly_id`：异常唯一标识
- `anomaly_type`：异常类型
- `severity`：严重程度
- `timestamp`：异常发生时间戳
- `source`：异常来源
- `description`：异常描述
- `data_json`：详细数据（JSON格式）
- `related_frames_json`：相关帧数据（JSON格式）

### JSON审计包 (`audit_package.json`)

完整的审计数据，可用于后续分析或存档。

主要字段：
- `version`：版本号
- `generated_at`：生成时间
- `project_info`：项目信息
- `data_summary`：数据摘要
- `synchronization`：同步信息
- `anomalies`：异常列表
- `state_transitions`：状态转换列表

## 高级用法

### 导入多段同类型日志

```bash
bus-diagnostic import-logs \
  --can log1.csv \
  --can log2.csv \
  --can log3.csv \
  --sensor sensor1.json \
  --sensor sensor2.json
```

### 自定义导出文件名

```bash
bus-diagnostic export \
  --output ./output \
  --format all \
  --project "自定义项目名"
```

### 仅分析特定时间范围

```bash
# 先导入数据
bus-diagnostic import-logs --can can_log.csv

# 然后使用回放器分析特定时间段
bus-diagnostic replay --start 100.1 --end 100.3
```

## 故障排查

### 常见问题

**Q: 导入CSV文件失败**
- 检查CSV文件是否包含必要的列：`timestamp`, `can_id`, `dlc`, `data`
- 检查时间戳格式是否正确（支持浮点数、ISO格式等）

**Q: 状态机没有检测到任何转换**
- 检查CAN ID是否与预定义的状态机匹配
- 可以根据实际硬件协议修改 `state_machine/node_state.py` 中的 CAN ID 映射

**Q: 没有检测到异常**
- 示例数据是正常的测试数据，可能不包含异常
- 可以调整规则参数来检测更细微的异常

## 扩展开发

### 添加自定义状态机

```python
from bus_replay_diagnostic.state_machine.node_state import StateMachineDefinition, StateMachineManager

# 创建自定义状态机定义
my_machine_def = StateMachineDefinition("my_custom_node")
my_machine_def.add_state("state_a", is_initial=True)
my_machine_def.add_state("state_b")
my_machine_def.add_state("state_c")

# 添加转换规则
my_machine_def.add_transition("state_a", "state_b", "event_1")
my_machine_def.add_transition("state_b", "state_c", "event_2")
my_machine_def.add_transition("*", "state_a", "reset")

# 注册到管理器
manager = StateMachineManager()
manager.add_definition(my_machine_def)
```

### 添加自定义规则

```python
from bus_replay_diagnostic.rules.rule_engine import Rule, Anomaly, AnomalyType, AnomalySeverity

class MyCustomRule(Rule):
    def __init__(self):
        super().__init__(
            name="my_custom_rule",
            description="我的自定义检测规则",
            severity=AnomalySeverity.MEDIUM
        )
    
    def check(self, data):
        anomalies = []
        # 实现自定义检测逻辑
        # ...
        return anomalies

# 注册到规则引擎
from bus_replay_diagnostic.rules.rule_engine import RuleEngine
engine = RuleEngine()
engine.register_rule(MyCustomRule())
```

## 许可证

本项目仅供学习和研究使用。

## 贡献

欢迎提交Issue和Pull Request来改进这个工具。
