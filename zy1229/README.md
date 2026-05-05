# Go 性能剖析助手 (go-perf-helper)

一个用于分析 Go 程序性能剖析数据的命令行工具，帮助你快速定位 CPU 热点、内存泄漏、锁竞争和 Goroutine 阻塞等性能问题。

## 功能特性

- **多类型剖析支持**：支持 CPU、Heap（内存）、Block（阻塞）、Mutex（锁竞争）、runtime/trace 和 benchstat 结果
- **智能瓶颈识别**：自动识别性能瓶颈并按严重程度排序
- **证据片段展示**：提供具体的调用栈和样本数据作为证据
- **优化建议**：针对不同类型的瓶颈提供针对性的优化建议
- **版本对比**：支持两次版本的性能分析对比，找出改进和回归
- **报告导出**：支持导出 Markdown 和 JSON 格式的报告
- **历史记录**：保存每次分析记录，便于后续查看和对比

## 安装

```bash
# 克隆仓库
git clone <repository-url>
cd go-perf-helper

# 构建
go build -o go-perf-helper .

# 或直接安装
go install .
```

## 快速开始

### 分析单个剖析文件

```bash
# 分析 CPU 剖析
./go-perf-helper analyze --cpu cpu_profile.txt --name "CPU 性能分析"

# 分析内存剖析
./go-perf-helper analyze --heap heap_profile.txt --name "内存性能分析"

# 同时分析多种剖析数据
./go-perf-helper analyze \
    --cpu cpu_profile.txt \
    --heap heap_profile.txt \
    --mutex mutex_profile.txt \
    --name "完整性能分析"
```

### 使用样例数据测试

```bash
# 使用提供的样例数据测试
./go-perf-helper analyze \
    --cpu examples/cpu_profile.txt \
    --heap examples/heap_profile.txt \
    --block examples/block_profile.txt \
    --mutex examples/mutex_profile.txt \
    --trace examples/trace_events.txt \
    --name "样例数据分析"
```

### 保存和导出报告

```bash
# 保存分析结果到本地存储
./go-perf-helper analyze --cpu cpu_profile.txt --save --name "我的分析"

# 导出 Markdown 报告
./go-perf-helper analyze --cpu cpu_profile.txt --output report.md

# 导出 JSON 报告
./go-perf-helper analyze --cpu cpu_profile.txt --output report.json
```

### 列出已保存的分析

```bash
./go-perf-helper list

# 显示详细信息
./go-perf-helper list --all
```

### 对比两次分析

```bash
# 对比两个已保存的分析
./go-perf-helper compare <old-analysis-id> <new-analysis-id>

# 导出对比报告
./go-perf-helper compare <old-id> <new-id> --output comparison.md
```

## 命令参考

### analyze 命令

分析性能剖析数据，识别瓶颈并生成优化建议。

**参数：**
- `--name, -n`：分析名称
- `--cpu, -c`：CPU 剖析文件路径
- `--heap, -m`：堆内存剖析文件路径
- `--block, -b`：阻塞剖析文件路径
- `--mutex, -x`：锁竞争剖析文件路径
- `--trace, -t`：runtime/trace 文件路径
- `--benchstat, -s`：benchstat 对比文件路径
- `--cpu-threshold`：CPU 瓶颈识别阈值（默认 0.10）
- `--memory-threshold`：内存瓶颈识别阈值（默认 0.20）
- `--blocking-threshold`：阻塞瓶颈识别阈值（默认 0.10）
- `--mutex-threshold`：锁竞争瓶颈识别阈值（默认 0.10）
- `--save, -S`：保存分析结果
- `--output, -o`：输出文件路径（支持 .json 和 .md）

### list 命令

列出已保存的分析记录。

**参数：**
- `--limit, -l`：限制显示的记录数量
- `--all, -a`：显示所有字段

### compare 命令

对比两次分析结果。

**参数：**
- `--old-file, -o`：旧分析结果文件路径
- `--new-file, -n`：新分析结果文件路径
- `--output, -O`：输出文件路径
- `--details, -d`：显示详细的对比信息

### export 命令

导出分析报告。

**参数：**
- `--format, -f`：输出格式（md 或 json）
- `--output, -o`：输出文件路径
- `--details, -d`：包含详细的调用栈信息

## 性能瓶颈类型

工具会识别以下类型的性能瓶颈：

### CPU 瓶颈 (cpu)
- 描述：某个函数占用大量 CPU 时间
- 识别依据：CPU 样本占比超过阈值（默认 10%）
- 优化建议：算法优化、减少循环、并发处理

