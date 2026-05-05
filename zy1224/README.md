# deferpanic - Go defer/panic/recover 执行链分析工具

专为 Go 新人设计的 CLI 工具，帮助理解 defer、panic、recover 的复杂执行流程。

## 功能特性

- 🎯 **模拟执行**：模拟函数调用、多个 defer 的 LIFO 执行
- 🚨 **panic 分析**：模拟 panic 栈展开、二次 panic 覆盖
- 🔄 **recover 验证**：验证 recover 只在延迟函数里生效
- 📊 **返回值追踪**：追踪命名返回值被 defer 修改的过程
- 📝 **风险分析**：自动检测风险点并提供修复建议
- 💾 **SQLite 存储**：每次分析结果写入 SQLite 数据库
- 📄 **报告导出**：支持导出 Markdown/JSON 格式报告

## 安装

```bash
git clone <repo-url>
cd deferpanic
go mod tidy
go build -o deferpanic .
```

## 快速开始

### 1. 初始化工作目录

```bash
./deferpanic init
```

这将创建：
- `cases.yaml` - 分析用例定义
- `events.jsonl` - 事件日志示例
- `snippets/` - Go 代码片段目录
- `.deferpanic/` - 数据存储目录

使用 `-f` 或 `--force` 强制覆盖现有文件：
```bash
./deferpanic init -f
```

### 2. 重放分析用例

```bash
# 重放所有用例
./deferpanic replay

# 重放指定用例
./deferpanic replay -c panic_recover

# 显示详细执行过程
./deferpanic replay -v

# 交互式模式（逐步执行）
./deferpanic replay -i
```

### 3. 比较执行记录

```bash
./deferpanic compare <记录ID1> <记录ID2>

# 输出 JSON 格式
./deferpanic compare <记录ID1> <记录ID2> -o json
```

### 4. 导出报告

```bash
# 导出所有记录为 Markdown
./deferpanic export

# 导出指定记录
./deferpanic export -e <记录ID>

# 包含风险分析和修复建议
./deferpanic export -r

# 导出 JSON 格式
./deferpanic export -f json

# 保存到文件
./deferpanic export -o report.md
```

## 命令详解

### init

初始化工作目录，创建必要的文件结构。

**参数：**
- `-f, --force`: 强制覆盖现有文件

### replay

重放分析用例，模拟 defer/panic/recover 的执行流程。

**参数：**
- `-c, --case`: 指定要重放的用例名称
- `-v, --verbose`: 显示详细执行过程
- `-i, --interactive`: 交互式模式，逐步执行

**输出示例：**
```
========================================
重放用例: panic_recover
========================================

执行结果:
  状态: recovered
  已恢复: 是
✓ 已保存到数据库 (ID: a1b2c3d4)
```

### compare

比较两个执行记录的差异。

**参数：**
- `<记录ID1>`: 第一个执行记录的 ID
- `<记录ID2>`: 第二个执行记录的 ID
- `-o, --output`: 输出格式 (table/json, 默认 table)

### export

导出分析报告。

**参数：**
- `-e, --execution-id`: 执行记录 ID，不指定则导出全部
- `-f, --format`: 导出格式 (markdown/json, 默认 markdown)
- `-o, --output`: 输出文件路径
- `-r, --include-risk`: 包含风险分析和修复建议

## 内置用例

初始化后，`cases.yaml` 包含以下示例用例：

| 用例名称 | 描述 | 关键点 |
|---------|------|--------|
| `basic_defer` | 基础 defer 执行顺序 | defer 后注册先执行 |
| `multi_defer` | 多个 defer 的 LIFO | 后进先出顺序 |
| `panic_recover` | panic 后 recover | recover 只在 defer 中有效 |
| `named_return` | defer 修改命名返回值 | return 先赋值，defer 后修改 |
| `nested_recover` | 嵌套 recover 场景 | panic 向上传播，外层 recover |
| `double_panic` | 二次 panic 覆盖问题 | defer 中的 panic 会覆盖原始 panic |

