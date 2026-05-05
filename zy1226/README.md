# Context Health - Go Context 调用链体检 CLI

一个用于检查 Go 程序中 context 调用链健康状况的 CLI 工具。帮助团队发现和修复 context 相关的常见问题。

## 功能特性

- **Deadline 继承检查**: 验证子调用是否正确继承父调用的超时设置
- **取消传播检查**: 检查可取消 context 的 cancel 函数是否被正确调用
- **超时预算分配**: 验证各服务调用的超时是否在预算范围内
- **WithValue 滥用检测**: 识别不规范的键名、未授权的键和过度使用
- **Background/TODO 误用检测**: 发现调用链中间不应使用的 context.Background 和 context.TODO
- **Goroutine 边界资源释放**: 检查 goroutine 中 context 的正确使用

## 安装

```bash
go install github.com/your-org/context-health@latest
```

或者从源码构建：

```bash
git clone <repo-url>
cd context-health
go build -o context-health .
```

## 快速开始

### 1. 初始化项目

```bash
context-health init
```

这会创建以下文件结构：

```
.
├── context-plan.yaml      # 调用链规划配置
├── calls.jsonl            # 调用记录数据
├── snippets/              # Go 代码片段
│   ├── handler.go
│   └── service.go
└── bad-configs/           # 坏配置示例（供参考）
    ├── no_deadline.go
    ├── cancel_not_called.go
    └── ...
```

### 2. 编辑配置文件

编辑 `context-plan.yaml` 定义您的 API 调用链：

```yaml
api_name: create_order
description: 创建订单接口
entry_point: OrderHandler    # 允许使用 context.Background 的入口点
total_timeout: 30s           # 总超时预算

call_chain:
  - from: OrderHandler
    to: OrderService
    timeout: 500ms
    requires_cancel: true
  - from: OrderService
    to: UserService
    timeout: 1s
    requires_cancel: true
  - from: OrderService
    to: PaymentService
    timeout: 5s
    requires_cancel: true
    is_goroutine: true

budgets:
  UserService:
    allocation: 1s
  PaymentService:
    allocation: 5s

allowed_withvalue_keys:
  - request_id
  - user_id
  - trace_id
```

### 3. 准备调用数据

#### 方式一：从 JSONL 文件

编辑 `calls.jsonl`，每行一个 JSON 对象：

```json
{"caller":"OrderHandler","callee":"OrderService","has_deadline":true,"timeout_budget_ms":500,"has_cancel":true,"cancel_called":true}
{"caller":"OrderService","callee":"UserService","has_deadline":true,"timeout_budget_ms":1000,"has_cancel":true,"cancel_called":false}
```

#### 方式二：从 Go 代码片段

将 Go 代码文件放入 `snippets/` 目录，工具会自动分析其中的 context 相关调用。

### 4. 运行分析

```bash
context-health analyze
```

输出示例：

```
=== Context 调用链体检 ===
配置文件: context-plan.yaml
调用数据: calls.jsonl
代码目录: snippets

API: create_order - 创建订单接口
入口点: OrderHandler
总超时预算: 30s

✓ 从 calls.jsonl 加载 3 条调用记录
✓ 从 snippets 加载 2 条调用记录

开始分析 5 条调用记录...

=== 风险清单 ===

按严重程度统计:
  Critical (严重): 2
  High (高):       3
  Medium (中):     1
  Low (低):        0

详细问题列表:

1. 🔴 [CRITICAL] context.Background 误用
   调用: Service -> DB
   位置: snippets/bad.go:15
   描述: 在调用链中间使用了 context.Background
   建议: 从上层调用传递 context

2. 🟠 [HIGH] Cancel 函数未调用
   调用: OrderService -> UserService
   描述: 创建了可取消 context，但 cancel 函数未被调用
   建议: 确保在 defer 中调用 cancel 函数释放资源

=== 预算瀑布图 ===

总预算: 30s

1. OrderHandler -> OrderService
   🟢 ████████ (16.7%) | 累计: 5s | 剩余: 25s

2. OrderService -> UserService
   🟡 ██████████████████ (33.3%) | 累计: 15s | 剩余: 15s

3. OrderService -> PaymentService
   🔴 ██████████████████████████████████████ (66.7%) | 累计: 35s | 剩余: -5s

⚠  警告: 总使用时间 35s 超过预算 30s，超支 5s

=== 评分卡 ===

健康评分: 50/100 (D) - 需要改进
调用记录数: 5
风险问题数: 6

⚠  存在 2 个严重问题，建议优先修复
```

## 命令详解

### init

初始化项目，创建模板文件和示例数据。

```bash
context-health init [flags]
```

**选项：**
- `-f, --force`: 覆盖已存在的文件
- `-t, --template`: 模板类型 (`default` 或 `bad`)

