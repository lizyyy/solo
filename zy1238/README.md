# Concurrency Checker - Python 并发方案体检 CLI

一个帮助团队在多线程、多进程、asyncio 之间做选型和复盘的命令行工具。

## 功能特性

- 📋 **init**: 生成样例配置文件和代码片段
- 🔍 **analyze**: 静态分析并发方案，检测潜在问题
- ⚖️ **compare**: 对比两套方案的优劣
- 📊 **export**: 导出 Markdown/JSON 报告
- 💾 **SQLite**: 记录每次分析，便于历史追溯

## 安装

```bash
# 克隆项目后安装
pip install -e .
```

依赖项：
- Python 3.9+
- pyyaml
- rich
- click
- aiofiles

## 快速开始

### 1. 生成样例

```bash
# 在当前目录生成完整样例
concurrency-checker init

# 指定输出目录
concurrency-checker init -o ./my-project

# 生成特定类型的样例
concurrency-checker init -t threading
concurrency-checker init -t multiprocessing
concurrency-checker init -t asyncio
```

生成的文件结构：
```
./
├── concurrency-plan.yaml  # 并发方案配置
├── runs.jsonl             # 运行记录（JSONL 格式）
└── snippets/              # 代码片段目录
    ├── 01_threading_good.py
    ├── 02_multiprocessing_bad.py
    ├── 03_asyncio_bad.py
    ├── 04_shared_state.py
    └── 05_queue_backpressure.py
```

### 2. 分析并发方案

```bash
# 使用默认路径分析
concurrency-checker analyze

# 指定文件路径
concurrency-checker analyze \
    --plan ./my-plan.yaml \
    --runs ./my-runs.jsonl \
    --snippets ./my-snippets

# 保存分析结果到数据库
concurrency-checker analyze --save

# 显示详细信息
concurrency-checker analyze --verbose
```

### 3. 管理分析记录

```bash
# 列出所有分析记录
concurrency-checker export --list

# 显示最近 20 条记录
concurrency-checker export --list -n 20

# 查看特定分析详情
concurrency-checker show 1

# 删除分析记录
concurrency-checker delete 1
```

### 4. 导出报告

```bash
# 导出为 Markdown 格式
concurrency-checker export 1

# 导出为 JSON 格式
concurrency-checker export 1 -f json

# 导出到指定文件
concurrency-checker export 1 -o ./report.md
```

### 5. 对比方案

```bash
# 对比两次分析
concurrency-checker compare 1 2

# 显示详细对比
concurrency-checker compare 1 2 --verbose
```

## 检测的问题类型

### CPU/I/O 占比分析
- 根据代码模式和运行记录自动判断任务类型
- CPU 密集型 → 推荐 multiprocessing
- I/O 密集型 → 推荐 threading 或 asyncio

### 共享状态问题
- 多进程中使用 global/nonlocal 变量
- 多进程中使用 threading.Lock（无效）
- 缺少锁保护导致的竞态条件
- 过多锁竞争

### Pickle/IPC 成本
- lambda 函数无法被 pickle
- 实例方法传递给进程池
- 未使用 Manager 的共享对象

### 进程池问题
- 未设置 chunksize
- 任务大小与 chunksize 不匹配

### Async 阻塞调用
- 在 asyncio 中使用 time.sleep()
- 在 asyncio 中使用 requests
- 阻塞的文件 I/O

### 取消和超时问题
- 长期运行任务无超时
- 未处理 CancelledError
- 缺少任务取消机制

### 队列背压问题
- 无界队列（未设置 maxsize）
- 缺少消费者
- 未调用 task_done()

## 配置文件说明

### concurrency-plan.yaml

```yaml
# 项目基本信息
project:
  name: "项目名称"
  description: "项目描述"
  version: "1.0.0"

# 并发类型选择
# 可选值: threading, multiprocessing, asyncio, mixed
concurrency_type: "threading"

# 任务类型
# 可选值: cpu_bound, io_bound, mixed
task_type: "io_bound"

# 工作进程/线程数量
workers: 4

# 预期任务量
expected_tasks: 100

# 依赖的库
dependencies:
  - name: "requests"
    purpose: "HTTP 请求"

# 已知约束
constraints:
  - "需要保持与 Python 3.8 的兼容性"

# 预期指标
metrics:
  expected_latency_ms: 100
  expected_throughput_qps: 50
```

### runs.jsonl 格式

每行一个 JSON 对象：

```json
{
  "run_id": "run_001",
  "timestamp": "2024-01-01T12:00:00",
  "concurrency_type": "threading",
  "workers": 4,
  "task_count": 100,
  "total_time_sec": 12.5,
  "avg_latency_ms": 450,
  "throughput_qps": 8,
  "cpu_usage": 65,
  "io_usage": 85,
  "memory_usage_mb": 120,
  "success_count": 98,
  "error_count": 2,
  "error": null
}
```

