# Sync Analyzer

一个用于分析 Go 代码中 `sync` 包使用模式的本地命令行工具。帮助团队复盘并发原语的高级用法，检测常见的并发问题。

## 功能特性

- **支持 6 种 sync 原语**：Mutex、RWMutex、WaitGroup、Once、Cond、Pool
- **7 类问题检测**：
  - 锁顺序反转（Lock Order Inversion）
  - 读写锁饥饿（RWMutex Starvation）
  - WaitGroup 计数错误
  - Once 初始化失败缓存
  - Cond 唤醒遗漏
  - Pool 误用
  - 竞争风险（Race Condition）
- **数据持久化**：分析结果存储到 SQLite 数据库
- **多格式导出**：支持 Markdown、JSON 报告格式
- **结果比较**：支持比较两次分析运行的差异

## 安装

### 依赖

- Go 1.21+
- Cobra CLI 框架
- SQLite3

### 构建

```bash
# 克隆项目
git clone <repository-url>
cd sync-analyzer

# 下载依赖
go mod tidy

# 构建
go build -o sync-analyzer ./cmd/sync-analyzer

# 或安装到 PATH
go install ./cmd/sync-analyzer
```

## 快速开始

### 1. 初始化工作空间

```bash
# 在当前目录初始化工作空间和数据库
sync-analyzer init
```

这会创建以下目录结构：
```
.
├── sync-analyzer.db    # SQLite 数据库
├── sync-cases.yaml     # 案例配置（可选）
├── events.jsonl        # 事件日志（可选）
└── snippets/           # Go 代码片段目录
    └── *.go
```

### 2. 准备输入数据

**方式一：使用 seed 数据（推荐初学者）**

项目 `testdata/` 目录下包含完整的示例数据，可直接用于测试：

```bash
# 复制 testdata 到工作目录
cp -r testdata/* .
```

**方式二：手动创建**

参考 `testdata/` 目录下的示例格式：

#### sync-cases.yaml - 案例配置

```yaml
name: "并发案例集"
cases:
  - name: "锁顺序反转案例"
    description: "演示不同 goroutine 以不同顺序获取多把锁导致死锁"
    primitives:
      - type: "Mutex"
        name: "mu1"
        location: "main.go:10"
      - type: "Mutex"
        name: "mu2"
        location: "main.go:11"
    expectations:
      - "检测到锁顺序反转问题"
```

#### events.jsonl - 事件日志

```jsonl
{"primitive_name":"mu1","primitive_type":"Mutex","event_type":"Lock","goroutine_id":1,"timestamp":"2024-01-01T00:00:00Z"}
{"primitive_name":"mu2","primitive_type":"Mutex","event_type":"Lock","goroutine_id":1,"timestamp":"2024-01-01T00:00:01Z"}
{"primitive_name":"mu2","primitive_type":"Mutex","event_type":"Unlock","goroutine_id":1,"timestamp":"2024-01-01T00:00:02Z"}
{"primitive_name":"mu1","primitive_type":"Mutex","event_type":"Unlock","goroutine_id":1,"timestamp":"2024-01-01T00:00:03Z"}
```

#### snippets/*.go - Go 代码片段

参考 `testdata/snippets/` 目录下的坏样例代码。

### 3. 执行分析

```bash
# 分析当前目录下的所有数据
sync-analyzer analyze

# 分析后会自动列出运行记录
# 或指定特定的运行 ID
sync-analyzer analyze --run-id 1

# 使用自定义名称
sync-analyzer analyze --name "my_analysis"
```

### 4. 查看分析结果

```bash
# 导出为 Markdown 报告（默认格式）
sync-analyzer export

# 导出为 JSON 格式
sync-analyzer export --format json

# 导出指定运行的结果
sync-analyzer export --run-id 2 --format markdown

# 导出到文件
sync-analyzer export --output report.md
```

### 5. 比较两次运行

```bash
# 比较最近两次运行
sync-analyzer compare

# 比较指定的两次运行
sync-analyzer compare --base 1 --compare 2

# 导出比较报告
sync-analyzer compare --base 1 --compare 2 --output comparison.md
```

## 命令详解

### init - 初始化工作空间

```bash
sync-analyzer init [flags]

Flags:
  -h, --help          help for init
      --seed-data     使用 seed 数据初始化工作空间
```

示例：
```bash
# 基础初始化
sync-analyzer init

# 初始化并复制 seed 数据
sync-analyzer init --seed-data
```

### analyze - 执行分析

```bash
sync-analyzer analyze [flags]

Flags:
  -c, --config string     sync-cases.yaml 文件路径 (default "sync-cases.yaml")
  -e, --events string     events.jsonl 文件路径 (default "events.jsonl")
  -s, --snippets string   snippets 目录路径 (default "snippets")
  -n, --name string       分析运行名称
  -r, --run-id int        使用指定的运行 ID 重新分析
  -h, --help              help for analyze
```