**示例：**
```bash
context-health init           # 使用默认模板
context-health init -t bad    # 使用坏配置模板（用于测试）
context-health init -f        # 覆盖已有文件
```

### analyze

分析 context 调用链健康状况。

```bash
context-health analyze [flags]
```

**选项：**
- `-c, --config`: 配置文件路径（默认 `context-plan.yaml`）
- `--calls`: calls.jsonl 文件路径（默认 `calls.jsonl`）
- `--snippets`: Go 代码片段目录（默认 `snippets`）
- `--db`: SQLite 数据库路径（默认 `.context-health.db`）
- `--no-save`: 不保存结果到数据库
- `--no-waterfall`: 不显示预算瀑布图
- `--no-risks`: 不显示风险清单

**示例：**
```bash
context-health analyze                           # 默认分析
context-health analyze -c my-config.yaml         # 使用自定义配置
context-health analyze --db ~/.context-health.db # 指定数据库位置
```

### compare

对比两次分析结果，追踪改进情况。

```bash
context-health compare [flags]
```

**选项：**
- `-l, --list`: 列出所有历史会话
- `--old`: 旧会话 ID
- `--new`: 新会话 ID
- `--db`: SQLite 数据库路径

**示例：**
```bash
context-health compare -l                    # 列出所有会话
context-health compare --old sess_abc123 --new sess_def456  # 对比两个会话
```

### export

导出分析报告为 Markdown 或 JSON 格式。

```bash
context-health export [flags]
```

**选项：**
- `-s, --session`: 会话 ID（不指定则使用最新的）
- `-f, --format`: 输出格式 (`markdown` 或 `json`)
- `-o, --output`: 输出文件路径
- `--full`: 输出完整报告（包含所有调用记录）
- `--db`: SQLite 数据库路径

**示例：**
```bash
context-health export                              # 输出最新报告到 stdout
context-health export -f json                      # JSON 格式
context-health export -o report.md                 # 输出到文件
context-health export -s sess_abc123 -o report.md # 指定会话
context-health export --full -o full-report.md     # 完整报告
```

## 检测规则

### 1. Deadline 继承规则 (DeadlineInheritanceRule)

**检测内容：** 检查调用是否按配置设置了超时。

**风险级别：** High

**触发条件：**
- 调用链配置要求设置超时，但实际未设置 deadline

**修复建议：**
```go
// ❌ 错误
func BadCall(ctx context.Context) {
    externalService.Call(ctx) // 没有设置超时
}

// ✅ 正确
func GoodCall(ctx context.Context) {
    childCtx, cancel := context.WithTimeout(ctx, 500*time.Millisecond)
    defer cancel()
    externalService.Call(childCtx)
}
```

### 2. 取消传播规则 (CancelPropagationRule)

**检测内容：** 检查可取消 context 的 cancel 函数是否被正确调用。

**风险级别：** Critical / High

**触发条件：**
- Critical: 要求传播取消信号但未使用可取消 context
- High: 创建了可取消 context 但 cancel 函数未被调用

**修复建议：**
```go
// ❌ 错误
func BadCancel(ctx context.Context) {
    ctx, _ = context.WithCancel(ctx) // cancel 被忽略！
    // ...
}

// ✅ 正确
func GoodCancel(ctx context.Context) {
    ctx, cancel := context.WithCancel(ctx)
    defer cancel() // 确保调用！
    // ...
}
```

### 3. 预算分配规则 (BudgetAllocationRule)

**检测内容：** 检查服务调用的超时是否在预算范围内。

**风险级别：** High

**触发条件：**
- 调用超时超过配置的预算

### 4. WithValue 滥用规则 (WithValueMisuseRule)

**检测内容：** 检查 WithValue 的使用是否规范。

**风险级别：** High / Medium

**触发条件：**
- High: 使用了未授权的键
- Medium: 键名不符合 Go 惯例（使用了大写字母等）
- Medium: 单次调用中使用了超过 5 个 WithValue 键

**修复建议：**
```go
// ❌ 错误
ctx = context.WithValue(ctx, "BadKey", value)       // 不规范的键名
ctx = context.WithValue(ctx, "secret_token", token) // 未授权的键

// ✅ 正确
ctx = context.WithValue(ctx, "request_id", reqID)
ctx = context.WithValue(ctx, "user_id", userID)
```

### 5. Background 误用规则 (BackgroundMisuseRule)

**检测内容：** 检查是否在调用链中间使用了 context.Background。

**风险级别：** Critical

**触发条件：**
- 在非入口点使用了 context.Background

**修复建议：**
```go
// ❌ 错误 - 在中间层使用 Background
func (s *Service) DoSomething(ctx context.Context) error {
    newCtx := context.Background() // 丢失了上层的取消信号！
    return s.db.Query(newCtx)
}

// ✅ 正确 - 传递上层的 context
func (s *Service) DoSomething(ctx context.Context) error {
    return s.db.Query(ctx)
}
```