## 常见问题

### Q: 如何正确选择并发方案？

根据任务类型：

| 任务类型 | 推荐方案 | 理由 |
|---------|---------|------|
| CPU 密集型 | multiprocessing | 绕过 GIL，充分利用多核 |
| I/O 密集型（低并发） | threading | 简单易用，线程开销小 |
| I/O 密集型（高并发） | asyncio | 单线程，高并发，资源占用少 |
| 混合型 | mixed | 根据子任务特性选择 |

### Q: 什么情况下会产生高风险？

- **严重风险 (critical)**: 锁未释放（死锁风险）、无界队列（内存泄漏）
- **高风险 (high)**: lambda 无法 pickle、async 中使用阻塞调用、多进程共享全局变量
- **中等风险 (medium)**: 无超时、无 chunksize、过多锁竞争
- **低风险 (low)**: 配置不匹配、缺少监控

### Q: 如何修复检测到的问题？

参考工具给出的建议。常见修复方式：

1. **多进程共享变量**：使用 `multiprocessing.Manager()` 或 `Value/Array`
2. **pickle 问题**：定义顶层函数代替 lambda，使用 `dill` 库
3. **async 阻塞**：使用 `asyncio.sleep()` 代替 `time.sleep()`，使用 `aiohttp` 代替 `requests`
4. **队列背压**：设置 `maxsize`，确保有消费者，调用 `task_done()`
5. **锁问题**：使用 context manager (`with lock:`)，减少锁粒度

### Q: 数据库存储在哪里？

默认位置：`~/.concurrency_checker/analysis.db`

可以通过环境变量自定义：
```bash
export CONCURRENCY_CHECKER_DB="/path/to/custom.db"
```

## 使用示例

### 示例 1: 分析一个新项目

```bash
# 1. 初始化项目
concurrency-checker init -o ./my-project
cd ./my-project

# 2. 查看样例代码（包含各种问题）
ls snippets/

# 3. 分析当前方案
concurrency-checker analyze --verbose

# 4. 保存分析结果
concurrency-checker analyze --save

# 5. 导出报告
concurrency-checker export 1 -o analysis_report.md
```

### 示例 2: 对比两种方案

```bash
# 1. 分析方案 A 并保存
cd ./project-a
concurrency-checker analyze --save  # 假设保存为 ID 1

# 2. 分析方案 B 并保存
cd ../project-b
concurrency-checker analyze --save  # 假设保存为 ID 2

# 3. 对比两个方案
concurrency-checker compare 1 2

# 4. 选择更优方案
```

### 示例 3: 复盘历史分析

```bash
# 查看所有分析记录
concurrency-checker export --list

# 查看特定分析详情
concurrency-checker show 5

# 导出为 JSON 用于进一步处理
concurrency-checker export 5 -f json -o analysis_5.json
```

## 坏配置示例

### 示例 1: 多进程中的常见错误

```python
# ❌ 错误：lambda 无法被 pickle
pool.map(lambda x: x * 2, data)

# ✅ 正确：定义顶层函数
def double(x):
    return x * 2
pool.map(double, data)
```

```python
# ❌ 错误：全局变量在多进程中不共享
counter = 0
def increment():
    global counter
    counter += 1

# ✅ 正确：使用 Manager
from multiprocessing import Manager
manager = Manager()
counter = manager.Value('i', 0)
```

### 示例 2: asyncio 中的常见错误

```python
# ❌ 错误：使用阻塞的 sleep
import time
async def bad_task():
    time.sleep(1)  # 阻塞事件循环！

# ✅ 正确：使用 asyncio.sleep
import asyncio
async def good_task():
    await asyncio.sleep(1)
```

```python
# ❌ 错误：使用阻塞的 requests
import requests
async def fetch_bad():
    response = requests.get("https://example.com")  # 阻塞！

# ✅ 正确：使用 aiohttp
import aiohttp
async def fetch_good():
    async with aiohttp.ClientSession() as session:
        async with session.get("https://example.com") as response:
            return await response.text()
```

### 示例 3: 队列背压问题

```python
# ❌ 错误：无界队列
q = queue.Queue()  # 没有 maxsize！
# 如果生产者远快于消费者，内存会耗尽

# ✅ 正确：有界队列
q = queue.Queue(maxsize=100)  # 设置上限
# 队列满时，put() 会阻塞，实现背压
```

```python
# ❌ 错误：缺少 task_done()
def consumer(q):
    while True:
        item = q.get()
        process(item)
        # q.task_done()  # 缺失！

# q.join() 永远不会返回

# ✅ 正确：调用 task_done()
def consumer(q):
    while True:
        item = q.get()
        process(item)
        q.task_done()  # 必须调用！
```

## 开发

```bash
# 安装开发依赖
pip install -e ".[dev]"

# 运行测试
python -m pytest

# 代码格式化
black src/
```

## 许可证

MIT License