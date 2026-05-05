# tpsim - 线程池任务调度模拟器

一个用于模拟、分析和优化线程池任务调度过程的 CLI 工具。

## 功能特性

- 🎯 **任务调度模拟**：模拟线程池中的任务入队、执行、完成过程
- 🔄 **工作窃取**：支持工作窃取机制，空闲线程从忙线程窃取任务
- 📊 **队列管理**：本地队列 + 全局队列，支持多种队列策略
- 🛡️ **背压机制**：当系统过载时的多种处理策略（丢弃、阻塞、拒绝）
- 😰 **饥饿检测**：检测长时间未被调度的饥饿任务
- 📈 **吞吐量分析**：分析系统吞吐变化和性能指标
- 📋 **详细统计**：输出时间线、Worker 忙闲统计、丢/堵任务原因
- 💡 **调优建议**：基于模拟结果提供参数调优建议
- 📄 **报告导出**：支持导出 Markdown/JSON 格式的完整报告

## 安装

### 要求

- Python 3.10+

### 安装步骤

```bash
# 克隆或下载项目
cd zy1194

# 以可编辑模式安装
pip install -e .

# 或使用 hatch
hatch shell
```

## 快速开始

### 1. 运行模拟

```bash
# 使用 YAML 配置文件运行模拟
tpsim simulate examples/seed/basic.yaml

# 同时导出报告
tpsim simulate examples/seed/basic.yaml -o report.md

# 导出 JSON 格式
tpsim simulate examples/seed/basic.yaml -o report.json -f json
```

### 2. 详细分析

```bash
# 运行模拟并显示详细分析
tpsim analyze examples/seed/basic.yaml

# 显示 Worker 详情和瓶颈分析
tpsim analyze examples/seed/basic.yaml --show-workers --show-bottlenecks

# 导出完整报告
tpsim analyze examples/seed/basic.yaml -o analysis.md --include-timeline
```

### 3. 导出报告

```bash
# 运行模拟并导出完整报告
tpsim export examples/seed/dependencies.yaml -o report.md

# 包含详细时间线
tpsim export examples/seed/work-stealing.yaml -o report.md --include-timeline

# 导出 JSON 格式
tpsim export examples/seed/basic.json -o report.json -f json
```

## 配置文件说明

### YAML 格式示例

```yaml
# 线程池配置
threadpool:
  worker_count: 4                    # Worker 线程数量
  local_queue_capacity: 10           # 每个 Worker 的本地队列容量
  global_queue_capacity: 100         # 全局队列容量

# 队列策略
queue:
  use_work_stealing: true            # 是否启用工作窃取
  steal_from: random                  # 窃取策略: random, round_robin, most_loaded

# 背压策略
backpressure:
  strategy: block                     # 策略: drop, block, reject
  max_wait_time: 60.0                 # 最大等待时间（超时则丢弃）

# 饥饿检测
starvation:
  threshold: 30.0                     # 饥饿阈值（等待时间超过则视为饥饿）

# 模拟配置
simulation:
  duration: 50.0                      # 模拟时长
  seed: 42                            # 随机种子（用于可复现）

# 任务配置
tasks:
  - id: t-0
    name: task-0
    duration: 2.0                     # 执行耗时
    priority: 0                       # 优先级（越大越高）
    dependencies: []                  # 依赖的任务 ID
  - id: t-1
    name: task-1
    duration: 3.0
    priority: 0
    dependencies: [t-0]               # 依赖 t-0 完成

# 输出配置
output:
  verbose: true
```

### JSON 格式示例

```json
{
  "threadpool": {
    "worker_count": 4,
    "local_queue_capacity": 10,
    "global_queue_capacity": 100
  },
  "queue": {
    "use_work_stealing": true,
    "steal_from": "random"
  },
  "tasks": [
    {
      "id": "t-0",
      "name": "task-0",
      "duration": 2.0,
      "priority": 0,
      "dependencies": []
    }
  ]
}
```

## 配置参数详解

### 线程池配置 (threadpool)

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| worker_count | int | 4 | Worker 线程数量 |
| local_queue_capacity | int | 10 | 每个 Worker 本地队列容量 |
| global_queue_capacity | int | 100 | 全局队列容量 |

### 队列策略 (queue)

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| use_work_stealing | bool | true | 是否启用工作窃取 |
| steal_from | string | random | 窃取目标选择策略 |

**窃取策略：**
- `random`：随机选择有任务的 Worker
- `round_robin`：轮询选择
- `most_loaded`：选择队列最长的 Worker

### 背压策略 (backpressure)

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| strategy | string | drop | 背压处理策略 |
| max_wait_time | float | 60.0 | 最大等待时间 |

**背压策略：**
- `drop`：队列满时直接丢弃新任务
- `block`：任务继续等待（但会有超时）
- `reject`：立即拒绝任务

### 任务配置 (tasks)

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 任务唯一标识 |
| name | string | 任务名称 |
| duration | float | 执行耗时（模拟时间单位） |
| priority | int | 优先级（越大优先级越高） |
| dependencies | list | 依赖的任务 ID 列表 |

## 示例配置

项目包含多个示例配置文件，位于 `examples/` 目录：

### Good Examples (良好配置)

| 文件 | 说明 |
|------|------|
| `examples/seed/basic.yaml` | 基础配置示例，4 个 Worker，合理队列容量 |
| `examples/seed/work-stealing.yaml` | 工作窃取演示，不均匀任务负载 |
| `examples/seed/dependencies.yaml` | 任务依赖演示，数据处理管道场景 |
| `examples/seed/basic.json` | JSON 格式的基础配置 |

### Bad Examples (问题配置)

