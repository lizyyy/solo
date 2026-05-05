# Escape Analyzer

Go 内存逃逸体检 CLI 工具，用于分析 Go 程序的内存逃逸情况，帮助开发者识别性能瓶颈并给出可落地的重构建议。

## 功能特性

- 📊 **逃逸日志解析**：解析 `go build -gcflags=-m` 生成的逃逸日志
- 🔍 **智能分析**：自动识别逃逸原因（接口装箱、闭包捕获、指针返回、slice/map 扩容、goroutine 边界）
- 📈 **Benchmark 集成**：支持导入 benchmark 结果，关联分配数据
- 💾 **历史记录**：保存每次分析记录，支持回溯查看
- 🔄 **对比分析**：对比优化前后的分配变化，量化改进效果
- 📝 **重构建议**：针对不同逃逸原因给出可落地的重构建议
- 📄 **多格式报告**：支持导出 Markdown 和 JSON 格式报告

## 安装

```bash
go install escape-analyzer
```

或从源码构建：

```bash
git clone <repo-url>
cd escape-analyzer
go build -o escape-analyzer .
```

## 使用方法

### 1. 生成逃逸日志

首先需要生成 Go 程序的逃逸分析日志：

```bash
go build -gcflags="-m -m" ./... 2>&1 > escape.log
```

> 说明：
> - `-m`：显示逃逸分析决策
> - `-m -m`：显示更详细的逃逸分析信息
> - `2>&1`：将 stderr 重定向到 stdout（因为逃逸日志输出到 stderr）

### 2. 分析逃逸日志

```bash
# 基础分析
escape-analyzer analyze escape.log

# 带描述和源文件
escape-analyzer analyze escape.log -d "优化前分析" -s ./src

# 导入 benchmark 结果
escape-analyzer analyze escape.log -b bench.log

# 导出 JSON 报告
escape-analyzer analyze escape.log -o report.json -f json

# 导出 Markdown 报告
escape-analyzer analyze escape.log -o report.md -f markdown
```

### 3. 查看历史记录

```bash
# 查看所有历史记录
escape-analyzer history

# 查看最近 10 条记录
escape-analyzer history -l 10

# 查看特定记录的详细信息
escape-analyzer history -d <analysis-id>
```

### 4. 对比分析

```bash
# 对比两次分析结果
escape-analyzer compare <before-id> <after-id>

# 导出对比报告
escape-analyzer compare <before-id> <after-id> -o comparison.md -f markdown
```

### 5. 生成报告

```bash
# 生成 Markdown 报告
escape-analyzer report <analysis-id> -o report.md -f markdown

# 生成 JSON 报告
escape-analyzer report <analysis-id> -o report.json -f json
```

## 逃逸原因说明

| 逃逸原因 | 说明 | 常见场景 |
|---------|------|---------|
| **接口装箱** | 具体类型赋值给接口类型时发生逃逸 | `var w io.Writer = &bytes.Buffer{}` |
| **闭包捕获** | 变量被闭包捕获并在 goroutine 中使用 | `go func() { process(x) }()` |
| **指针返回** | 函数返回局部变量的指针 | `func Create() *User { return &User{} }` |
| **Slice 扩容** | Slice 动态扩容导致底层数组逃逸 | `var items []string; items = append(items, x)` |
| **Map 扩容** | Map 动态扩容导致逃逸 | `m := make(map[string]int); m[k] = v` |
| **Goroutine 边界** | 变量跨 goroutine 边界传递 | `go process(data)` |

## 完整示例

### 1. 准备测试代码

项目包含两个示例文件：

- `examples/bad/before.go` - 包含多种逃逸问题的代码
- `examples/good/after.go` - 优化后的代码

### 2. 生成逃逸日志

```bash
# 分析优化前代码
cd examples/bad
go build -gcflags="-m -m" . 2>&1 > escape-before.log

# 分析优化后代码
cd ../good
go build -gcflags="-m -m" . 2>&1 > escape-after.log
```

### 3. 执行分析

