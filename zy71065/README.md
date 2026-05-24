# Proto 枚举空洞 CLI

用于检查 proto 文件中枚举兼容性问题的命令行工具，防止因编号复用、reserved 漏写等问题导致的 SDK 兼容性破坏。

## 功能特性

- ✅ **枚举编号复用检测** - 检测同一枚举中重复使用的编号
- ✅ **历史对比检查** - 与历史快照对比，发现编号复用问题
- ✅ **Reserved 违规检查** - 检测使用了 reserved 编号或名称的情况
- ✅ **Reserved 漏写检查** - 删除枚举值后未将编号加入 reserved 的警告
- ✅ **别名使用检查** - allow_alias 选项误用检测
- ✅ **多格式输出** - 终端摘要 + JSON（机器可读） + Markdown（团队协作）
- ✅ **稳定退出码** - 可在 CI/CD 流水线中使用
- ✅ **快照管理** - 创建和管理历史版本快照

## 安装

### 前置要求

- Go 1.18+

### 编译安装

```bash
# 克隆项目后编译
go build -o proto-enum-lint .

# 移动到 PATH 目录
sudo mv proto-enum-lint /usr/local/bin/
```

## 快速开始

### 1. 检查单个 proto 文件

```bash
proto-enum-lint check -f path/to/your.proto -n your-service
```

### 2. 检查目录下所有 proto 文件

```bash
proto-enum-lint check -d ./proto -n your-service
```

### 3. 与历史快照对比

```bash
# 首次创建快照
proto-enum-lint snapshot create -d ./proto -n your-service -v v1.0.0

# 后续检查时与快照对比
proto-enum-lint check -d ./proto -n your-service -s snapshots/snapshot_your-service_v1.0.0.json

# 或者自动使用最新快照
proto-enum-lint check -d ./proto -n your-service --use-latest
```

## 命令详解

### check 命令

检查 proto 文件中的枚举兼容性问题。

**参数：**

| 参数 | 缩写 | 说明 | 默认值 |
|------|------|------|--------|
| `--files` | `-f` | proto 文件列表（逗号分隔） | `[]` |
| `--dir` | `-d` | proto 文件目录（递归扫描） | `` |
| `--snapshot` | `-s` | 历史快照文件路径 | `` |
| `--use-latest` | - | 使用最新快照 | `false` |
| `--output` | `-o` | 报告输出目录 | `./reports` |
| `--service` | `-n` | 服务名称 | `default` |

**示例：**

```bash
# 检查多个文件
proto-enum-lint check -f a.proto,b.proto,c.proto -n order-service

# 指定输出目录
proto-enum-lint check -d ./proto -n user-service -o ./build/reports

# 与快照对比
proto-enum-lint check -d ./proto -n payment-service -s ./snapshots/snapshot_payment-service_v1.json
```

### snapshot 命令

管理 proto 枚举快照。

**子命令：**

#### snapshot create

创建新的快照。

**参数：**

| 参数 | 缩写 | 说明 | 默认值 |
|------|------|------|--------|
| `--files` | `-f` | proto 文件列表 | `[]` |
| `--dir` | `-d` | proto 文件目录 | `` |
| `--output` | `-o` | 快照输出目录 | `./snapshots` |
| `--service` | `-n` | 服务名称 | `default` |
| `--version` | `-v` | 版本标识 | 时间戳 |

**示例：**

```bash
# 创建带版本号的快照
proto-enum-lint snapshot create -d ./proto -n order-service -v v2.1.0

# 创建自动命名的快照
proto-enum-lint snapshot create -d ./proto -n user-service
```

#### snapshot list

列出所有快照。

**参数：**

| 参数 | 缩写 | 说明 | 默认值 |
|------|------|------|--------|
| `--output` | `-o` | 快照目录 | `./snapshots` |
| `--service` | `-n` | 服务名称 | `default` |

**示例：**

```bash
proto-enum-lint snapshot list -n order-service
```

## 输入目录结构

推荐的项目目录结构：

```
your-project/
├── proto/                  # proto 文件目录
│   ├── user.proto
│   ├── order.proto
│   └── payment.proto
├── snapshots/              # 快照目录（自动生成）
│   ├── snapshot_your-service_v1.0.0.json
│   └── snapshot_your-service_v1.1.0.json
└── reports/                # 报告目录（自动生成）
    ├── report_your-service_20240101_120000.json
    └── report_your-service_20240101_120000.md
```

## 退出码说明

| 退出码 | 说明 |
|--------|------|
| 0 | 检查通过，未发现问题 |
| 1 | Proto 文件解析错误 |
| 2 | 输入参数验证失败 |
| 3 | 发现破坏性变更或严重问题 |
| 4 | 快照文件读取或解析错误 |
| 5 | 文件读写错误 |

**在 CI/CD 中使用：**

