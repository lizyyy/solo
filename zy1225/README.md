# chanalyzer - Go Channel Deadlock & Throughput Analyzer

一个用于分析 Go channel 死锁、goroutine 泄漏和吞吐问题的本地 CLI 工具。专为 Go 新人设计，帮助理解 `hchan` 内部的 `sendq`、`recvq`、缓冲区、`select` 和 `close` 如何影响唤醒顺序。

## 功能特性

- **init**: 初始化项目结构，生成示例文件和配置
- **replay**: 复盘 channel 操作，模拟执行流程，生成事件时间线
- **analyze**: 分析死锁、泄漏风险，提供修复建议和代码示例
- **export**: 导出 Markdown/JSON 格式的分析报告

## 安装

```bash
go install github.com/zy1225/chanalyzer@latest
```

或从源码构建：

```bash
git clone https://github.com/zy1225/chanalyzer.git
cd chanalyzer
go build -o chanalyzer .
```

## 快速开始

### 1. 初始化项目

```bash
# 在当前目录初始化
chanalyzer init

# 在指定目录初始化
chanalyzer init --dir ./my-channel-project
```

这会创建以下结构：
```
.
├── channel-cases.yaml    # Channel 案例配置
├── events.jsonl          # 事件日志文件
├── snippets/             # Go 代码示例片段
│   ├── 01_unbuffered_deadlock.go
│   ├── 02_nil_channel.go
│   ├── 03_closed_channel.go
│   ├── 04_select_timeout.go
│   └── 05_goroutine_leak.go
└── reports/              # 报告输出目录
```

### 2. 复盘 Channel 操作

```bash
# 复盘所有案例
chanalyzer replay

# 复盘指定案例
chanalyzer replay --case unbuffered-deadlock

# 从事件文件复盘
chanalyzer replay --events events.jsonl

# 显示时间线和快照
chanalyzer replay --timeline --snapshots
```

### 3. 分析死锁和泄漏

```bash
# 分析已复盘的数据
chanalyzer analyze

# 复盘并分析（一步完成）
chanalyzer analyze --replay

# 指定案例分析
chanalyzer analyze --replay --case nil-channel-send
```

### 4. 导出报告

```bash
# 导出 Markdown 报告
chanalyzer export --format markdown --output report.md

# 导出 JSON 报告
chanalyzer export --format json --output report.json

# 导出两种格式
chanalyzer export --format all --output report

# 复盘、分析、导出一步完成
chanalyzer export --replay --case unbuffered-deadlock --format markdown
```

## 核心概念

### Hchan 结构

工具模拟 Go 运行时的 `hchan` 结构：

```go
type Hchan struct {
    ID           string
    BufferSize   int           // 缓冲区大小
    Buffer       []interface{} // 缓冲区内容
    Sendq        []*Goroutine  // 发送等待队列
    Recvq        []*Goroutine  // 接收等待队列
    State        ChannelState  // active/closed/nil
}
```

### 关键场景分析

#### 1. 无缓冲 Channel 死锁

**问题**: 发送方在无缓冲 channel 上发送，但没有接收方准备好。

```go
func main() {
    ch := make(chan int)  // 无缓冲
    ch <- 42              // 阻塞！没有接收方
    val := <-ch           // 永远不会执行
}
```

**分析结果**:
- `sendq` 队列有 1 个 goroutine 等待
- `recvq` 队列为空
- 所有 goroutine 阻塞 → 死锁

**修复建议**:
- 先启动接收 goroutine
- 或使用缓冲 channel

#### 2. Nil Channel 永久阻塞

**问题**: 对 nil channel 进行操作。

```go
var ch chan int  // nil channel
ch <- 42         // 永久阻塞！
```

**分析结果**:
- channel 状态为 `nil`
- 任何读写操作都会永久阻塞
- 关闭 nil channel 会 panic

**修复建议**:
- 始终使用 `make()` 初始化 channel

#### 3. 关闭 Channel 后的操作

**问题**: 对已关闭的 channel 发送数据。

```go
ch := make(chan int, 2)
close(ch)
ch <- 42  // PANIC!
```

**分析结果**:
- 发送到已关闭 channel → panic
- 从已关闭 channel 接收 → 返回零值
- 关闭已关闭 channel → panic