示例：
```bash
# 使用默认路径
sync-analyzer analyze

# 指定自定义路径
sync-analyzer analyze \
  --config ./config/my-cases.yaml \
  --events ./logs/events.jsonl \
  --snippets ./src/snippets \
  --name "production_analysis"
```

### compare - 比较分析结果

```bash
sync-analyzer compare [flags]

Flags:
  -b, --base int          基础运行 ID（旧版本）
  -c, --compare int       比较运行 ID（新版本）
  -f, --format string     输出格式 (text|json|markdown) (default "text")
  -o, --output string     输出文件路径
  -h, --help              help for compare
```

示例：
```bash
# 比较最近两次运行
sync-analyzer compare

# 比较指定运行并导出报告
sync-analyzer compare \
  --base 1 \
  --compare 3 \
  --format markdown \
  --output ./reports/comparison.md
```

### export - 导出分析报告

```bash
sync-analyzer export [flags]

Flags:
  -r, --run-id int        运行 ID（默认使用最新运行）
  -f, --format string     输出格式 (text|json|markdown) (default "markdown")
  -o, --output string     输出文件路径
  -h, --help              help for export
```

示例：
```bash
# 导出最新运行的 Markdown 报告
sync-analyzer export

# 导出指定运行的 JSON 格式
sync-analyzer export \
  --run-id 2 \
  --format json \
  --output ./reports/analysis.json
```

## 支持的检测项

| 问题类型 | 严重程度 | 描述 |
|---------|---------|------|
| Lock Order Inversion | Critical | 不同 goroutine 以不同顺序获取多把锁，可能导致死锁 |
| WaitGroup Count Error | Critical | Done 调用次数超过 Add，或在 goroutine 内调用 Add |
| RWMutex Starvation | High | 大量读锁导致写锁永远无法获取 |
| Cond Wakeup Miss | High | Wait 但没有对应的 Signal/Broadcast |
| Once Init Failed Cache | High | Once 初始化失败后无法重试，导致错误被缓存 |
| Pool Misuse | Medium | 使用 Pool 存储重要数据、缺少 New 函数、对象未重置 |
| Race Condition | Medium | 并发访问共享数据缺少同步保护 |

### 检测详情

#### 1. 锁顺序反转 (Lock Order Inversion)

**场景**：Goroutine A 以 mu1 → mu2 顺序获取锁，Goroutine B 以 mu2 → mu1 顺序获取锁。

**风险**：经典死锁场景。

**正确做法**：所有 goroutine 以相同的全局顺序获取锁（如按锁的内存地址排序）。

#### 2. WaitGroup 计数错误 (WaitGroup Count Error)

**场景**：
- `wg.Done()` 调用次数超过 `wg.Add()`
- 在 goroutine 内部调用 `wg.Add(1)`，可能导致 `wg.Wait()` 提前返回

**风险**：程序崩溃或逻辑错误。

**正确做法**：
```go
// ❌ 错误：在 goroutine 内调用 Add
go func() {
    wg.Add(1)  // 可能已经执行完 wg.Wait() 了
    defer wg.Done()
}()

// ✅ 正确：在启动 goroutine 前调用 Add
wg.Add(1)
go func() {
    defer wg.Done()
}()
```

#### 3. 读写锁饥饿 (RWMutex Starvation)

**场景**：大量读操作持续持有读锁，写操作永远等待。

**风险**：写操作饿死，系统状态无法更新。

**正确做法**：
- Go 1.19+ 的 RWMutex 已实现写锁优先级
- 考虑使用其他同步机制或限制读锁持有时间

#### 4. Once 初始化失败缓存 (Once Init Failed Cache)

**场景**：`sync.Once.Do()` 中的函数返回错误，后续调用不会重新执行。

**风险**：初始化失败后无法恢复。

**正确做法**：使用带错误处理的初始化模式：
```go
var (
    initialized atomic.Bool
    mu          sync.Mutex
)

func Init() error {
    if initialized.Load() {
        return nil
    }
    mu.Lock()
    defer mu.Unlock()
    if initialized.Load() {
        return nil
    }
    
    if err := doInit(); err != nil {
        return err
    }
    initialized.Store(true)
    return nil
}
```

#### 5. Cond 唤醒遗漏 (Cond Wakeup Miss)

**场景**：
- `Wait()` 但没有对应的 `Signal()` 或 `Broadcast()`
- 使用 `Signal()` 但需要 `Broadcast()`

**风险**：goroutine 永久阻塞。

**正确做法**：
```go
// ✅ 正确：必须在循环中检查条件
for !condition {
    cond.Wait()
}

// ✅ 正确：修改条件后发送信号
condition = true
cond.Signal()  // 或 cond.Broadcast()
```

#### 6. Pool 误用 (Pool Misuse)

**场景**：
- 使用 Pool 存储重要数据（Pool 中的对象可能被任意释放）
- 没有设置 `New` 函数，`Get()` 可能返回 `nil`
- 获取对象后没有重置状态

**风险**：数据丢失、空指针、状态污染。

