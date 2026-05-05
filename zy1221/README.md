# Slice Teacher - Go Slice 底层数组共享教学工具

一个帮助团队理解 Go slice 底层数组共享问题的 CLI 工具。

## 功能特性

- **复盘 slice 操作**：支持 make、切片表达式、full slice expression、append、copy、delete/filter、函数传参修改等操作
- **详细状态输出**：每一步的 len/cap、底层数组编号、是否发生扩容
- **别名追踪**：识别哪些切片互相共享底层数组
- **内存浪费检测**：发现哪里因为 reslice 持有大数组
- **多格式输入**：支持 YAML 配置、JSONL 操作序列、Go 源码解析
- **多格式导出**：Markdown/JSON 报告、SQLite 留痕
- **样例场景**：内置 5 个典型场景，帮助快速上手

## 安装

```bash
go install github.com/zy1221/slice-teacher@latest
```

或从源码构建：

```bash
git clone <repo-url>
cd zy1221
go build -o slice-teacher .
```

## 快速开始

### 1. 生成样例数据

```bash
slice-teacher seed
```

这会在当前目录生成：
- `slice-cases.yaml` - 5 个典型场景的 YAML 配置
- `ops.jsonl` - JSONL 格式的操作序列示例
- `snippets/basic.go` - 基础 slice 操作示例代码
- `snippets/advanced.go` - 高级 slice 操作示例代码（含 @slice-op 注解）

### 2. 列出可用的 Case

```bash
slice-teacher list
```

### 3. 运行 Case 并分析

```bash
# 运行所有 case
slice-teacher run

# 运行指定 case
slice-teacher run -i slice_alias

# 指定配置文件
slice-teacher run -c my-cases.yaml

# 从 Go 源码解析
slice-teacher run -s snippets/

# 从 JSONL 文件读取
slice-teacher run -o ops.jsonl
```

### 4. 导出报告

```bash
# 导出所有报告
slice-teacher export

# 导出指定格式
slice-teacher export -f md
slice-teacher export -f json

# 导出指定 case
slice-teacher export -i slice_alias
```

## 支持的操作类型

| 操作类型 | 说明 | 示例 |
|---------|------|------|
| `make` | 创建 slice | `make([]int, len, cap)` |
| `slice` | 切片表达式 | `s[low:high]` |
| `full_slice` | Full Slice Expression | `s[low:high:max]` |
| `append` | 追加元素 | `s = append(s, elem)` |
| `copy` | 复制元素 | `copy(dst, src)` |
| `delete` | 删除元素 | 模拟删除操作 |
| `filter` | 过滤操作 | 模拟 filter/遍历筛选 |
| `func_pass_by_value` | 函数值传递 | `func(s []int)` |
| `func_pass_by_ref` | 函数引用传递 | `func(s *[]int)` |
| `modify_element` | 修改元素 | `s[i] = value` |

## 典型场景说明

### 1. basic_append - 基础 append 扩容演示

演示 append 操作如何触发扩容，以及扩容后的数组变化。

**关键点**：
- 当 len > cap 时会触发扩容
- 扩容策略：<256 翻倍，>=256 增长 25%
- 扩容后指向新数组，原数组可能被释放（如果无其他引用）

### 2. slice_alias - 切片别名问题演示

演示切片表达式如何创建别名，以及修改一个会影响另一个。

**关键点**：
- 切片表达式 `s[low:high]` 不创建新数组
- 新切片与原切片共享底层数组
- 修改新切片的元素会影响原切片

### 3. full_slice_expr - Full Slice Expression 演示

演示 `s[low:high:max]` 如何限制 cap，防止意外共享。

**关键点**：
- Full Slice Expression 可以限制新切片的 cap
- `s[low:high:max]` 的 cap = max - low
- 限制 cap 后 append 会立即扩容，不会污染原数组

### 4. func_param - 函数传参问题演示

演示切片作为函数参数时的行为：值传递但共享底层数组。