### 6. TODO 误用规则 (TODOMisuseRule)

**检测内容：** 检查是否使用了 context.TODO。

**风险级别：** Medium

**触发条件：**
- 任何地方使用了 context.TODO

**说明：** context.TODO 通常表示临时代码，需要确定正确的 context 传递方式。

### 7. Goroutine 边界规则 (GoroutineBoundaryRule)

**检测内容：** 检查 goroutine 中 context 的使用。

**风险级别：** Critical / High

**触发条件：**
- Critical: Goroutine 中使用了可取消 context 但 cancel 未被调用
- High: Goroutine 中没有使用可取消的 context

**修复建议：**
```go
// ❌ 错误 - Goroutine 可能永远运行
func BadGoroutine(ctx context.Context) {
    go func() {
        for {
            // 没有取消机制，可能泄漏
            externalService.Poll(ctx)
        }
    }()
}

// ✅ 正确 - 可取消的 Goroutine
func GoodGoroutine(ctx context.Context) {
    goCtx, cancel := context.WithCancel(ctx)
    go func() {
        defer cancel()
        for {
            select {
            case <-goCtx.Done():
                return
            default:
                externalService.Poll(goCtx)
            }
        }
    }()
}
```

### 8. 级联超时规则 (CascadeTimeoutRule)

**检测内容：** 检查单个调用的超时是否接近或超过总预算。

**风险级别：** High

**触发条件：**
- 单次调用超时 >= 总超时预算

**修复建议：**
```go
// ❌ 错误 - 单次调用超时接近总预算
totalTimeout := 10 * time.Second
childCtx, cancel := context.WithTimeout(ctx, 10*time.Second) // 没有预留时间
defer cancel()

// ✅ 正确 - 给错误处理预留时间
totalTimeout := 10 * time.Second
childCtx, cancel := context.WithTimeout(ctx, 8*time.Second) // 预留 2s
defer cancel()
```

## 数据格式

### context-plan.yaml

```yaml
api_name: string              # API 名称
description: string           # 接口描述
entry_point: string           # 入口点（允许使用 context.Background）
total_timeout: duration       # 总超时预算，如 30s, 1m

call_chain:                   # 调用链定义
  - from: string              # 调用方
    to: string                # 被调用方
    timeout: duration         # 该调用的超时时间
    requires_cancel: bool     # 是否要求传播取消信号
    is_goroutine: bool        # 是否在 goroutine 中执行

budgets:                      # 各服务的超时预算（可选）
  ServiceName:
    allocation: duration      # 分配的预算
    percentage: float         # 占总预算的百分比

allowed_withvalue_keys:       # 允许使用的 WithValue 键前缀
  - request_id
  - user_id
```

### calls.jsonl

每行一个 JSON 对象，包含以下字段：

```json
{
  "caller": "OrderHandler",
  "callee": "OrderService",
  "method": "CreateOrder",
  "has_deadline": true,
  "deadline": "2024-01-01T12:00:00Z",
  "timeout_budget_ms": 500,
  "has_cancel": true,
  "cancel_propagated": true,
  "cancel_called": true,
  "uses_background": false,
  "uses_todo": false,
  "with_value_keys": ["request_id", "user_id"],
  "is_goroutine": false,
  "source_file": "snippets/handler.go",
  "line_number": 15
}
```

## 评分规则

健康评分基于风险问题数量计算：

| 问题级别 | 扣分 |
|---------|------|
| Critical | -20 分 |
| High | -10 分 |
| Medium | -5 分 (可配置) |
| Low | -2 分 (可配置) |

**等级划分：**

| 分数 | 等级 | 状态 |
|------|------|------|
| 90-100 | A | 优秀 |
| 80-89 | B | 良好 |
| 70-79 | C | 一般 |
| 60-69 | D | 需要改进 |
| 0-59 | F | 不合格 |

## 项目结构

```
context-health/
├── main.go                    # 入口文件
├── cmd/
│   ├── root.go                # 根命令
│   ├── init.go                # init 命令
│   ├── analyze.go             # analyze 命令
│   ├── compare.go             # compare 命令
│   └── export.go              # export 命令
├── pkg/
│   ├── model/
│   │   └── model.go           # 数据模型
│   ├── store/
│   │   └── sqlite.go          # SQLite 存储
│   ├── parser/
│   │   └── parser.go          # 文件解析器
│   └── analyzer/
│       ├── rules.go           # 检测规则
│       └── rules_test.go      # 规则测试
├── go.mod
├── go.sum
└── README.md
```

## 运行测试

```bash
go test ./...
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

---

**注意：** 本工具需要 Go 1.21 或更高版本。
