# GCInsight - Go GC 问题复盘工具

GCInsight 是一个专门帮助 Go 后端开发者复盘 GC 问题的本地命令行工具。它可以导入多种 GC 相关数据，进行深度分析，并输出结构化的报告和调参建议。

## 功能特性

- **多格式数据导入**
  - 支持 `gctrace.log`（Go GC 跟踪日志）
  - 支持 `heap-samples.csv`（堆采样数据）
  - 支持 `alloc-events.jsonl`（内存分配事件）

- **深度 GC 分析**
  - 三色标记过程分析
  - 写屏障开销评估
  - GC Pacer 堆目标偏差分析
  - GC Assist 压力检测
  - GOGC/GOMEMLIMIT 参数影响评估

- **核心指标输出**
  - 暂停时间分布（P50/P95/P99）
  - 堆目标达成率与偏差
  - Assist 压力等级
  - 内存峰值分析
  - 调参建议

- **数据持久化与对比**
  - SQLite 本地存储分析结果
  - 多会话对比分析
  - Markdown/JSON 报告导出

## 安装

```bash
# 克隆仓库
git clone <repo-url>
cd gcinsight

# 构建
go build -o gcinsight .

# 或者直接运行
go run .
```

## 快速开始

### 1. 使用样例数据测试

项目提供了样例数据，可以直接用于测试：

```bash
# 分析样例数据
./gcinsight analyze \
  --gc-trace examples/gctrace.log \
  --heap-sample examples/heap-samples.csv \
  --alloc-event examples/alloc-events.jsonl \
  --name "test-session" \
  --desc "测试会话"
```

### 2. 生成自己的 GC 数据

#### 收集 GC 跟踪日志

运行 Go 程序时设置环境变量：

```bash
# 启用 GC 跟踪日志
GODEBUG=gctrace=1 ./your-program 2> gctrace.log
```

#### 收集堆采样数据

可以使用 `runtime.ReadMemStats()` 定期采样并写入 CSV：

```go
package main

import (
    "encoding/csv"
    "os"
    "runtime"
    "time"
)

func main() {
    file, _ := os.Create("heap-samples.csv")
    defer file.Close()
    writer := csv.NewWriter(file)
    defer writer.Flush()

    // 写入表头
    writer.Write([]string{
        "timestamp", "heap_alloc", "heap_sys", "heap_inuse",
        "heap_idle", "heap_released", "heap_objects",
        "mallocs", "frees", "next_gc", "last_gc",
        "num_gc", "num_forced_gc", "gc_cpu_fraction",
    })

    // 定期采样
    ticker := time.NewTicker(1 * time.Second)
    defer ticker.Stop()

    for range ticker.C {
        var m runtime.MemStats
        runtime.ReadMemStats(&m)
        
        writer.Write([]string{
            time.Now().Format(time.RFC3339),
            uint64ToString(m.Alloc),
            uint64ToString(m.Sys),
            uint64ToString(m.HeapInuse),
            uint64ToString(m.HeapIdle),
            uint64ToString(m.HeapReleased),
            uint64ToString(m.HeapObjects),
            uint64ToString(m.Mallocs),
            uint64ToString(m.Frees),
            uint64ToString(m.NextGC),
            uint64ToString(m.LastGC),
            uint32ToString(m.NumGC),
            uint32ToString(m.NumForcedGC),
            float64ToString(m.GCCPUFraction),
        })
        writer.Flush()
    }
}
```

## 命令详解

### analyze - 分析 GC 数据

```bash
gcinsight analyze [flags]
```

**参数说明：**

| 参数 | 简写 | 说明 |
|------|------|------|
| `--gc-trace` | `-g` | gctrace.log 文件路径 |
| `--heap-sample` | `-s` | heap-samples.csv 文件路径 |
| `--alloc-event` | `-a` | alloc-events.jsonl 文件路径 |
| `--name` | `-n` | 会话名称（可选，默认自动生成） |
| `--desc` | `-d` | 会话描述（可选） |
| `--format` | `-f` | 输出格式：markdown 或 json（默认 markdown） |
| `--output` | `-o` | 输出文件路径（可选） |

**示例：**

```bash
# 仅分析 GC 跟踪日志
gcinsight analyze --gc-trace ./gctrace.log

# 分析所有三种数据并导出报告
gcinsight analyze \
  --gc-trace ./gctrace.log \
  --heap-sample ./heap-samples.csv \
  --alloc-event ./alloc-events.jsonl \
  --name "production-issue" \
  --desc "生产环境 GC 异常分析" \
  --format markdown \
  --output ./report.md
```

### list - 列出所有会话

```bash
gcinsight list
```

列出所有已保存的分析会话，包括会话 ID、名称、创建时间等信息。

### compare - 对比两个会话

```bash
gcinsight compare [flags]
```

**参数说明：**

| 参数 | 简写 | 说明 |
|------|------|------|
| `--session-a` | `-a` | 第一个会话 ID（必填） |
| `--session-b` | `-b` | 第二个会话 ID（必填） |
| `--format` | `-f` | 输出格式：markdown 或 json |
| `--output` | `-o` | 输出文件路径 |

**示例：**

