# Concurrency Inspector - Go 并发模型设计体检 CLI

一个用于分析和评审 Go 并发模型设计的命令行工具，帮助团队在设计评审时发现潜在的 goroutine 泄漏、无限堆积、乱序结果和吞吐瓶颈。

## 功能特性

- **多维度分析**: 分析 goroutine 拓扑、队列容量、背压、优先级、超时预算、错误传播和关闭顺序
- **代码静态分析**: 解析 Go 代码片段，检测 goroutine 泄漏、死锁、无限循环等问题
- **多命令支持**:
  - `init`: 初始化新的并发设计项目
  - `analyze`: 分析并发设计并生成报告
  - `compare`: 比较两个并发设计方案
  - `export`: 导出 Markdown/JSON 格式报告
  - `seed`: 生成示例数据和坏样例
- **SQLite 持久化**: 保存设计方案和分析结果
- **可视化报告**: 支持 Markdown 和 JSON 格式导出

## 安装

### 依赖

- Go 1.16+
- SQLite3

### 编译安装

```bash
# 克隆项目
git clone <repository-url>
cd concurrency-inspector

# 安装依赖
go mod tidy

# 编译
go build -o concurrency-inspector ./cmd/inspector

# 安装到 PATH
sudo mv concurrency-inspector /usr/local/bin/
```

## 快速开始

### 1. 初始化项目

```bash
concurrency-inspector init my-project
```

这会创建以下目录结构：

```
my-project/
├── design.yaml      # 并发设计配置文件
├── events.jsonl     # 运行时事件日志（可选）
└── snippets/        # Go 代码片段目录
    └── worker_pool_example.go
```

### 2. 编辑 design.yaml

定义你的并发模型设计：

```yaml
name: my-worker-pool
description: 一个 Worker Pool 并发设计
version: "1.0.0"

concurrency:
  patterns:
    - worker-pool
  max_workers: 10
  rate_limit:
    type: token-bucket
    requests: 100
    per_second: 1
    burst: 50

queues:
  - name: task-queue
    type: channel
    capacity: 100
    priority: false
    description: 任务输入队列

  - name: result-queue
    type: channel
    capacity: 100
    priority: false
    description: 结果输出队列

  - name: error-queue
    type: channel
    capacity: 50
    priority: false
    description: 错误处理队列

goroutines:
  - name: dispatcher
    type: dispatcher
    output_queues:
      - task-queue
    workers: 1
    timeout: 10s

  - name: worker
    type: worker
    input_queues:
      - task-queue
    output_queues:
      - result-queue
      - error-queue
    workers: 8
    timeout: 30s
    retry_count: 3

  - name: result-collector
    type: collector
    input_queues:
      - result-queue
    workers: 2
    timeout: 15s

  - name: error-handler
    type: handler
    input_queues:
      - error-queue
    workers: 1
    timeout: 10s

timeout:
  default: 30s
  startup: 10s
  shutdown: 15s
  operation: 30s
  cancel_propagate: true

error:
  strategy: continue-on-error
  max_retries: 3
  retry_backoff: 1s
  error_queue: error-queue
  panic_handler: true

shutdown:
  graceful: true
  order:
    - dispatcher
    - worker
    - result-collector
    - error-handler
  wait_timeout: 10s
  force_kill: true
```

### 3. 添加代码片段

在 `snippets/` 目录下添加你的 Go 代码文件，工具会自动分析其中的并发模式。

### 4. 执行分析

```bash
concurrency-inspector analyze my-project -v
```

### 5. 导出报告

```bash
# 导出 Markdown 格式
concurrency-inspector export my-project -f markdown

# 导出 JSON 格式
concurrency-inspector export my-project -f json

# 指定输出文件
concurrency-inspector export my-project -o report.md
```

## 命令详解

### init

初始化一个新的并发设计项目。

```bash
concurrency-inspector init [project-name] [flags]
```

**Flags:**
- `-d, --dir string`: 项目目录路径（默认: "."）
- `-D, --description string`: 项目描述

### analyze

分析并发设计并生成报告。

```bash
concurrency-inspector analyze [project-name] [flags]
```

**Flags:**
- `-d, --dir string`: 项目目录路径（默认: "."）
- `-v, --verbose`: 显示详细分析过程
- `-o, --output string`: 输出文件路径

