# Go Policy Scanner

Go Policy Scanner 是一个用于多服务 Go 仓库的工程化巡检 CLI 工具。它可以帮助团队检测代码中的各种工程化问题，确保代码质量和架构规范。

## 功能特性

- **循环依赖检测**: 检测 Go 包之间的循环依赖关系
- **跨层乱引用检查**: 根据配置的模块边界规则，检查非法的跨层引用
- **接口变更同步检查** (待完善): 检测 API 定义与实现是否同步
- **迁移文件检查** (待完善): 检查数据库迁移文件是否缺少回滚脚本
- **错误码/日志字段统一检查** (待完善): 确保错误码和日志字段符合规范
- **SQLite 持久化**: 所有扫描结果保存到 SQLite 数据库
- **多格式报告**: 支持 Markdown 和 JSON 格式的报告导出
- **趋势对比**: 支持两次扫描结果的对比分析

## 安装

### 依赖

- Go 1.21+
- SQLite3

### 编译安装

```bash
# 克隆项目
git clone <repository-url>
cd go-policy-scanner

# 下载依赖
go mod tidy

# 编译
go build -o go-policy-scanner ./cmd/main.go

# 安装到系统 PATH
sudo mv go-policy-scanner /usr/local/bin/
```

## 快速开始

### 1. 创建策略配置文件

在项目根目录创建 `service-policy.yaml` 文件：

```yaml
project_name: "my-microservice-project"

modules:
  - name: "internal"
    path: "./internal"
    type: "internal"
    allowed_imports:
      - "my-project/internal/*"
      - "my-project/pkg/*"

  - name: "pkg"
    path: "./pkg"
    type: "library"
    allowed_imports:
      - "my-project/pkg/*"

  - name: "cmd"
    path: "./cmd"
    type: "service"
    allowed_imports:
      - "my-project/internal/*"
      - "my-project/pkg/*"

check_rules:
  enable_cyclic_dep_check: true
  enable_cross_layer_check: true
  enable_api_sync_check: true
  enable_migration_check: true
  enable_error_code_check: true
  enable_log_field_check: true
  max_allowed_dependencies: 30

error_codes:
  - code: "ERR-001"
    message: "系统内部错误"
    category: "system"

log_fields:
  - name: "trace_id"
    type: "string"
    required: true
    description: "请求追踪ID"
```

### 2. 执行扫描

```bash
# 扫描当前目录
go-policy-scanner scan .

# 指定策略文件
go-policy-scanner scan --policy service-policy.yaml ./my-project

# 扫描并输出报告
go-policy-scanner scan --output report.md ./my-project
```

## 命令详解

### scan - 扫描命令

扫描 Go 项目并生成检查报告。

```bash
# 基本用法
go-policy-scanner scan [directory]

# 选项
  -d, --db string       SQLite 数据库文件路径 (默认 "./policy_scanner.db")
  -p, --policy string   service-policy.yaml 文件路径
  -o, --output string   输出报告文件路径 (支持 .md 和 .json)
  -f, --format string   输出格式: markdown|json (默认 "markdown")
  -v, --verbose         显示详细输出
```

### compare - 对比命令

比较两次扫描结果，生成趋势对比报告。

```bash
# 基本用法
go-policy-scanner compare <base-scan-id> <target-scan-id>

# 示例
go-policy-scanner compare 1 2
go-policy-scanner compare --output diff.md 1 2
go-policy-scanner compare --format json 1 2

# 选项
  -d, --db string       SQLite 数据库文件路径
  -o, --output string   输出报告文件路径
  -f, --format string   输出格式: markdown|json (默认 "markdown")
  -v, --verbose         显示详细输出
```

### export - 导出命令

导出指定扫描结果的详细报告。

```bash
# 基本用法
go-policy-scanner export <scan-id>

# 示例
go-policy-scanner export 1
go-policy-scanner export --output report.md --format markdown 1
go-policy-scanner export --output report.json --format json 1

# 选项
  -d, --db string       SQLite 数据库文件路径
  -o, --output string   输出报告文件路径 (默认: stdout)
  -f, --format string   输出格式: markdown|json (默认 "markdown")
  -v, --verbose         显示详细输出
```

## 检查项说明

### 1. 循环依赖检测 (cyclic_dependency)

**严重程度**: critical

检测 Go 包之间是否存在循环依赖。循环依赖会导致编译问题和架构混乱。

**检测逻辑**:
- 使用深度优先搜索 (DFS) 遍历包的导入关系图
- 检测是否存在回边形成的循环

**修复建议**:
- 提取公共代码到更基础的包
- 使用依赖倒置原则
- 考虑重构包结构