## 数据格式

### cases.yaml 格式

```yaml
cases:
  - name: 用例名称
    description: 用例描述
    snippet: snippets/代码文件.go
    expected_return:
      type: int
      value: 0
    expected_status: normal/recovered/panicked
    risk_level: low/medium/high
```

### events.jsonl 格式

每行一个 JSON 对象：

```json
{"timestamp": "2024-01-15T10:00:00Z", "event_type": "case_start", "case_name": "basic_defer", "details": {"snippet": "snippets/basic_defer.go"}}
```

### 执行时间线事件类型

| 事件类型 | 描述 |
|---------|------|
| `FUNC_ENTER` | 进入函数 |
| `FUNC_EXIT` | 退出函数 |
| `FUNC_CALL` | 调用函数 |
| `FUNC_RETURN` | 函数返回 |
| `DEFER_PUSH` | 注册 defer |
| `DEFER_EXEC` | 执行 defer |
| `DEFER_EXEC_START` | 开始执行 defer 栈 |
| `NORMAL_EXEC` | 正常代码执行 |
| `PANIC_TRIGGER` | panic 触发 |
| `PANIC_UNWIND` | panic 栈展开 |
| `PANIC_CONTINUE` | panic 继续传播 |
| `PANIC_FINAL` | 最终 panic |
| `RECOVER_ATTEMPT` | 尝试 recover |
| `RECOVER_SUCCESS` | recover 成功 |
| `RECOVER_EFFECT` | recover 生效 |
| `RETURN_INIT` | 返回值初始化 |
| `RETURN_SET` | return 语句设置返回值 |
| `RETURN_MODIFIED` | defer 修改返回值 |
| `RETURN_FINAL` | 最终返回值 |
| `FUNC_CRASH` | 函数崩溃 |
| `GENERIC_EXEC` | 通用执行 |

## 风险分析

工具会自动检测以下风险：

### 高风险 🔴
- **二次 panic 覆盖**：defer 中产生的 panic 会覆盖原始 panic，导致错误信息丢失
- **panic 无 recover**：存在 panic 但没有对应的 recover，程序会崩溃

### 中风险 🟡
- **命名返回值被 defer 修改**：这是合法但容易混淆的行为，需要明确理解执行顺序

### 低风险 🟢
- 正常执行流程

## 修复建议示例

### 问题：defer 中的 panic 覆盖原始 panic

```go
// ❌ 错误示例
func badExample() {
    defer func() {
        panic("新的 panic") // 会覆盖原始 panic
    }()
    panic("原始 panic")
}

// ✅ 正确示例
func goodExample() {
    defer func() {
        if r := recover(); r != nil {
            // 保存原始 panic 信息
            log.Printf("原始 panic: %v", r)
            // 处理后决定是否重新 panic
        }
    }()
    panic("原始 panic")
}
```

### 问题：recover 不在 defer 中

```go
// ❌ 错误示例
func badRecover() {
    if r := recover(); r != nil { // recover 在正常流中，返回 nil
        fmt.Println(r)
    }
    panic("error")
}

// ✅ 正确示例
func goodRecover() {
    defer func() {
        if r := recover(); r != nil { // recover 在 defer 中
            fmt.Println("恢复:", r)
        }
    }()
    panic("error")
}
```

### 问题：命名返回值的混淆

```go
// 需要理解的行为
func namedReturn() (result int) {
    defer func() {
        result++ // defer 修改命名返回值
    }()
    return 1 // 1. result = 1; 2. 执行 defer; 3. 返回 result=2
}
```

## 坏格式示例

`examples/` 目录包含坏格式示例，用于测试错误处理：

