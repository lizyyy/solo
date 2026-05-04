# Asyncio Diagnose

一个用于排查 Python asyncio 项目中协程卡住、任务泄漏和取消未生效问题的命令行工具。

## 功能特性

- **数据导入**: 支持导入多种诊断数据格式
  - `task_dump.json` - 任务状态转储
  - `event_loop_trace.jsonl` - 事件循环跟踪日志
  - `await_graph.yaml` - 协程等待关系图
  - `timeout_rules.yaml` - 超时规则配置

- **问题分析**: 自动检测多种 asyncio 常见问题
  - 长期 Pending 的任务 (协程卡住)
  - 任务泄漏 (创建但未 await 的任务)
  - 取消未生效 (忽略 CancelledError 的任务)
  - 超时链路分析
  - 队列堆积检测
  - 等待链和死锁检测

- **模拟与重放**:
  - `replay` - 重放事件循环跟踪
  - `simulate` - 模拟取消或超时操作，预测影响
  - `predict` - 预测潜在问题

- **报告导出**:
  - Markdown 格式报告
  - JSON 格式报告

## 安装

```bash
pip install -e .
```

## 快速开始

### 1. 查看帮助

```bash
asyncio-diagnose --help
```

### 2. 分析正常场景数据

```bash
# 使用 seed 数据（正常场景）
asyncio-diagnose \
  --task-dump data/seed/task_dump.json \
  --event-trace data/seed/event_loop_trace.jsonl \
  --await-graph data/seed/await_graph.yaml \
  --timeout-rules data/seed/timeout_rules.yaml \
  analyze
```

### 3. 分析有问题的场景

```bash
# 分析长期 pending 的任务
asyncio-diagnose \
  --task-dump data/bad_examples/long_pending_task_dump.json \
  analyze

# 分析任务泄漏
asyncio-diagnose \
  --task-dump data/bad_examples/task_leak_task_dump.json \
  analyze

# 分析取消未生效
asyncio-diagnose \
  --event-trace data/bad_examples/cancel_not_working_trace.jsonl \
  analyze

# 分析队列堆积
asyncio-diagnose \
  --event-trace data/bad_examples/queue_congestion_trace.jsonl \
  analyze
```

### 4. 重放事件

```bash
asyncio-diagnose \
  --event-trace data/seed/event_loop_trace.jsonl \
  replay
```

### 5. 模拟操作

```bash
# 模拟取消某个任务
asyncio-diagnose \
  --task-dump data/seed/task_dump.json \
  simulate cancel --task-id task-002

# 模拟超时
asyncio-diagnose \
  --task-dump data/seed/task_dump.json \
  --timeout-rules data/seed/timeout_rules.yaml \
  simulate timeout --task-id task-002 --timeout-seconds 10

# 预测问题
asyncio-diagnose \
  --task-dump data/bad_examples/long_pending_task_dump.json \
  simulate predict
```

### 6. 导出报告

```bash
# 导出 Markdown 报告
asyncio-diagnose \
  --task-dump data/bad_examples/long_pending_task_dump.json \
  export --format markdown --output report.md

# 导出 JSON 报告
asyncio-diagnose \
  --task-dump data/bad_examples/long_pending_task_dump.json \
  export --format json --output report.json
```

### 7. 列出任务

```bash
# 列出所有任务
asyncio-diagnose \
  --task-dump data/seed/task_dump.json \
  list

# 按状态筛选
asyncio-diagnose \
  --task-dump data/seed/task_dump.json \
  list --state pending
```

## 数据格式说明

### task_dump.json

任务状态转储文件，包含当前所有任务的状态信息。

```json
{
  "tasks": [
    {
      "task_id": "task-001",
      "name": "main_loop",
      "state": "running",
      "coro_name": "asyncio_main",
      "created_at": "2026-05-05T10:00:00Z",
      "last_updated_at": "2026-05-05T10:00:30Z",
      "waiting_on": null,
      "awaited_by": [],
      "cancel_requested": false,
      "metadata": {}
    }
  ]
}
```

### event_loop_trace.jsonl

事件循环跟踪日志，每行一个 JSON 对象。

```json
{"timestamp": "2026-05-05T10:00:00.000Z", "event_type": "task_created", "task_id": "task-001", "coro_name": "asyncio_main", "details": {}}
{"timestamp": "2026-05-05T10:00:00.100Z", "event_type": "task_running", "task_id": "task-001", "details": {}}
```

