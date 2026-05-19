# Proto 字段编号兼容历史快照排查工具

一个用于检查 gRPC Proto 文件字段编号兼容性变更的命令行工具，重点检测字段编号复用等破坏性变更。

## 功能特性

- **Proto 解析**: 解析单个或目录下的所有 .proto 文件，提取消息和字段定义
- **快照管理**: 生成、存储、加载和对比历史快照
- **兼容性检测**:
  - 字段编号复用检测（ERROR 级别）
  - 字段删除识别（WARNING 级别）
  - 字段类型变更检测
  - 字段标签变更检测
- **来源追踪**: 保留原文件位置信息，精确定位问题
- **报告生成**: 控制台格式化输出和 JSON 报告导出
- **结果稳定**: 所有字典和列表均有序排序，重复运行结果一致

## 安装

```bash
pip install -e .
```

## 使用方法

### 1. 生成快照

```bash
# 生成单个 proto 文件的快照
proto-check snapshot examples/v1/user.proto --name v1

# 生成整个目录的快照
proto-check snapshot examples/v1/ --name v1

# 显示详细信息
proto-check snapshot examples/v1/user.proto --name v1 -v
```

### 2. 列出所有快照

```bash
proto-check list
```

### 3. 检查兼容性

```bash
# 检查两个快照之间的兼容性
proto-check check v1 v2

# 检查快照与当前 proto 文件
proto-check check v1 --proto-path examples/v2/user.proto

# 检查与最新快照
proto-check check v1

# 导出 JSON 报告
proto-check check v1 v2 -o report.json

# 只输出 JSON 格式
proto-check check v1 v2 --json
```

### 4. 查看快照详情

```bash
proto-check show v1
```

### 5. 删除快照

```bash
proto-check delete v1

# 强制删除（不提示）
proto-check delete v1 -f
```

## 示例演示

```bash
# 1. 生成 v1 快照
proto-check snapshot examples/v1/user.proto --name v1

# 2. 生成 bad 快照（有字段编号复用问题）
proto-check snapshot examples/bad/user.proto --name bad

# 3. 检查兼容性
proto-check check v1 bad
```

预期输出会检测到以下问题：
- 字段编号 2: 'name' -> 'full_name' （编号复用 ERROR）
- 字段编号 3: 'email' -> 'contact' （编号复用 ERROR）
- 字段编号 5: 'phone' -> 'mobile' （编号复用 ERROR）

## 输出示例

```
┌──────────────────────────────────┐
│      Proto 字段兼容性检查报告       │
└──────────────────────────────────┘

对比快照: v1 -> bad
检查时间: 2024-01-15 10:30:00

┏━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━┳━━━━━━┓
┃ 问题类型            ┃ 严重级别   ┃ 数量 ┃
┡━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━╇━━━━━━┩
│ FIELD_NUMBER_REUSE  │ ERROR      │    3 │
└─────────────────────┴────────────┴──────┘

总问题数: 3 (错误: 3, 警告: 0)

问题详情:

1. [ERROR] FIELD_NUMBER_REUSE
   消息: example.user.User
   字段编号: 2
   字段名称: full_name
   描述: 字段编号 2 被复用：旧字段 'name' -> 新字段 'full_name'
   当前位置: /path/to/examples/bad/user.proto:7
   原始位置: /path/to/examples/v1/user.proto:7
```

## 规则说明

| 规则类型 | 严重级别 | 说明 |
|---------|---------|------|
| FIELD_NUMBER_REUSE | ERROR | 同一个字段编号被不同字段名称使用，会导致严重的兼容性问题 |
| FIELD_DELETED | WARNING | 字段被删除，编号被释放，可能导致兼容性问题 |
| FIELD_TYPE_CHANGED | ERROR/WARNING | 字段类型变更，根据兼容性判定级别 |
| FIELD_LABEL_CHANGED | WARNING | 字段标签（optional/repeated）变更 |
| MESSAGE_DELETED | WARNING | 整个消息被删除 |

## 项目结构

```
proto_snapshot_checker/
├── __init__.py       # 包初始化
├── parser.py         # Proto 文件解析器
├── snapshot.py       # 快照管理模块
├── rules.py          # 兼容性检查规则
├── reporter.py       # 报告生成模块
└── cli.py            # 命令行入口

examples/
├── v1/
│   └── user.proto    # 原始版本
├── v2/
│   └── user.proto    # 字段名称变更
├── v3/
│   └── user.proto    # 字段名称微调
└── bad/
    └── user.proto    # 有字段编号复用问题
```