```bash
# 对比调参前后的效果
gcinsight compare \
  --session-a 1 \
  --session-b 2 \
  --format markdown \
  --output ./comparison.md
```

### export - 导出已保存的报告

```bash
gcinsight export [flags]
```

**参数说明：**

| 参数 | 简写 | 说明 |
|------|------|------|
| `--session` | `-s` | 会话 ID（必填） |
| `--format` | `-f` | 输出格式：markdown 或 json |
| `--output` | `-o` | 输出文件路径（必填） |

**示例：**

```bash
# 导出已保存的分析报告
gcinsight export \
  --session 1 \
  --format json \
  --output ./result.json
```

## 报告解读

### 暂停分布分析

- **平均暂停**：所有 GC 暂停时间的平均值
- **P95 暂停**：95% 的 GC 暂停时间不超过该值
- **P99 暂停**：99% 的 GC 暂停时间不超过该值
- **STW 暂停**：需要停止所有用户 goroutine 的暂停事件

> 💡 提示：P99 暂停超过 10ms 可能影响延迟敏感的应用

### 堆目标偏差分析

- **目标达成率**：实际堆使用未超过目标的 GC 循环比例
- **平均偏差**：实际值与目标值的平均偏差百分比
- **高压标记**：超过 20% 的 GC 未达成目标时会触发警告

### GC Assist 压力

- **Assist 次数**：需要用户 goroutine 协助标记的次数
- **高压 GC**：单次 assist 超过 100MB 的 GC 循环

> 💡 提示：频繁的 GC assist 说明分配速率过快，需要优化

### 调参建议

工具会根据分析结果自动生成调参建议，按严重程度分为：

- **🚨 Critical**：需要立即处理的严重问题
- **⚠️ High**：需要关注的高优先级问题
- **ℹ️ Low**：可优化的建议项

## 常见问题

### Q: 遇到格式错误怎么办？

工具提供了详细的错误提示，例如：

```
GC 跟踪日志格式错误！
═══════════════════════════════════════════════

错误位置: 第 1 行
期望格式: gc # @#s #%: #+#+# ms clock, #+#/#+#/#+# ms cpu, #->#-># MB, # MB goal, # P
实际内容: 这是一行错误的 GC 日志格式

提示:
  - Go GC 跟踪日志的标准格式为:
    gc # @#s #%: #+#+# ms clock, #+#/#+#/#+# ms cpu, #->#-># MB, # MB goal, # P
  - 正确的样例:
    gc 1 @0.001s 0%: 0.010+0.48+0.005 ms clock, 0.020+0/0.30/0.25+0.010 ms cpu, 4->4->2 MB, 5 MB goal, 4 P

  - 要生成 GC 跟踪日志，请在运行 Go 程序时设置:
    GODEBUG=gctrace=1 ./your-program > gctrace.log

═══════════════════════════════════════════════
```

### Q: 如何优化 GC 暂停时间？

常见的优化方向：

1. **调整 GOGC**：增加 GOGC 值（如 GOGC=150）减少 GC 频率
2. **设置 GOMEMLIMIT**：限制内存使用，避免内存压力过大
3. **减少大对象分配**：大对象会触发更多的 GC 工作
4. **使用内存池**：sync.Pool 可以减少临时对象的分配
5. **优化数据结构**：减少指针数量，降低标记阶段开销

### Q: 什么是 GC Assist？

当用户 goroutine 分配内存时，如果当前 GC 标记进度落后于分配速率，Go 运行时会让用户 goroutine 协助完成部分标记工作，这就是 GC Assist。

频繁的 GC Assist 会影响应用性能，因为本该执行业务逻辑的 goroutine 被用来做 GC 工作。

## 运行测试

```bash
# 运行所有测试
go test ./...

# 运行特定包的测试
go test ./parser/...
go test ./analyzer/...

# 带覆盖率的测试
go test -cover ./...
```

## 项目结构

```
gcinsight/
├── main.go              # 入口文件
├── go.mod               # 模块定义
├── cmd/                 # 命令行接口
│   ├── root.go          # 根命令
│   ├── analyze.go       # analyze 命令
│   ├── compare.go       # compare 命令
│   └── export.go        # export 命令
├── models/              # 数据模型
│   └── models.go        # 核心数据结构
├── parser/              # 数据解析器
│   ├── gctrace.go       # GC 日志解析
│   ├── heapsample.go    # 堆采样解析
│   ├── allocevent.go    # 分配事件解析
│   └── parser_test.go   # 解析器测试
├── analyzer/            # 分析引擎
│   ├── analyzer.go      # 核心分析逻辑
│   └── analyzer_test.go # 分析器测试
├── exporter/            # 报告导出
│   └── exporter.go      # Markdown/JSON 导出
├── storage/             # 数据存储
│   └── sqlite.go        # SQLite 存储实现
├── errors/              # 错误处理
│   └── errors.go        # 错误类型和提示
└── examples/            # 样例数据
    ├── gctrace.log          # GC 跟踪日志样例
    ├── heap-samples.csv     # 堆采样数据样例
    ├── alloc-events.jsonl   # 分配事件样例
    ├── bad-gctrace.log      # 错误格式样例
    └── bad-heap-samples.csv # 错误 CSV 样例
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