```bash
# 分析优化前
escape-analyzer analyze examples/bad/escape-before.log -d "优化前分析"

# 分析优化后
escape-analyzer analyze examples/good/escape-after.log -d "优化后分析"
```

### 4. 对比分析

```bash
# 查看历史记录获取 ID
escape-analyzer history

# 对比两次分析（替换为实际的 ID）
escape-analyzer compare <before-id> <after-id> -o comparison.md -f markdown
```

## 重构建议示例

### 接口装箱优化

```go
// 优化前（逃逸）
var w io.Writer = &bytes.Buffer{}
w.Write(data)

// 优化后（栈分配）
buf := &bytes.Buffer{}
buf.Write(data)
```

### 指针返回优化

```go
// 优化前（逃逸）
func Create() *User {
    return &User{Name: "test"}
}

// 优化后（可栈分配）
func Create() User {
    return User{Name: "test"}
}

// 或让调用者预分配
func Create(u *User) {
    *u = User{Name: "test"}
}
```

### Slice 预分配

```go
// 优化前（可能多次扩容）
var items []string
for i := 0; i < 1000; i++ {
    items = append(items, strconv.Itoa(i))
}

// 优化后（预分配）
items := make([]string, 0, 1000)
for i := 0; i < 1000; i++ {
    items = append(items, strconv.Itoa(i))
}
```

### Goroutine 边界优化

```go
// 优化前（逃逸）
data := make([]byte, 1024)
go func() {
    process(data)
}()

// 优化后（传递副本）
data := make([]byte, 1024)
copyData := make([]byte, len(data))
copy(copyData, data)
go func() {
    process(copyData)
}()
```

## 命令参考

### analyze

分析逃逸日志。

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-d, --desc` | 分析描述 | - |
| `-s, --source` | 源文件或目录 | - |
| `-b, --benchmark` | benchmark 结果文件 | - |
| `-o, --output` | 输出文件路径 | - |
| `-f, --format` | 输出格式: console, json, markdown | console |
| `--no-save` | 不保存到历史记录 | false |

### history

查看历史分析记录。

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-l, --limit` | 显示最近 N 条记录 | 20 |
| `-d, --detail` | 显示指定记录的详细信息（需提供 ID） | false |

### compare

对比两次分析结果。

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-o, --output` | 输出文件路径 | - |
| `-f, --format` | 输出格式: console, json, markdown | console |

### report

生成分析报告。

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-o, --output` | 输出文件路径 | report.md |
| `-f, --format` | 输出格式: json, markdown | markdown |

## 坏输入提示

工具提供友好的错误提示，帮助用户快速定位问题：

| 场景 | 提示信息 |
|------|---------|
| 文件不存在 | `无法打开逃逸日志文件: open escape.log: no such file or directory` |
| 无效的分析 ID | `analysis result with ID 'xxx' not found` |
| 缺少参数 | `Error: requires at least 1 arg(s), only received 0` |
| 解析失败 | `分析失败: ...` |

## 开发

### 运行测试

```bash
go test ./...
```

### 项目结构

```
escape-analyzer/
├── cmd/                    # CLI 命令
│   ├── root.go            # 根命令
│   ├── analyze.go         # analyze 子命令
│   ├── history.go         # history 子命令
│   ├── compare.go         # compare 子命令
│   └── report.go          # report 子命令
├── internal/
│   ├── analyzer/          # 分析引擎
│   │   └── engine.go
│   ├── parser/            # 日志解析器
│   │   ├── escape_log.go
│   │   └── escape_log_test.go
│   ├── reporter/          # 报告生成器
│   │   └── generator.go
│   └── storage/           # 存储模块
│       └── store.go
├── pkg/
│   └── types/             # 类型定义
│       └── escape.go
├── examples/              # 示例代码
│   ├── bad/
│   │   └── before.go
│   └── good/
│       └── after.go
├── testdata/              # 测试数据
│   ├── escape_log.txt
│   └── benchmark.txt
├── main.go
├── go.mod
└── README.md
```

## License

MIT
