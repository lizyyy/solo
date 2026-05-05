# Go Interface 底层原理复盘 CLI

一个用于分析 Go 语言 interface 底层原理的命令行工具。帮助开发者深入理解 eface/iface、itab、动态类型、方法集、类型断言、typed nil 和接口装箱等核心概念。

## 功能特性

- **多维度分析**：支持分析 eface/iface、itab、动态类型和值、值/指针接收者方法集、类型断言、type switch、typed nil 和接口装箱带来的分配风险
- **代码静态分析**：自动解析 Go 代码片段，检测不安全的类型断言、分配风险等问题
- **SQLite 持久化**：所有分析记录保存到 SQLite 数据库，支持历史记录回放
- **多格式导出**：支持导出 Markdown 和 JSON 格式的分析报告
- **Seed 样例**：内置丰富的学习样例，帮助快速上手
- **友好提示**：详细的坏格式提示和错误信息

## 安装

```bash
# 克隆项目
git clone <repository-url>
cd go-iface-analyzer

# 安装依赖
go mod tidy

# 构建
go build -o go-iface-analyzer .
```

## 快速开始

### 1. 初始化工作目录

```bash
./go-iface-analyzer init
```

这会创建以下文件和目录：
- `snippets/` - 存放 Go 代码片段的目录
- `interface-cases.yaml` - 分析案例配置文件
- `calls.jsonl` - 调用记录文件
- `analysis.db` - SQLite 数据库文件

### 2. 执行分析

```bash
./go-iface-analyzer analyze
```

输出示例：
```
开始分析 interface 案例...
  加载了 8 个分析案例
  加载了 3 条调用记录
  加载了 5 个代码片段

分析完成！
====================
会话 ID: 1
总案例数: 8
发现问题数: 25

按分类统计:
  - eface_iface: 1 个
  - itab: 1 个
  - dynamic_type: 1 个
  - method_set: 1 个
  - type_assertion: 1 个
  - type_switch: 1 个
  - typed_nil: 1 个
  - allocation: 1 个

提示:
  使用 'go-iface-analyzer replay 1' 查看详细分析结果
  使用 'go-iface-analyzer export --session 1 -o report.md' 导出 Markdown 报告
  使用 'go-iface-analyzer export --session 1 -o report.json --format json' 导出 JSON 报告
```

### 3. 回放历史记录

```bash
# 查看最近的分析记录列表
./go-iface-analyzer replay

# 查看指定会话的详细结果
./go-iface-analyzer replay 1
```

### 4. 导出报告

```bash
# 导出最近的分析为 Markdown 格式
./go-iface-analyzer export -o report.md

# 导出指定会话为 JSON 格式
./go-iface-analyzer export --session 1 -o report.json -f json
```

## 命令详解

### init

初始化工作目录，创建必要的配置文件和目录结构。

```bash
go-iface-analyzer init
```

### analyze

执行 interface 分析，读取配置文件和代码片段，生成分析结果并保存到数据库。

```bash
go-iface-analyzer analyze
```

**分析内容包括：**

| 分类 | 描述 |
|------|------|
| eface_iface | 空接口与非空接口的底层结构分析 |
| itab | 接口表（itab）的缓存机制和类型转换开销 |
| dynamic_type | 动态类型与值的运行时表示 |
| method_set | 值接收者与指针接收者的方法集差异 |
| type_assertion | 类型断言的安全与不安全用法 |
| type_switch | type switch 的使用场景和注意事项 |
| typed_nil | typed nil 的陷阱和正确的检查方式 |
| allocation | 接口装箱带来的堆分配风险 |

### replay

回放历史分析记录。

```bash
# 列出最近的分析记录
go-iface-analyzer replay

# 查看指定会话的详细结果
go-iface-analyzer replay <session_id>
```

### export

导出分析报告。

```bash
go-iface-analyzer export [flags]

Flags:
  -f, --format string     输出格式：markdown 或 json (默认 "markdown")
  -o, --output string     输出文件路径（必填）
      --session int64     指定要导出的会话 ID（默认使用最近的会话）
```

## 配置文件说明

### interface-cases.yaml

定义需要分析的 interface 案例。

```yaml
cases:
  - name: "案例名称"
    category: "分类"
    description: "案例描述"
    source_file: "对应的代码片段文件名"
    line_number: 行号
    tags: ["标签1", "标签2"]
```