支持的事件类型:
- `task_created` - 任务创建
- `task_running` - 任务开始运行
- `task_pending` - 任务进入等待状态
- `task_done` - 任务完成
- `task_cancelled` - 任务已取消
- `task_cancel_requested` - 请求取消任务
- `task_waiting` - 任务正在等待另一个任务
- `queue_put` / `queue_get` - 队列操作

### await_graph.yaml

协程等待关系图。

```yaml
edges:
  - from: task-001
    to: task-002
    await_time: "2026-05-05T10:00:05.000Z"
    description: "main_loop awaiting api_request"
```

### timeout_rules.yaml

超时规则配置。

```yaml
rules:
  - pattern: "fetch_.*"
    timeout_seconds: 10.0
    description: "API 请求任务的默认超时时间"
```

## 如何在你的项目中生成诊断数据

### 1. 生成 task_dump.json

```python
import asyncio
import json
from datetime import datetime

def dump_tasks():
    tasks = []
    for task in asyncio.all_tasks():
        tasks.append({
            "task_id": str(id(task)),
            "name": task.get_name(),
            "state": "running" if task.done() is False else ("done" if task.done() else "pending"),
            "coro_name": task.get_coro().__name__ if hasattr(task.get_coro(), '__name__') else str(task.get_coro()),
            "created_at": datetime.now().isoformat(),
            "last_updated_at": datetime.now().isoformat(),
            "waiting_on": None,
            "awaited_by": [],
            "cancel_requested": task.cancelled(),
            "metadata": {}
        })
    
    with open("task_dump.json", "w") as f:
        json.dump({"tasks": tasks}, f, indent=2)
```

### 2. 生成 event_loop_trace.jsonl

可以使用自定义的事件循环策略来跟踪事件，或者使用 `sys.settrace` 来记录协程切换。

### 3. 生成 await_graph.yaml

通过分析任务的 `_fut_waiter` 属性来构建等待关系图。

## 命令参考

### 全局选项

- `--task-dump FILE` - task_dump.json 文件路径
- `--event-trace FILE` - event_loop_trace.jsonl 文件路径
- `--await-graph FILE` - await_graph.yaml 文件路径
- `--timeout-rules FILE` - timeout_rules.yaml 文件路径

### analyze 命令

运行完整的 asyncio 问题分析。

选项:
- `--pending-threshold FLOAT` - 长期 pending 的阈值（秒），默认 60 秒
- `--cancel-grace FLOAT` - 取消请求后的宽限期（秒），默认 5 秒
- `--format [table|json|markdown]` - 输出格式
- `--output PATH` - 输出文件路径

### replay 命令

重放事件循环跟踪日志。

选项:
- `--steps INT` - 重放的步数，默认重放所有
- `--format [table|json]` - 输出格式

### simulate 命令

模拟取消或超时操作，预测影响。

子命令:
- `cancel` - 模拟取消任务
  - `--task-id TEXT` - 目标任务 ID
- `timeout` - 模拟超时
  - `--task-id TEXT` - 目标任务 ID
  - `--timeout-seconds FLOAT` - 超时时间（秒）
- `predict` - 预测潜在问题

选项:
- `--format [table|json]` - 输出格式

### export 命令

导出分析报告。

选项:
- `--format [markdown|json]` - 导出格式
- `--output PATH` - 输出文件路径（必需）
- `--pending-threshold FLOAT` - 长期 pending 的阈值
- `--cancel-grace FLOAT` - 取消请求后的宽限期

### list 命令

列出所有任务。

选项:
- `--state [all|pending|running|done|cancelled]` - 按状态筛选
- `--format [table|json]` - 输出格式

## 示例数据

项目包含以下示例数据:

### Seed 数据 (正常场景)
- `data/seed/task_dump.json` - 正常运行的任务
- `data/seed/event_loop_trace.jsonl` - 正常的事件流
- `data/seed/await_graph.yaml` - 正常的等待关系
- `data/seed/timeout_rules.yaml` - 超时规则配置

### 坏样例 (问题场景)
- `data/bad_examples/long_pending_task_dump.json` - 长期卡住的任务
- `data/bad_examples/task_leak_task_dump.json` - 任务泄漏场景
- `data/bad_examples/cancel_not_working_trace.jsonl` - 取消未生效场景
- `data/bad_examples/queue_congestion_trace.jsonl` - 队列堆积场景

## 测试

```bash
# 安装测试依赖
pip install -e ".[test]"

# 运行测试
pytest
```

## License

MIT