```bash
# 在脚本中根据退出码处理
proto-enum-lint check -d ./proto -n your-service
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ 检查通过"
elif [ $EXIT_CODE -eq 3 ]; then
    echo "❌ 发现破坏性变更"
    exit 1
else
    echo "⚠️  检查出错"
    exit 1
fi
```

## 坏数据处理

### 编号复用

**问题：** 新枚举值复用了已删除枚举值的编号。

**检测结果：**
```
❌ 编号 3 被复用: 原先是 'USER_TYPE_VIP', 现在是 'USER_TYPE_ENTERPRISE'
```

**修复方法：**
1. 为新枚举值使用新的编号
2. 或者将旧编号加入 reserved

```protobuf
enum UserType {
  reserved 3;  // 将已删除的编号加入 reserved
  USER_TYPE_UNKNOWN = 0;
  USER_TYPE_NORMAL = 1;
  USER_TYPE_PREMIUM = 2;
  USER_TYPE_ENTERPRISE = 4;  // 使用新编号
}
```

### Reserved 漏写

**问题：** 删除了枚举值，但没有将编号加入 reserved。

**检测结果：**
```
⚠️  枚举值 'USER_TYPE_VIP' (编号 3) 已被删除，但编号未加入 reserved
```

**修复方法：**

```protobuf
enum UserType {
  reserved 3;  // 添加这行
  reserved "USER_TYPE_VIP";  // 可选，也保留名称
  USER_TYPE_UNKNOWN = 0;
  USER_TYPE_NORMAL = 1;
  USER_TYPE_PREMIUM = 2;
}
```

### 重复编号（无别名）

**问题：** 同一编号被多个枚举值使用，但未启用 allow_alias。

**检测结果：**
```
❌ 枚举值编号 2 被重复使用: [STATUS_PAID STATUS_SHIPPED] (未启用 allow_alias)
```

**修复方法 1 - 启用别名：**

```protobuf
enum Status {
  option allow_alias = true;  // 添加这行
  STATUS_UNKNOWN = 0;
  STATUS_PAID = 2;
  STATUS_SHIPPED = 2;  // 这是别名
}
```

**修复方法 2 - 修改编号：**

```protobuf
enum Status {
  STATUS_UNKNOWN = 0;
  STATUS_PAID = 2;
  STATUS_SHIPPED = 3;  // 使用新编号
}
```

### Reserved 违规

**问题：** 使用了已声明为 reserved 的编号或名称。

**检测结果：**
```
❌ 枚举值 'PRIORITY_MEDIUM' 使用了保留编号 2
❌ 枚举值名称 'PRIORITY_DEPRECATED' 已被保留
```

**修复方法：** 修改枚举值的编号/名称，或移除对应的 reserved 声明。

## 报告格式

### 终端输出

直接在终端显示摘要和问题列表，便于快速查看。

### JSON 输出

机器可读格式，便于自动化处理。

```json
{
  "service": "user-service",
  "generated_at": "2024-01-01T12:00:00Z",
  "issues": [
    {
      "type": "number_reuse",
      "severity": "error",
      "message": "编号 3 被复用...",
      "file_path": "proto/user.proto",
      "enum_name": "UserType",
      "exit_code": 3
    }
  ],
  "total_errors": 1,
  "total_warnings": 1,
  "exit_code": 3,
  "exit_code_desc": "发现破坏性变更或严重问题"
}
```

### Markdown 输出

适合团队协作，可直接粘贴到 PR 评论中。包含：
- 问题摘要
- 详细问题描述
- 退出码说明
- 修复建议

## 常见问题

### Q: 解析器不支持某些 proto 语法怎么办？

A: 本工具专注于枚举检查，使用自定义解析器。如果遇到解析问题，请检查 proto 文件的格式是否正确。复杂的语法可能需要调整。

### Q: 快照文件如何管理？

A: 建议将快照文件提交到版本控制，与对应的 proto 文件版本一起管理。每次发布新版本时创建新的快照。

### Q: 可以在 CI 中使用吗？

A: 完全可以！工具的退出码设计就是为了支持 CI/CD 流水线。根据退出码判断是否允许合并 PR。

### Q: 支持 proto2 吗？

A: 支持，工具对 proto2 和 proto3 的枚举检查逻辑相同。

## 示例

查看 `examples/` 目录下的示例文件：

- `examples/good.proto` - 无问题的 proto 文件
- `examples/bad.proto` - 包含各种问题的 proto 文件
- `examples/history/v1/` - 历史版本 v1
- `examples/history/v2/` - 历史版本 v2（包含破坏性变更）

运行示例：

```bash
# 检查无问题的文件
proto-enum-lint check -f examples/good.proto -n demo

# 检查有问题的文件
proto-enum-lint check -f examples/bad.proto -n demo

# 创建快照并对比
proto-enum-lint snapshot create -f examples/history/v1/user.proto -n user -v v1
proto-enum-lint check -f examples/history/v2/user.proto -n user -s snapshots/snapshot_user_v1.json
```

## License

MIT