**分析维度：**
1. **拓扑结构分析**: 检测循环依赖、孤立节点、并发模式
2. **队列分析**: 检查队列容量、消费者/生产者数量
3. **背压分析**: 识别潜在瓶颈
4. **优先级分析**: 检查优先级队列配置
5. **超时与取消传播**: 验证超时设置和取消传播
6. **错误处理**: 分析错误策略、重试配置
7. **优雅关闭**: 检查关闭顺序和超时
8. **代码静态分析**: 解析 Go 代码检测问题

### compare

比较两个并发设计方案。

```bash
concurrency-inspector compare [project1] [project2] [flags]
```

**Flags:**
- `-v, --verbose`: 显示详细比较信息

**比较维度：**
- 综合评分
- 拓扑结构差异
- 队列配置差异
- 背压分析差异
- 超时策略差异
- 错误处理差异
- 优雅关闭差异
- 问题统计

### export

导出分析报告。

```bash
concurrency-inspector export [project-name] [flags]
```

**Flags:**
- `-f, --format string`: 输出格式: markdown 或 json（默认: "markdown"）
- `-o, --output string`: 输出文件路径
- `-s, --stdout`: 输出到标准输出

### seed

生成示例数据和坏样例。

```bash
concurrency-inspector seed [type] [flags]
```

**类型：**
- `good`: 生成良好的并发设计示例
- `bad`: 生成有问题的并发设计示例
- `all`: 生成所有示例

**Flags:**
- `-d, --dir string`: 输出目录路径（默认: "."）
- `-f, --force`: 强制覆盖现有文件

## design.yaml 配置说明

### 顶级字段

| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | 设计名称 |
| description | string | 设计描述 |
| version | string | 版本号 |
| concurrency | ConcurrencySpec | 并发配置 |
| queues | []QueueSpec | 队列配置列表 |
| goroutines | []GoroutineSpec | Goroutine 配置列表 |
| timeout | TimeoutSpec | 超时配置 |
| error | ErrorSpec | 错误处理配置 |
| shutdown | ShutdownSpec | 关闭配置 |

### ConcurrencySpec

| 字段 | 类型 | 说明 |
|------|------|------|
| patterns | []string | 并发模式列表 |
| max_workers | int | 最大 Worker 数 |
| rate_limit | RateLimitSpec | 限流配置（可选） |

**支持的并发模式：**
- `worker-pool`: Worker Pool 模式
- `fan-in`: Fan-In 模式
- `fan-out`: Fan-Out 模式
- `pipeline`: Pipeline 模式

### QueueSpec

| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | 队列名称 |
| type | string | 队列类型 |
| capacity | int | 队列容量（0 表示无界） |
| priority | bool | 是否为优先级队列 |
| description | string | 描述（可选） |

**队列类型：**
- `channel`: Go Channel
- `priority-queue`: 优先级队列
- `custom`: 自定义实现

### GoroutineSpec

| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | Goroutine 名称 |
| type | string | 类型 |
| input_queues | []string | 输入队列列表 |
| output_queues | []string | 输出队列列表 |
| workers | int | Worker 实例数 |
| timeout | string | 超时时间（可选） |
| retry_count | int | 重试次数（可选） |

**Goroutine 类型：**
- `dispatcher`: 分发器
- `worker`: 工作者
- `collector`: 收集器
- `handler`: 处理器
- `monitor`: 监控器

### TimeoutSpec

| 字段 | 类型 | 说明 |
|------|------|------|
| default | string | 默认超时 |
| startup | string | 启动超时（可选） |
| shutdown | string | 关闭超时（可选） |
| operation | string | 操作超时（可选） |
| cancel_propagate | bool | 是否启用取消传播 |

### ErrorSpec

| 字段 | 类型 | 说明 |
|------|------|------|
| strategy | string | 错误处理策略 |
| max_retries | int | 最大重试次数（可选） |
| retry_backoff | string | 重试退避时间（可选） |
| error_queue | string | 错误队列名称（可选） |
| panic_handler | bool | 是否有 Panic Handler |

**错误处理策略：**
- `fail-fast`: 快速失败
- `continue-on-error`: 继续执行
- `circuit-breaker`: 熔断器模式

### ShutdownSpec

| 字段 | 类型 | 说明 |
|------|------|------|
| graceful | bool | 是否启用优雅关闭 |
| order | []string | 关闭顺序 |
| wait_timeout | string | 等待超时 |
| force_kill | bool | 是否支持强制终止 |

## 问题检测

### 高风险问题 (Critical)

