# Lock Analyzer - 单文件数据库读写锁冲突复盘工具

一个本地命令行工具，专门用于复盘单文件数据库（如 SQLite）中的读写锁冲突。通过模拟多个连接的并发读写操作，分析锁状态流转、阻塞原因、死锁风险等问题。

## 功能特性

- 📊 **锁模型模拟**：支持共享锁 (S)、保留锁 (R)、排他锁 (X) 三态锁
- 🔄 **锁升级路径**：S → R → P → X 的完整锁升级流程
- 🔍 **死锁检测**：基于等待图的循环检测
- ⚠️ **饿死风险评估**：检测长时间等待的连接
- 📈 **时间线追踪**：可视化并发操作的时间线
- 📋 **多格式报告**：支持 Markdown 和 JSON 格式输出

## 锁模型说明

参考 SQLite 的锁机制，实现了四级锁状态：

| 锁类型 | 缩写 | 说明 |
|--------|------|------|
| **共享锁** | S | 多个读事务可同时持有，不阻塞其他读 |
| **保留锁** | R | 写事务先获取，表示想写但不阻塞读 |
| **等待锁** | P | 等待升级为排他锁，阻止新的共享锁 |
| **排他锁** | X | 写事务最终持有，阻塞所有其他操作 |

### 兼容性矩阵

| 请求锁 \ 持有锁 | 无锁 | 共享锁(S) | 保留锁(R) | 等待锁(P) | 排他锁(X) |
|----------------|------|-----------|-----------|-----------|-----------|
| **共享锁(S)**  | ✅   | ✅        | ✅        | ❌        | ❌        |
| **保留锁(R)**  | ✅   | ✅        | ❌        | ❌        | ❌        |
| **排他锁(X)**  | ✅   | ❌        | ❌        | ❌        | ❌        |

## 安装

```bash
# 克隆仓库后安装依赖
pip install -e .
```

或使用 pip 安装开发依赖：

```bash
pip install -e ".[dev]"
```

## 快速开始

### 1. 初始化示例项目

```bash
lock-analyzer init --output ./my-project --seed 42 --connections 3 --events 20
```

这会在 `./my-project` 目录下生成：
- `workload.jsonl` - 随机生成的工作负载
- `lock-config.yaml` - 锁配置文件

### 2. 运行模拟

```bash
lock-analyzer simulate \
    --workload ./my-project/workload.jsonl \
    --config ./my-project/lock-config.yaml \
    --show-timeline
```

### 3. 导出报告

```bash
lock-analyzer export \
    --workload ./my-project/workload.jsonl \
    --config ./my-project/lock-config.yaml \
    --output ./my-project/report \
    --format both
```

这会生成 `report.json` 和 `report.md` 两个报告文件。

### 4. 解释阻塞原因

```bash
lock-analyzer explain \
    --workload ./my-project/workload.jsonl \
    --config ./my-project/lock-config.yaml \
    --connection "conn-001"
```

## CLI 命令参考

### init - 初始化示例项目

```bash
lock-analyzer init [OPTIONS]

Options:
  -o, --output PATH       输出目录 (默认: 当前目录)
  -s, --seed INTEGER      随机种子 (默认: 42)
  -c, --connections INTEGER  连接数 (默认: 3)
  -e, --events INTEGER    事件数 (默认: 20)
  -f, --force              覆盖已存在的文件
  --help                   显示帮助
```

### simulate - 运行模拟

```bash
lock-analyzer simulate [OPTIONS]

Options:
  -w, --workload PATH     Workload JSONL 文件路径 [必需]
  -c, --config PATH       Lock config YAML 文件路径
  -o, --output PATH       输出报告文件路径 (不含扩展名)
  -f, --format [json|markdown|both|none]
                          输出格式 (默认: none)
  --show-timeline / --hide-timeline
                          是否显示时间线 (默认: 显示)
  -v, --verbose           详细输出
  --help                  显示帮助
```

### explain - 解释阻塞原因

```bash
lock-analyzer explain [OPTIONS]

Options:
  -w, --workload PATH    Workload JSONL 文件路径 [必需]
  -c, --config PATH    Lock config YAML 文件路径
  -C, --connection TEXT  要分析的连接 ID [必需]
  -v, --verbose          详细输出
  --help                 显示帮助
```