**关键点**：
- 切片是值传递（拷贝 slice header）
- 底层数组通过指针共享
- 函数内修改元素会影响原切片
- 函数内 append 可能导致扩容，此时函数内外指向不同数组

### 5. big_array_hold - 大数组持有问题演示

演示 reslice 如何持有大数组，导致内存浪费。

**关键点**：
- 从大切片取小视图会持有整个大数组
- 即使只使用一小部分，整个数组也不会被 GC
- 解决方案：使用 copy 创建独立副本，或使用 Full Slice Expression

## 输入格式说明

### YAML 配置格式

```yaml
cases:
  - id: "my_case"
    name: "我的测试场景"
    description: "这是一个测试场景"
    category: "自定义"
    seed: 42
    operations:
      - type: "make"
        target: "a"
        parameters:
          len: 3
          cap: 5
        description: "创建切片 a"
      
      - type: "slice"
        target: "b"
        sources: ["a"]
        parameters:
          low: 1
          high: 3
        description: "创建别名 b"
```

### JSONL 格式

```jsonl
{"type": "make", "target": "a", "parameters": {"len": 3, "cap": 5}, "description": "创建切片 a"}
{"type": "slice", "target": "b", "sources": ["a"], "parameters": {"low": 1, "high": 3}, "description": "创建别名 b"}
{"type": "append", "target": "a", "parameters": {"num_elements": 3}, "description": "追加元素"}
```

### Go 源码解析

工具可以自动解析 Go 源码中的 slice 操作：

```go
// 自动识别
a := make([]int, 3, 5)
b := a[1:3]
a = append(a, 1, 2, 3)

// 使用 @slice-op 注解精确控制
// @slice-op: make(target=big, len=50, cap=50)
big := make([]int, 50, 50)

// @slice-op: full_slice(target=safe, source=big, low=0, high=10, max=10)
safe := big[0:10:10]
```

## 输出说明

### 控制台输出示例

```
========================================
运行 Case: 切片别名问题演示 (slice_alias)
========================================

--- 步骤 1: make ---
描述: 创建原始切片
切片状态:
  original: len=5, cap=10, 数组=arr_001[0:10]

--- 步骤 2: slice ---
描述: 从 original[1:4] 创建 alias1
切片状态:
  original: len=5, cap=10, 数组=arr_001[0:10]
  alias1: len=3, cap=9, 数组=arr_001[1:10] ⚠️别名
别名关系:
  original <-> [alias1]
  alias1 <-> [original]
说明:
  - 从 original[1:4] 创建新切片 alias1
  - 新切片 len=3, cap=9，指向数组 arr_001[1:10]
  - ⚠️  切片 alias1 和 original 现在共享同一个底层数组
```

### Markdown 报告

报告包含：
- 执行摘要（总操作数、扩容次数、别名问题、内存浪费）
- 每一步的详细状态（切片状态、底层数组、别名关系）
- 说明和建议

### JSON 报告

JSON 格式包含完整的结构化数据，便于后续处理。

### SQLite 留痕

每一步的状态都会记录到 SQLite 数据库，可用于：
- 历史查询
- 数据分析
- 与其他工具集成

## 最佳实践建议

### 1. 防止别名问题

```go
// 错误：修改别名会影响原切片
view := bigSlice[10:20]
view[0] = newValue  // 会修改 bigSlice[10]

// 正确：使用 copy 创建独立副本
view := make([]int, 10)
copy(view, bigSlice[10:20])
```

### 2. 使用 Full Slice Expression

```go
// 限制 cap，防止意外共享
view := bigSlice[10:20:20]
// view 的 cap = 10，append 会立即扩容
```

### 3. 函数传参注意事项

```go
// 函数内修改元素会影响原切片
func modifyElement(s []int) {
    s[0] = 999  // 会影响调用者
}

// 函数内 append 可能导致扩容，不会影响原切片
func appendElement(s []int) []int {
    s = append(s, 1)  // 可能指向新数组
    return s  // 需要返回新切片
}

// 需要修改 slice 本身（len/cap）时传指针
func modifySlice(s *[]int) {
    *s = append(*s, 1)
}
```