| 问题 | 说明 | 建议 |
|------|------|------|
| 无界队列 | 队列容量为 0 或负数 | 设置合理的队列容量 |
| 循环依赖 | Goroutine 之间形成循环 | 重新设计数据流 |
| 无优雅关闭 | 未配置优雅关闭 | 启用优雅关闭 |
| 无关闭超时 | 未配置关闭等待超时 | 配置合理的超时 |
| 无 Panic Handler | 未配置 Panic 恢复 | 添加 defer recover() |

### 中等风险问题 (High)

| 问题 | 说明 | 建议 |
|------|------|------|
| 无取消传播 | 未启用 context 取消传播 | 启用 cancel_propagate |
| 无错误队列 | continue-on-error 策略下无错误队列 | 配置错误队列 |
| 无退避重试 | 配置了重试但无退避策略 | 添加退避时间 |
| 背压问题 | 生产者远多于消费者 | 增加消费者或限流 |

### 低风险问题 (Warning)

| 问题 | 说明 | 建议 |
|------|------|------|
| 队列容量过小 | 队列容量 < 10 | 增加队列容量 |
| 孤立 Goroutine | Goroutine 无输入输出 | 检查是否需要 |
| 未知关闭顺序 | 关闭顺序包含未定义 Goroutine | 修正关闭顺序 |
| 缺少关闭顺序 | 部分 Goroutine 未在关闭顺序中 | 添加到关闭顺序 |

## 坏样例学习

使用 `seed bad` 命令生成有问题的设计示例，学习识别常见的并发设计问题：

```bash
concurrency-inspector seed bad
```

### 常见问题示例

#### 1. 无界队列

```yaml
queues:
  - name: task-queue
    type: channel
    capacity: 0  # 危险！无界队列可能导致内存溢出
```

**风险：** 消息无限堆积，导致 OOM。

#### 2. 无取消传播

```yaml
timeout:
  cancel_propagate: false  # 危险！goroutine 可能泄漏
```

**风险：** 超时或取消信号无法传递，goroutine 永远运行。

#### 3. 无 Panic Handler

```yaml
error:
  panic_handler: false  # 危险！一个错误导致整个程序崩溃
```

**风险：** 单个 goroutine 的 panic 会导致整个程序退出。

#### 4. 无优雅关闭

```yaml
shutdown:
  graceful: false  # 危险！正在处理的任务会丢失
```

**风险：** 程序退出时，正在处理的任务会丢失。

#### 5. 代码中的问题

```go
// 问题1: 无缓冲 channel 可能导致阻塞
taskChan := make(chan Task)  // 无缓冲

// 问题2: 无限循环无退出条件
for {
    // 没有 break 或 return
}

// 问题3: goroutine 无 panic recovery
go func() {
    // 没有 defer recover()
}()

// 问题4: 阻塞 select 无超时
for {
    select {}  // 永久阻塞
}
```

## 测试

运行单元测试：

```bash
go test ./internal/analyzer/... -v
```

运行所有测试：

```bash
go test ./... -v
```

## 示例工作流

1. **创建良好示例**
   ```bash
   concurrency-inspector seed good
   ```

2. **分析良好示例**
   ```bash
   concurrency-inspector analyze example-good-worker-pool -v
   ```

3. **创建坏样例**
   ```bash
   concurrency-inspector seed bad
   ```

4. **分析坏样例（观察检测到的问题）**
   ```bash
   concurrency-inspector analyze example-bad-worker-pool -v
   ```

5. **比较两个方案**
   ```bash
   concurrency-inspector compare example-good-worker-pool example-bad-worker-pool -v
   ```

6. **导出报告**
   ```bash
   concurrency-inspector export example-good-worker-pool -o good-report.md
   concurrency-inspector export example-bad-worker-pool -o bad-report.md
   ```

## 项目结构

```
.
├── cmd/
│   └── inspector/
│       └── main.go           # 主入口
├── internal/
│   ├── analyzer/
│   │   ├── analyzer.go       # 分析引擎
│   │   └── analyzer_test.go  # 测试
│   ├── commands/
│   │   ├── commands.go       # 命令基础
│   │   ├── init.go           # init 命令
│   │   ├── analyze.go        # analyze 命令
│   │   ├── compare.go        # compare 命令
│   │   ├── export.go         # export 命令
│   │   └── seed.go           # seed 命令
│   ├── models/
│   │   └── models.go         # 数据模型
│   └── storage/
│       └── sqlite.go         # SQLite 存储
├── go.mod
├── go.sum
└── README.md
```

## License

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。