### export - 导出报告

```bash
lock-analyzer export [OPTIONS]

Options:
  -w, --workload PATH     Workload JSONL 文件路径 [必需]
  -c, --config PATH       Lock config YAML 文件路径
  -o, --output PATH       输出报告文件路径 (不含扩展名) [必需]
  -f, --format [json|markdown|both]
                          输出格式 (默认: both)
  --show-timeline / --hide-timeline
                          是否在 Markdown 中包含时间线 (默认: 包含)
  --help                  显示帮助
```

## Workload JSONL 格式

每行一个 JSON 对象，描述一个数据库操作事件：

```json
{
  "connection_id": "conn-001",
  "operation": "read",
  "timestamp": "2026-05-05T10:00:00.000Z",
  "duration_ms": 10,
  "table": "users",
  "row_id": "row-1"
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `connection_id` | string | 是 | 连接标识 |
| `operation` | string | 是 | 操作类型：`begin`, `read`, `write`, `commit`, `rollback`, `connect`, `disconnect` |
| `timestamp` | string/number | 是 | ISO 格式时间戳或 Unix 时间戳 |
| `duration_ms` | number | 否 | 操作耗时（毫秒），默认 0 |
| `table` | string | 否 | 涉及的表名（read/write 操作） |
| `row_id` | string | 否 | 涉及的行标识（read/write 操作） |
| `data` | object | 否 | 额外数据 |

## 配置文件 (lock-config.yaml)

```yaml
busy_timeout_ms: 5000           # 锁请求超时时间（毫秒）
max_shared_locks: 100           # 最大共享锁数量
enable_deadlock_detection: true   # 是否启用死锁检测
starvation_threshold_ms: 30000     # 饿死风险阈值（毫秒）
lock_upgrade_enabled: true       # 是否允许锁升级
pending_lock_priority: true       # 等待锁优先级
```

## 示例场景

### 场景 1: 长读阻塞写

查看 `examples/workload-long-read-blocking.jsonl`：

```bash
lock-analyzer simulate -w examples/workload-long-read-blocking.jsonl -c examples/lock-config.yaml
```

这个场景展示了：
- 一个长读事务持有共享锁
- 写事务尝试获取保留锁成功
- 写事务等待升级排他锁被阻塞
- 读事务完成后写事务才继续

### 场景 2: 潜在死锁

查看 `examples/workload-deadlock.jsonl`：

```bash
lock-analyzer simulate -w examples/workload-deadlock.jsonl -c examples/lock-config.yaml
```

这个场景包含：
- conn-a 读取 table_a（持有共享锁）
- conn-b 读取 table_b（持有共享锁）
- conn-a 尝试写 table_b
- conn-b 尝试写 table_a

### 场景 3: 饿死风险

查看 `examples/workload-starvation.jsonl`：

```bash
lock-analyzer simulate -w examples/workload-starvation.jsonl -c examples/lock-config.yaml
```

这个场景展示：
- 多个读事务持续持有共享锁
- 写事务长期等待获取排他锁
- 可能发生饿死

## 运行测试

```bash
pytest tests/ -v
```

带覆盖率：

```bash
pytest tests/ -v --cov=lock_analyzer
```

## 项目结构

```
lock_analyzer/
├── __init__.py          # 模块入口
├── __main__.py          # 命令行入口
├── cli.py               # CLI 命令定义
├── lock_model.py        # 锁模型核心
├── parser.py            # Workload 和配置解析
├── simulator.py         # 模拟器核心
└── reporter.py          # 报告生成器

examples/
├── workload-normal.jsonl           # 正常场景
├── workload-long-read-blocking.jsonl  # 长读阻塞写
├── workload-deadlock.jsonl       # 死锁场景
├── workload-starvation.jsonl     # 饿死场景
└── lock-config.yaml              # 示例配置

tests/
├── test_lock_model.py    # 锁模型测试
├── test_parser.py       # 解析器测试
└── test_simulator.py     # 模拟器测试
```

## 许可证

MIT License