### 内存瓶颈 (memory)
- 描述：内存使用过高或频繁分配
- 识别依据：内存分配或使用占比超过阈值（默认 20%）
- 优化建议：减少分配、使用对象池、检查内存泄漏

### 阻塞瓶颈 (blocking)
- 描述：程序长时间阻塞等待
- 识别依据：阻塞时间占比超过阈值（默认 10%）
- 优化建议：异步 I/O、超时控制、增加并发

### 锁竞争瓶颈 (mutex)
- 描述：多个 goroutine 竞争同一把锁
- 识别依据：锁等待时间占比超过阈值（默认 10%）
- 优化建议：减少锁粒度、使用读写锁、无锁数据结构

### Goroutine 瓶颈 (goroutine)
- 描述：Goroutine 长时间阻塞或泄漏
- 识别依据：Goroutine 阻塞时间超过阈值
- 优化建议：检查死锁、通道问题、I/O 阻塞

## 数据格式

### 支持的输入格式

工具支持以下格式的输入文件：

1. **pprof 文本格式**：通过 `go tool pprof -text <profile>` 生成
2. **trace 文本格式**：通过 `go tool trace -d <trace>` 生成
3. **benchstat 输出**：通过 `benchstat` 命令生成的对比结果

### 示例 pprof 文本格式

```
Type: cpu
Time: May 5, 2026 at 10:00am (CST)
Duration: 10s, Total samples = 10000
Showing nodes accounting for 10000, 100% of 10000 total
----------------------------------------------------------+-------------
      flat  flat%   sum%        cum   cum%   calls calls% + context          
----------------------------------------------------------+-------------
      6000 60.00% 60.00%       6000 60.00%                | main.processData
                                         6000 100%   6000 100% | main.handleRequest
----------------------------------------------------------+-------------

    main.processData
        main/data_processor.go:120
    main.handleRequest
        main/http_handler.go:78
```

## 工作流程

1. **数据导入**：解析 CPU/Heap/Block/Mutex/Trace 等剖析文件
2. **瓶颈识别**：分析数据，识别超过阈值的性能热点
3. **排序排序**：按严重程度对瓶颈进行排序
4. **建议生成**：根据瓶颈类型生成针对性的优化建议
5. **报告生成**：生成 Markdown 或 JSON 格式的报告
6. **存储保存**：可选地保存分析结果以便后续查看和对比

## 常见问题

### Q: 如何获取 pprof 剖析数据？

```bash
# CPU 剖析
go tool pprof -text http://localhost:6060/debug/pprof/profile?seconds=30 > cpu_profile.txt

# 内存剖析
go tool pprof -text http://localhost:6060/debug/pprof/heap > heap_profile.txt

# 阻塞剖析
go tool pprof -text http://localhost:6060/debug/pprof/block > block_profile.txt

# 锁竞争剖析
go tool pprof -text http://localhost:6060/debug/pprof/mutex > mutex_profile.txt
```

### Q: 如何获取 runtime/trace 数据？

```bash
# 启动程序时启用 trace
go run -trace trace.out main.go

# 或通过 HTTP 获取
curl -o trace.out http://localhost:6060/debug/pprof/trace?seconds=30

# 解析为文本格式
go tool trace -d trace.out > trace_events.txt
```

### Q: 如何使用 benchstat 对比基准测试？

```bash
# 运行基准测试并保存结果
go test -bench=. -count=5 ./... > old.txt
# 修改代码后重新运行
go test -bench=. -count=5 ./... > new.txt

# 使用 benchstat 对比
benchstat old.txt new.txt > benchstat_result.txt
```

### Q: 分析结果保存在哪里？

默认保存在用户主目录下：
- `~/.go-perf-helper/analyses/`：分析记录
- `~/.go-perf-helper/analyses/index.json`：索引文件

## 异常处理

### 文件格式错误

如果遇到文件格式错误，工具会提示：
```
错误：无法解析 CPU 剖析文件: ...
```

**解决方法：**
1. 确保文件是有效的 pprof 文本格式
2. 使用 `go tool pprof -text` 重新生成文件
3. 检查文件编码是否正确

### 权限错误

如果遇到权限错误：
```
警告：无法创建存储: permission denied
```

**解决方法：**
1. 检查主目录的写入权限
2. 或使用其他存储位置

## 依赖

- Go 1.21+
- github.com/spf13/cobra v1.8.0
- golang.org/x/perf

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