### 2. 跨层乱引用检查 (cross_layer)

**严重程度**: high

根据 `service-policy.yaml` 中配置的 `allowed_imports` 规则，检查是否存在非法的跨层引用。

**检测逻辑**:
- 每个模块定义允许导入的模块列表
- 支持通配符模式匹配
- 同一模块内的引用总是允许

**修复建议**:
- 审查策略配置是否正确
- 检查是否存在架构设计问题
- 考虑调整模块边界

### 3. 依赖数量检查 (dependency_count)

**严重程度**: medium/low

检查外部依赖数量是否超过阈值，以及单个包的导入数量是否过多。

**检测逻辑**:
- 统计 `go.mod` 中的直接依赖数量
- 与配置的 `max_allowed_dependencies` 比较
- 检查单个包的导入数量

**修复建议**:
- 评估是否真的需要所有依赖
- 考虑使用更轻量的替代方案
- 对于导入过多的包，考虑拆分

## 输出示例

### Markdown 报告示例

```markdown
# Go Policy Scan Report

**生成时间**: 2024-01-15 10:30:00

## 扫描概要

| 项目 | 值 |
|------|-----|
| 扫描 ID | 1 |
| 仓库名称 | my-project |
| 扫描时间 | 2024-01-15 10:29:45 |
| 分支 | main |
| 提交 | abc123def |

## 检查结果

| 指标 | 数值 |
|------|------|
| 总检查项 | 3 |
| 通过项 | 1 |
| 失败项 | 2 |

### 违规类型统计

| 违规类型 | 数量 |
|----------|------|
| cyclic_dependency | 1 |
| cross_layer | 1 |

## 违规详情

### 1. 🔴 Cyclic dependency detected: internal/service -> internal/repository -> internal/service

- **类型**: cyclic_dependency
- **严重程度**: critical
- **详情**: 
```
Cycle involves packages: [internal/service internal/repository internal/service]
```

### 2. 🟠 Cross-layer violation: internal/repository imports internal/service

- **类型**: cross_layer
- **严重程度**: high
- **详情**: 
```
Package internal/repository is not allowed to import internal/service according to policy
```
```

## 项目结构

```
go-policy-scanner/
├── cmd/
│   ├── main.go                 # 入口文件
│   └── commands/
│       ├── root.go             # 根命令
│       ├── scan.go             # 扫描命令
│       ├── compare.go          # 对比命令
│       └── export.go           # 导出命令
├── internal/
│   ├── checker/                # 检查器模块
│   │   ├── interface.go        # 检查器接口
│   │   ├── module_scanner.go   # 模块扫描器
│   │   ├── cyclic_dependency.go # 循环依赖检查
│   │   ├── cross_layer.go      # 跨层引用检查
│   │   └── dependency_count.go # 依赖数量检查
│   ├── config/                 # 配置加载
│   │   └── loader.go
│   ├── reporter/               # 报告生成
│   │   └── reporter.go
│   ├── scanner/                # 扫描器核心
│   │   └── scanner.go
│   └── storage/                # 存储层
│       ├── sqlite.go
│       └── sqlite_test.go
├── pkg/
│   └── model/                  # 数据模型
│       └── model.go
├── examples/
│   └── service-policy.yaml     # 示例策略文件
├── testdata/
│   └── test-project/           # 测试项目
├── go.mod
├── go.sum
└── README.md
```

## 测试

```bash
# 运行所有测试
go test ./...

# 运行特定测试
go test ./internal/storage -v
```

## 常见问题

### Q: 如何处理 "go.mod not found" 错误？

A: 确保在 Go 模块的根目录运行扫描命令，或者指定包含 `go.mod` 的目录。

### Q: 如何添加新的检查规则？

A: 实现 `checker.Checker` 接口，然后在 `scanner/scanner.go` 中注册新的检查器。

### Q: 数据库文件在哪里？

A: 默认情况下，数据库文件 `policy_scanner.db` 会在当前目录创建。可以使用 `--db` 选项指定其他路径。

### Q: 如何忽略某些检查项？

A: 在 `service-policy.yaml` 的 `check_rules` 部分，将对应的检查项设置为 `false`：

```yaml
check_rules:
  enable_cyclic_dep_check: false   # 禁用循环依赖检查
  enable_cross_layer_check: true
  ...
```

## 版本历史

- **v0.1.0**: 初始版本
  - 支持循环依赖检测
  - 支持跨层乱引用检查
  - 支持依赖数量检查
  - SQLite 持久化
  - Markdown/JSON 报告导出
  - 两次扫描结果对比

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