- `bad_cases.yaml` - 无效的 YAML 格式、缺少必需字段
- `bad_events.jsonl` - 无效的 JSON 行、缺少 event_type
- `bad_recover_placement.go` - recover 不在 defer 中的错误代码
- `bad_defer_panic.go` - defer 中 panic 覆盖原始 panic 的问题代码

## 数据库结构

数据存储在 `.deferpanic/analysis.db` SQLite 数据库中：

### executions 表

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | TEXT | 执行记录 ID |
| case_name | TEXT | 用例名称 |
| status | TEXT | 执行状态 |
| return_value | TEXT | 返回值 (JSON) |
| panic_value | TEXT | Panic 值 (JSON) |
| recovered | INTEGER | 是否已恢复 |
| defer_stack | TEXT | Defer 栈 (JSON) |
| timeline_json | TEXT | 时间线 (JSON) |
| risk_level | TEXT | 风险等级 |
| risk_json | TEXT | 风险分析 (JSON) |
| started_at | DATETIME | 开始时间 |
| completed_at | DATETIME | 完成时间 |
| created_at | DATETIME | 创建时间 |

### events 表

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | INTEGER | 自增 ID |
| timestamp | TEXT | 事件时间戳 |
| event_type | TEXT | 事件类型 |
| case_name | TEXT | 关联用例 |
| details_json | TEXT | 详情 (JSON) |
| created_at | DATETIME | 创建时间 |

## 测试

运行测试：

```bash
go test ./...
```

运行特定包测试：

```bash
go test ./pkg/executor/
go test ./pkg/parser/
```

## 项目结构

```
deferpanic/
├── main.go                 # 入口文件
├── cmd/
│   └── commands.go         # CLI 命令实现
├── pkg/
│   ├── executor/
│   │   ├── executor.go     # 核心执行逻辑
│   │   └── executor_test.go
│   ├── parser/
│   │   ├── cases.go        # YAML 解析
│   │   ├── events.go       # JSONL 解析
│   │   ├── snippets.go     # Go 代码解析
│   │   └── parser_test.go
│   ├── storage/
│   │   └── storage.go      # SQLite 存储
│   └── report/
│       └── report.go       # 报告生成
├── examples/               # 坏格式示例
│   ├── bad_cases.yaml
│   ├── bad_events.jsonl
│   ├── bad_recover_placement.go
│   └── bad_defer_panic.go
└── go.mod
```

## 常见问题

### Q: recover 为什么没有生效？

A: recover 只在以下情况有效：
1. 必须在 defer 函数中调用
2. 必须在发生 panic 的同一个 goroutine 中
3. 直接在 defer 函数中调用，不能再嵌套一层普通函数

### Q: defer 的执行顺序是什么？

A: defer 采用 **LIFO (后进先出)** 顺序：
```go
defer fmt.Println("1") // 最后执行
defer fmt.Println("2") // 第二个执行
defer fmt.Println("3") // 第一个执行
// 输出: 3, 2, 1
```

### Q: 命名返回值和普通返回值有什么区别？

A: 
- **普通返回值**：return 时的值就确定了，defer 无法修改
- **命名返回值**：return 先赋值，然后执行 defer，defer 可以修改返回值

```go
// 普通返回值 - 返回 1
func normalReturn() int {
    result := 1
    defer func() { result = 2 }()
    return result // 复制 result 的值 1 返回
}

// 命名返回值 - 返回 2
func namedReturn() (result int) {
    defer func() { result = 2 }()
    return 1 // 1. result=1; 2. defer 修改为 2; 3. 返回 2
}
```

### Q: 二次 panic 是什么？

A: 如果在 defer 执行过程中又发生了 panic，这个新的 panic 会覆盖之前的 panic：

```go
func main() {
    defer func() {
        panic("第二个 panic") // 最终程序显示这个 panic
    }()
    defer func() {
        if r := recover(); r != nil {
            panic("第一个 defer 内的 panic")
        }
    }()
    panic("初始 panic") // 被覆盖
}
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 PR！