| 文件 | 说明 |
|------|------|
| `examples/bad/overloaded.yaml` | 过载配置 - 任务过多，队列过小，大量任务被丢弃 |
| `examples/bad/starved.yaml` | 饥饿配置 - 低优先级任务被高优先级任务阻塞 |
| `examples/bad/circular-deps.yaml` | 循环依赖 - 任务形成死锁，永远无法执行 |

## 输出说明

### 控制台输出

运行 `tpsim analyze` 时会显示：

1. **模拟概览面板** - 显示关键指标
2. **Worker 详细统计** - 每个 Worker 的利用率、完成任务数等
3. **瓶颈分析** - 检测系统瓶颈
4. **调优建议** - 基于分析结果的优化建议

### 报告内容

导出的 Markdown/JSON 报告包含：

1. **模拟概览** - 配置摘要和关键指标
2. **Worker 详细统计** - 表格形式展示
3. **队列分析** - 全局队列和本地队列状态
4. **瓶颈分析** - 检测到的问题和建议
5. **调优建议** - 详细的优化建议
6. **事件时间线** - 关键事件的时间顺序（可选）

## 调优建议示例

工具会根据模拟结果自动生成调优建议，例如：

```
🔴 建议 1: Worker 利用率过高，系统可能过载
  - 类别: worker_count
  - 当前值: 2 个 Worker，平均利用率 95.0%
  - 推荐值: 增加 Worker 数量，或检查是否有任务阻塞
  - 预期改进: 提高系统响应能力，减少任务积压

🟡 建议 2: 存在任务丢弃（丢弃率 30.0%）
  - 类别: queue_capacity
  - 当前值: 丢弃 9 个任务，当前背压策略: drop
  - 推荐值: 增加队列容量，或调整背压策略为 'block'
  - 预期改进: 减少任务丢失，提高系统可靠性
```

## 开发

### 运行测试

```bash
# 安装开发依赖
pip install -e ".[dev]"

# 运行所有测试
pytest

# 运行测试并显示覆盖率
pytest --cov=tpsim

# 运行特定测试文件
pytest tests/test_simulator.py
```

### 项目结构

```
zy1194/
├── pyproject.toml          # 项目配置
├── README.md              # 本文档
├── tpsim/                 # 主包
│   ├── __init__.py
│   ├── cli.py            # CLI 入口
│   ├── models.py         # 数据模型
│   ├── simulator.py      # 核心模拟器
│   ├── analyzer.py       # 结果分析器
│   ├── exporter.py       # 报告导出器
│   └── config.py         # 配置解析器
├── examples/              # 示例配置
│   ├── seed/            # 良好配置示例
│   │   ├── basic.yaml
│   │   ├── work-stealing.yaml
│   │   ├── dependencies.yaml
│   │   └── basic.json
│   └── bad/             # 问题配置示例
│       ├── overloaded.yaml
│       ├── starved.yaml
│       └── circular-deps.yaml
└── tests/                # 测试文件
    ├── __init__.py
    ├── test_simulator.py
    ├── test_config.py
    ├── test_analyzer.py
    └── test_exporter.py
```

## 使用场景

### 场景 1：验证线程池配置

在实际部署前，使用模拟器验证不同配置的效果：

```bash
# 测试 4 个 Worker
tpsim analyze examples/seed/basic.yaml --show-workers

# 修改配置为 8 个 Worker，重新测试
# 比较两次结果，选择最优配置
```

### 场景 2：分析任务依赖瓶颈

分析复杂任务依赖链中的瓶颈：

```bash
tpsim analyze examples/seed/dependencies.yaml --show-bottlenecks
```

### 场景 3：测试背压策略

测试不同背压策略在过载时的表现：

```bash
# 测试丢弃策略
tpsim simulate examples/bad/overloaded.yaml -o drop-report.md

# 修改配置为阻塞策略，重新测试
# 比较策略差异
```

### 场景 4：评估工作窃取效果

评估工作窃取对负载均衡的影响：

```bash
# 启用工作窃取
tpsim analyze examples/seed/work-stealing.yaml --show-workers

# 禁用工作窃取（修改配置），重新测试
# 比较 Worker 利用率差异
```

## 命令参考

### tpsim simulate

运行线程池模拟。

```
用法: tpsim simulate [OPTIONS] CONFIG_FILE

参数:
  CONFIG_FILE    配置文件路径 (YAML 或 JSON)

选项:
  -o, --output PATH          输出报告文件路径
  -f, --format [markdown|json]  输出格式 [默认: markdown]
  --include-timeline         包含详细时间线
  -v, --verbose              启用详细输出
  --help                     显示帮助
```

### tpsim analyze

运行模拟并进行详细分析。

```
用法: tpsim analyze [OPTIONS] CONFIG_FILE

参数:
  CONFIG_FILE    配置文件路径 (YAML 或 JSON)

选项:
  -o, --output PATH          输出报告文件路径
  -f, --format [markdown|json]  输出格式 [默认: markdown]
  --include-timeline         包含详细时间线
  --show-workers             显示 Worker 详细统计
  --show-bottlenecks         显示瓶颈分析
  -v, --verbose              启用详细输出
  --help                     显示帮助
```

### tpsim export

运行模拟并导出完整报告。

```
用法: tpsim export [OPTIONS] CONFIG_FILE

参数:
  CONFIG_FILE    配置文件路径 (YAML 或 JSON)

选项:
  -o, --output PATH          输出报告文件路径 [必需]
  -f, --format [markdown|json]  输出格式 [默认: markdown]
  --include-timeline         包含详细时间线
  -v, --verbose              启用详细输出
  --help                     显示帮助
```

## License

MIT License