**修复建议**:
- 只有发送方应该关闭 channel
- 使用 `comma-ok` 惯用法检查 channel 状态

#### 4. Select 分支选择

**问题**: 理解 select 如何选择分支。

```go
select {
case ch1 <- val:
    fmt.Println("Sent to ch1")
case ch2 <- val:
    fmt.Println("Sent to ch2")
case <-time.After(1 * time.Second):
    fmt.Println("Timeout")
default:
    fmt.Println("No ready channels")
}
```

**分析规则**:
- 如果多个 case 就绪，随机选择一个
- 如果没有就绪 case，但有 `default`，执行 `default`
- 如果没有 `default`，阻塞等待
- `time.After()` 创建一个在指定时间后发送的 channel

## 配置说明

### channel-cases.yaml 格式

```yaml
cases:
  - id: "case-id"
    name: "Case Name"
    description: "Case description"
    category: "deadlock|leak|normal"
    difficulty: "beginner|intermediate|advanced"
    channels:
      - id: "ch1"
        name: "channel name"
        buffer_size: 0      # 0 = 无缓冲
        is_nil: false       # 是否为 nil channel
    goroutines:
      - id: "g1"
        name: "goroutine name"
        role: "sender|receiver|controller"
    steps:
      - step: 1
        action: "send|recv|close|select"
        goroutine: "g1"
        channel: "ch1"
        value: 42
        select_case:
          - type: "send|recv"
            channel: "ch1"
            is_default: false
        comment: "Step description"
    expected:
      deadlock: true
      blocked_goroutines: ["g1"]
    tags: ["tag1", "tag2"]
```

### events.jsonl 格式

每行一个 JSON 对象：

```json
{"id":"evt_1","type":"send","timestamp":"2024-01-15T10:00:00Z","channel_id":"ch1","goroutine":"g1","value":42,"metadata":{"blocked":true}}
```

## 测试

运行单元测试：

```bash
go test ./internal/...
```

运行特定测试：

```bash
go test ./internal/models/...
go test ./internal/replay/...
```

## 项目结构

```
chanalyzer/
├── cmd/
│   ├── root.go       # 根命令
│   ├── init.go       # init 命令
│   ├── replay.go     # replay 命令
│   ├── analyze.go    # analyze 命令
│   └── export.go     # export 命令
├── internal/
│   ├── models/
│   │   ├── hchan.go      # Channel 和 Goroutine 模型
│   │   ├── event.go      # 事件模型
│   │   ├── case.go       # 案例模型
│   │   └── hchan_test.go # 测试
│   ├── replay/
│   │   ├── replayer.go   # 复盘逻辑
│   │   └── replayer_test.go
│   ├── analyzer/
│   │   └── analyzer.go   # 分析逻辑
│   ├── exporter/
│   │   └── exporter.go   # 导出逻辑
│   ├── storage/
│   │   └── sqlite.go     # SQLite 存储
│   └── initializer/
│       └── init.go       # 项目初始化
├── main.go
├── go.mod
└── README.md
```

## 常见问题

### Q: 为什么无缓冲 channel 会导致死锁？

A: 无缓冲 channel 要求发送方和接收方**同时就绪**。如果只有发送方没有接收方，发送操作会永久阻塞。

### Q: nil channel 和空 channel 有什么区别？

A:
- **nil channel**: 未初始化 (`var ch chan int`)，任何操作都会永久阻塞
- **空 channel**: 已初始化但缓冲区为空，可以正常操作（发送/接收会阻塞等待）

### Q: 谁应该关闭 channel？

A: **发送方**应该关闭 channel。因为接收方不知道发送方何时完成，而发送方知道自己何时发送完毕。

### Q: select 如何选择多个就绪的 case？

A: Go 使用**伪随机**算法选择。这意味着如果多个 case 同时就绪，不能依赖执行顺序。

## 参考资源

- [Go 语言规范 - Channel 类型](https://go.dev/ref/spec#Channel_types)
- [Effective Go - Channels](https://go.dev/doc/effective_go#channels)
- [Go 语言设计与实现 - Channel](https://draveness.me/golang/docs/part3-runtime/ch06-concurrency/golang-channel/)

## License

MIT