**可用的 category 值：**
- `eface_iface` - 空接口与非空接口分析
- `itab` - itab 接口表分析
- `dynamic_type` - 动态类型分析
- `method_set` - 方法集分析
- `type_assertion` - 类型断言分析
- `type_switch` - type switch 分析
- `typed_nil` - typed nil 分析
- `allocation` - 分配风险分析

### calls.jsonl

记录接口调用的 JSON Lines 格式文件，每行一个 JSON 对象。

```json
{"timestamp":"2024-01-15T10:30:00Z","operation":"assign","interface":"fmt.Stringer","concrete":"*main.MyType","allocation":true,"method_call":"","source_file":"main.go","line_number":42}
```

**字段说明：**
- `timestamp` - 时间戳
- `operation` - 操作类型（assign/call/assert）
- `interface` - 接口类型
- `concrete` - 具体类型
- `allocation` - 是否发生堆分配
- `method_call` - 方法名
- `source_file` - 源文件
- `line_number` - 行号

### snippets/ 目录

存放需要分析的 Go 代码片段。工具会自动解析这些文件中的：
- 类型断言
- type switch
- 接口装箱
- 方法定义

## 分析规则

### 1. 类型断言检测

检测不安全的类型断言（未使用 comma-ok 模式）：

```go
// 不安全 - 类型不匹配会 panic
s := i.(string)

// 安全 - comma-ok 模式
if s, ok := i.(string); ok {
    // 使用 s
}
```

### 2. 方法集规则

值接收者和指针接收者的方法集差异：

```go
type T struct{}

func (t T) ValueMethod() {}   // 值接收者
func (t *T) PtrMethod() {}     // 指针接收者

// 值类型 T 的方法集：只有 ValueMethod
// 指针类型 *T 的方法集：ValueMethod + PtrMethod
```

### 3. Typed Nil 检测

识别 typed nil 的陷阱：

```go
// typed nil - 有类型但值为 nil
var i interface{} = (*int)(nil)
fmt.Println(i == nil)  // false！

// 真正的 nil
var j interface{} = nil
fmt.Println(j == nil)  // true
```

### 4. 分配风险检测

检测可能导致堆分配的接口装箱：

```go
// 可能导致堆分配
var i interface{} = 42
var s fmt.Stringer = LargeStruct{}

// 指针装箱通常不会额外分配
var p fmt.Stringer = &SmallStruct{}
```

## 运行测试

```bash
# 运行所有测试
go test ./...

# 运行指定包的测试
go test ./internal/config/...
go test ./internal/database/...
go test ./internal/exporter/...
```

## 项目结构

```
go-iface-analyzer/
├── main.go                    # 主入口
├── cmd/
│   ├── root.go               # 根命令
│   ├── init.go               # init 命令
│   ├── analyze.go            # analyze 命令
│   ├── replay.go             # replay 命令
│   └── export.go             # export 命令
├── internal/
│   ├── models/               # 数据模型
│   │   └── models.go
│   ├── config/               # 配置解析
│   │   ├── config.go
│   │   └── config_test.go
│   ├── database/             # 数据库操作
│   │   ├── database.go
│   │   └── database_test.go
│   ├── analyzer/             # 分析引擎
│   │   └── analyzer.go
│   └── exporter/             # 报告导出
│       ├── exporter.go
│       └── exporter_test.go
├── snippets/                 # 代码片段目录（运行 init 后生成）
├── interface-cases.yaml      # 案例配置（运行 init 后生成）
├── calls.jsonl               # 调用记录（运行 init 后生成）
├── analysis.db               # SQLite 数据库（运行 init 后生成）
├── go.mod
└── README.md
```

## 坏格式提示

工具会提供详细的错误提示，帮助你快速定位问题：

| 错误场景 | 提示信息 |
|----------|----------|
| YAML 解析失败 | `line 5: failed to parse YAML: ...` |
| JSONL 格式错误 | `line 3: failed to parse JSON: ...` |
| 缺少必要文件 | `必要文件不存在，请先运行 'go-iface-analyzer init'` |
| 无效的 session_id | `无效的 session_id: strconv.ParseInt: ...` |

## 学习资源

工具内置的 seed 样例覆盖了以下 Go interface 核心概念：

1. **eface_example.go** - 空接口底层结构
2. **method_set.go** - 值/指针接收者方法集
3. **type_assertion.go** - 类型断言的安全与不安全用法
4. **typed_nil.go** - typed nil 的陷阱
5. **allocation.go** - 接口装箱与堆分配

建议按顺序学习这些样例，并结合分析结果加深理解。

## 许可证

MIT License