### 4. 避免大数组持有

```go
// 错误：持有大数组
func processFirst5(big []int) []int {
    return big[:5]  // 持有整个大数组
}

// 正确：创建独立副本
func processFirst5(big []int) []int {
    result := make([]int, 5)
    copy(result, big[:5])
    return result  // 独立的小数组
}
```

## 命令参考

```
slice-teacher [command]

可用命令:
  run        运行 slice case 并分析
  list       列出可用的测试用例
  seed       生成样例数据文件
  export     导出分析报告
  help       显示帮助信息

全局选项:
  -h, --help   显示帮助信息
```

### run 命令选项

```
-c, --cases string      YAML 配置文件路径 (默认 "slice-cases.yaml")
-o, --ops string        JSONL 操作文件路径（可选）
-s, --snippets string   Go 代码片段目录（可选，默认 "snippets"）
-i, --case-id string    要运行的 case ID（可选，不指定则运行所有）
-O, --output string     输出目录（默认 "reports"）
    --json              导出 JSON 报告（默认 true）
    --md                导出 Markdown 报告（默认 true）
    --no-sqlite         不使用 SQLite 记录
```

### seed 命令选项

```
-O, --output string   输出目录（默认 "."）
-f, --force           强制覆盖已存在的文件
```

### export 命令选项

```
-c, --cases string       YAML 配置文件路径（默认 "slice-cases.yaml"）
-o, --ops string         JSONL 操作文件路径
-s, --snippets string    Go 代码片段目录
-i, --case-id string     要导出的 case ID（可选）
-O, --output string      输出目录（默认 "reports"）
-f, --format string      导出格式: md, json, all（默认 "all"）
    --pretty             JSON 格式化输出（默认 true）
```

## 测试

```bash
# 运行所有测试
go test ./...

# 运行特定测试
go test ./internal/engine -v
go test ./internal/parser -v
```

## 项目结构

```
.
├── cmd/
│   ├── root.go        # 根命令
│   ├── run.go         # run 命令
│   ├── list.go        # list 命令
│   ├── seed.go        # seed 命令
│   └── export.go      # export 命令
├── internal/
│   ├── model/         # 数据模型
│   │   ├── slice.go
│   │   ├── operation.go
│   │   └── case.go
│   ├── engine/        # 核心模拟引擎
│   │   ├── engine.go
│   │   └── engine_test.go
│   ├── parser/        # 配置解析器
│   │   ├── yaml_parser.go
│   │   ├── yaml_parser_test.go
│   │   ├── jsonl_parser.go
│   │   └── go_parser.go
│   ├── storage/       # SQLite 存储
│   │   └── sqlite.go
│   ├── report/        # 报告生成
│   │   └── report.go
│   └── errors/        # 错误处理
│       └── errors.go
├── main.go            # 入口文件
├── go.mod
└── README.md
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 常见问题

### Q: 为什么修改一个切片会影响另一个？

A: 因为它们共享同一个底层数组。切片表达式 `s[low:high]` 不会创建新数组，只是创建一个新的 slice header 指向原数组的一部分。

### Q: append 什么时候会扩容？

A: 当 `len + new_elements > cap` 时会触发扩容。扩容策略：
- cap < 256：翻倍
- cap >= 256：增长 25%
- 最后对齐到 8 字节

### Q: 如何防止大数组持有问题？

A: 使用 `copy` 创建独立副本，或使用 Full Slice Expression `s[low:high:max]` 限制新切片的 cap。

### Q: 函数传参时 slice 是值传递还是引用传递？

A: 是值传递（拷贝 slice header），但底层数组通过指针共享。所以：
- 修改元素会影响原切片
- append 可能导致扩容，此时函数内外指向不同数组
- 需要修改 slice 本身（len/cap）时传指针