**正确做法**：
```go
// ✅ 正确：设置 New 函数，使用后重置
var bufPool = sync.Pool{
    New: func() interface{} {
        return make([]byte, 1024)
    },
}

// 使用
buf := bufPool.Get().([]byte)
defer func() {
    buf = buf[:0]  // 重置
    bufPool.Put(buf)
}()
```

## 坏样例代码

项目 `testdata/snippets/` 目录包含以下坏样例，每个文件都有详细的问题说明和正确做法注释：

| 文件名 | 问题类型 |
|-------|---------|
| `lock_order_inversion.go` | 锁顺序反转 |
| `waitgroup_count_error.go` | WaitGroup 计数错误 |
| `rwmutex_starvation.go` | 读写锁饥饿 |
| `cond_wakeup_miss.go` | Cond 唤醒遗漏 |
| `pool_misuse.go` | Pool 误用 |
| `once_init_failed.go` | Once 初始化失败缓存 |

## 项目结构

```
sync-analyzer/
├── cmd/
│   └── sync-analyzer/
│       ├── main.go           # 主入口
│       └── commands/
│           ├── root.go       # 命令注册
│           ├── init.go       # init 子命令
│           ├── analyze.go    # analyze 子命令
│           ├── compare.go    # compare 子命令
│           └── export.go     # export 子命令
├── internal/
│   ├── models/
│   │   └── models.go         # 数据模型定义
│   ├── parser/
│   │   ├── yaml_parser.go    # YAML 解析器
│   │   ├── jsonl_parser.go   # JSONL 解析器
│   │   ├── go_parser.go      # Go AST 解析器
│   │   └── parser_test.go    # 解析器测试
│   ├── analyzer/
│   │   ├── analyzer.go       # 主分析器
│   │   ├── detectors.go      # 检测器实现
│   │   ├── lock_order_detector.go
│   │   └── analyzer_test.go  # 分析器测试
│   └── storage/
│       ├── schema.go         # 数据库 Schema
│       ├── sqlite.go         # SQLite 操作
│       ├── comparison.go     # 比较功能
│       └── storage_test.go   # 存储层测试
├── testdata/
│   ├── sync-cases.yaml       # 示例案例配置
│   ├── events.jsonl          # 示例事件日志
│   └── snippets/             # 坏样例代码
├── go.mod
├── go.sum
└── README.md
```

## 数据库 Schema

```sql
-- 分析运行记录表
CREATE TABLE analysis_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    status TEXT,
    error_message TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- sync 原语表
CREATE TABLE sync_primitives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER,
    type TEXT,
    name TEXT,
    location TEXT,
    file TEXT,
    line INTEGER,
    created_at TIMESTAMP,
    FOREIGN KEY (run_id) REFERENCES analysis_runs(id)
);

-- 操作事件表
CREATE TABLE sync_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER,
    primitive_name TEXT,
    primitive_type TEXT,
    event_type TEXT,
    goroutine_id INTEGER,
    timestamp TIMESTAMP,
    file TEXT,
    line INTEGER,
    created_at TIMESTAMP,
    FOREIGN KEY (run_id) REFERENCES analysis_runs(id)
);

-- 问题表
CREATE TABLE issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER,
    type TEXT,
    severity TEXT,
    title TEXT,
    description TEXT,
    file TEXT,
    line INTEGER,
    suggestion TEXT,
    created_at TIMESTAMP,
    FOREIGN KEY (run_id) REFERENCES analysis_runs(id)
);
```

## 开发指南

### 运行测试

```bash
# 运行所有测试
go test ./...

# 运行指定模块的测试
go test ./internal/parser/...
go test ./internal/analyzer/...
go test ./internal/storage/...

# 带覆盖率的测试
go test -cover ./...
```

### 添加新检测器

1. 在 `internal/models/models.go` 中添加新的 `IssueType`
2. 在 `internal/analyzer/detectors.go` 中实现 `Detector` 接口：
```go
type MyDetector struct{}

func (d *MyDetector) Name() string { return "my_detector" }

func (d *MyDetector) Detect(
    primitives []models.SyncPrimitive,
    events []models.SyncEvent,
    snippets []*models.CodeSnippet,
) ([]models.Issue, error) {
    // 实现检测逻辑
}
```

3. 在 `internal/analyzer/analyzer.go` 中注册检测器

## 常见问题

### Q: 分析结果显示 "No issues detected"，但我知道代码有问题？

A: 可能的原因：
1. 事件日志 `events.jsonl` 中的数据不完整
2. 代码片段 `snippets/` 中的代码没有触发检测器的规则
3. 检测器的规则可能需要调整

建议：检查 `testdata/` 中的示例格式，确保输入数据符合预期。

### Q: 如何查看数据库中的原始数据？

A: 使用 SQLite 客户端：
```bash
sqlite3 sync-analyzer.db

# 查看所有分析运行
SELECT * FROM analysis_runs;

# 查看检测到的问题
SELECT * FROM issues WHERE run_id = 1;
```

### Q: 支持哪些 Go 版本？

A: 建议使用 Go 1.21+，但代码也兼容 Go 1.18+。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
